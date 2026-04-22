const mongoose = require("mongoose");
const Student = require("../models/Student");
const User = require("../models/User");
const Expense = require("../models/Expense");
const MessBill = require("../models/MessBill");
const StudentConsumption = require("../models/StudentConsumption");
const Charge = require("../models/Charge");
const MessBillReport = require("../models/MessBillReport");
const BillingSetting = require("../models/BillingSetting");
const { generateMessBills } = require("../services/calculationService");
const { applyLiveBillState, DEFAULT_UTR_MESSAGE } = require("../services/billLifecycleService");
const {
  notifyStudentBillGenerated,
  notifyStudentBillGeneratedInApp,
  notifyReportStakeholders,
  notifyCaretakerApproval,
  notifyReportGeneratedInApp,
  notifyReportSubmittedInApp,
  notifyReportApprovedInApp,
  notifyCaretakerPaymentUpdatedInApp,
} = require("../services/notificationService");
const { runInTransaction } = require("../utils/transaction");
const { getPagination, buildPaginationMeta } = require("../utils/pagination");
const { createAuditLog } = require("../services/auditService");
const logger = require("../utils/logger");

// ─── Month format validator ───────────────────────────────────────────────────
const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

// ─── Populate config ──────────────────────────────────────────────────────────
const POPULATE_STUDENT = {
  path: "studentId",
  select: "studentId gender isEBL isActive",
  populate: {
    path: "userId",
    select: "name username hostelId isActive",
  },
};

const POPULATE_FULL = [
  {
    path: "studentId",
    select: "studentId gender isEBL isActive",
    populate: {
      path: "userId",
      select: "name username hostelId isActive",
    },
  },
  {
    path: "userId",
    select: "name username",
  },
  {
    path: "hostelId",
    select: "name type location",
  },
];

const getStudentSortValue = (bill) => {
  const studentCode = bill?.studentId?.studentId || "";
  const numericPart = studentCode.match(/\d+$/)?.[0];

  if (numericPart) {
    return Number.parseInt(numericPart, 10);
  }

  return Number.MAX_SAFE_INTEGER;
};

const sortBillsByStudentId = (bills = []) =>
  [...bills].sort((a, b) => {
    const byNumericId = getStudentSortValue(a) - getStudentSortValue(b);
    if (byNumericId !== 0) {
      return byNumericId;
    }

    return (a?.studentId?.studentId || "").localeCompare(b?.studentId?.studentId || "");
  });

const resolveHostelScopedBillQuery = (req, month) => {
  const query = { month };

  if (req.user.role === "caretaker") {
    if (!req.user.hostelId) {
      const error = new Error("Caretaker must be assigned to a hostel.");
      error.status = 400;
      throw error;
    }

    query.hostelId = req.user.hostelId;
    return query;
  }

  if (["admin", "dean", "warden"].includes(req.user.role) && req.query.hostelId) {
    query.hostelId = req.query.hostelId;
  }

  return query;
};

const getBillingSetting = (hostelId, month, session = null) => {
  const query = BillingSetting.findOne({ hostelId, month });
  if (session) {
    query.session(session);
  }
  return query;
};

const populateBillForResponse = (query) => query.populate(POPULATE_FULL);

const isOperationalStudent = (student) =>
  Boolean(
    student &&
      student.isActive !== false &&
      student.userId &&
      student.userId.isActive !== false
  );

const filterOperationalBills = (bills = []) => bills.filter((bill) => isOperationalStudent(bill?.studentId));

const populateMessBillReport = [
  { path: "hostelId", select: "name type location" },
  { path: "generatedBy", select: "name email role" },
  { path: "submittedBy", select: "name email role" },
  { path: "approvedByWarden", select: "name email role" },
  { path: "approvedByDean", select: "name email role" },
];

/**
 * @route   POST /bill/generate/:month
 * @access  Protected – caretaker only
 * @desc    Generate mess bills for all active students in the caretaker's hostel
 *          for the given month.
 *
 * Flow:
 *  1. Extract caretaker's hostelId from req.user
 *  2. Validate month format
 *  3. Fetch expense record for hostel + month
 *  4. Check if bills already exist (prevent duplicates)
 *  5. Fetch all active students for the hostel with populated userId
 *  6. Fetch consumption records for the same students and month
 *  7. Call calculation service
 *  8. Insert all bills
 *  9. Return populated results
 *
 * Param:  month  – "Mon-YYYY" format
 */
const generateBills = async (req, res) => {
  try {
    const { month } = req.params;
    const caretakerHostelId = req.user.hostelId;

    // ── 1. Validate inputs ──────────────────────────────────────────────────────
    if (!caretakerHostelId) {
      return res.status(400).json({
        success: false,
        message: "Caretaker must be assigned to a hostel to generate bills.",
      });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // ── 2. Fetch expense record ────────────────────────────────────────────────
    const expense = await Expense.findOne({
      month,
      hostelId: caretakerHostelId,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: `No expense record found for ${month} in your hostel.`,
      });
    }

    const populatedBills = await runInTransaction(async (session) => {
      const existingBills = await MessBill.findOne({
        hostelId: caretakerHostelId,
        month,
      }).session(session);

      if (existingBills) {
        const error = new Error(`Bills for ${month} have already been generated for this hostel.`);
        error.status = 409;
        throw error;
      }

      const students = await Student.find({
        isActive: true,
      })
        .populate({
          path: "userId",
          select: "_id name username hostelId",
          match: { hostelId: caretakerHostelId, isActive: true },
        })
        .session(session);

      const filteredStudents = students.filter((student) => student.userId !== null);

      if (filteredStudents.length === 0) {
        const error = new Error("No active students found in your hostel to bill for this month.");
        error.status = 400;
        throw error;
      }

      const studentIds = filteredStudents.map((student) => student._id);
      const [consumptionRecords, charges, billingSetting] = await Promise.all([
        StudentConsumption.find({
          studentId: { $in: studentIds },
          month,
        }).session(session),
        Charge.find({
          hostelId: caretakerHostelId,
          month,
        }).session(session),
        getBillingSetting(caretakerHostelId, month, session),
      ]);

      let billPayloads;
      try {
        billPayloads = generateMessBills(expense, filteredStudents, consumptionRecords, {
          charges,
          dueDate: billingSetting?.dueDate,
          announcementDate: billingSetting?.announcementDate,
        });
      } catch (calcError) {
        calcError.status = 400;
        throw calcError;
      }

      const createdBills = await MessBill.insertMany(billPayloads, { session });

      await createAuditLog({
        action: "BILLS_GENERATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: createdBills[0]._id,
        entityType: "MessBillBatch",
        metadata: {
          hostelId: caretakerHostelId,
          month,
          count: createdBills.length,
        },
        session,
      });

      const populatedBills = await MessBill.find({ _id: { $in: createdBills.map((bill) => bill._id) } })
        .session(session)
        .populate(POPULATE_FULL);

      return sortBillsByStudentId(populatedBills);
    });

    await Promise.allSettled(
      populatedBills.flatMap((bill) => [notifyStudentBillGenerated(bill), notifyStudentBillGeneratedInApp(bill)])
    );

    return res.status(201).json({
      success: true,
      message: `Bills for ${month} generated successfully for ${populatedBills.length} students.`,
      month,
      count: populatedBills.length,
      bills: populatedBills.map((bill) => applyLiveBillState(bill)),
    });
  } catch (error) {
    // Handle duplicate key errors during insertion
    if (error.code === 11000 || error.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message || "One or more bills for this month already exist.",
      });
    }
    logger.error("Generate bills error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

/**
 * @route   GET /bill/all/:month
 * @access  Protected – caretaker or admin
 * @desc    Get all bills for a given month.
 *          Caretakers see only their hostel's bills.
 *          Admins see all hostels' bills.
 *
 * Param:  month  – "Mon-YYYY" format
 */
const getAllBillsByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    // Validate month format
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // Build query based on user role
    const query = resolveHostelScopedBillQuery(req, month);
    // Admin (and higher roles) can see all hostels' bills

    const { page, limit, skip } = getPagination(req.query);
    const [allBills, total] = await Promise.all([
      MessBill.find(query).populate(POPULATE_FULL),
      MessBill.countDocuments(query),
    ]);
    const sortedBills = sortBillsByStudentId(filterOperationalBills(allBills));
    const bills = sortedBills.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      month,
      count: bills.length,
      data: bills.map((bill) => applyLiveBillState(bill)),
      pagination: buildPaginationMeta(page, limit, sortedBills.length),
    });
  } catch (error) {
    logger.error("Get all bills error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getBillBreakdownByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const query = resolveHostelScopedBillQuery(req, month);
    const { page, limit, skip } = getPagination(req.query);

    const [allBills, total] = await Promise.all([
      MessBill.find(query).populate(POPULATE_FULL),
      MessBill.countDocuments(query),
    ]);

    const sortedBills = sortBillsByStudentId(filterOperationalBills(allBills));
    const paginatedBills = sortedBills.slice(skip, skip + limit);

    const liveBills = paginatedBills.map((bill) => applyLiveBillState(bill));
    return res.status(200).json({
      success: true,
      message: "Bill breakdown fetched successfully.",
      data: liveBills,
      pagination: buildPaginationMeta(page, limit, sortedBills.length),
      totals: {
        billed: sortedBills.map((row) => applyLiveBillState(row)).reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
        fine: sortedBills.map((row) => applyLiveBillState(row)).reduce((sum, row) => sum + Number(row.fine || 0), 0),
        count: sortedBills.length,
      },
    });
  } catch (error) {
    logger.error("Get bill breakdown error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

/**
 * @route   GET /bill/student/:studentId/:month
 * @access  Protected – student (own bill), caretaker (all), admin (all)
 * @desc    Get a specific student's bill for a given month.
 *
 * For students: can only access their own bill.
 * For caretaker/admin: can access any bill.
 *
 * Param:  studentId  – Student document _id
 * Param:  month      – "Mon-YYYY" format
 */
const getStudentBill = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    // Validate month format
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // Validate studentId format
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studentId format.",
      });
    }

    // ── Role-based access control ───────────────────────────────────────────────
    if (req.user.role === "student") {
      // Students can only view their own bill
      // Verify that the student belongs to this user
      const studentRecord = await Student.findById(studentId);
      if (!studentRecord) {
        return res.status(404).json({
          success: false,
          message: "Student record not found.",
        });
      }

      if (studentRecord.isActive === false) {
        return res.status(404).json({
          success: false,
          message: "Student record not found.",
        });
      }

      // Check that the student's userId matches the authenticated user
      if (studentRecord.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own bill.",
        });
      }
    }
    // Caretaker and admin can view any student's bill

    // ── Fetch the bill ──────────────────────────────────────────────────────────
    const bill = await MessBill.findOne({
      studentId,
      month,
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate(POPULATE_FULL);

    if (!bill || !isOperationalStudent(bill.studentId)) {
      return res.status(404).json({
        success: false,
        message: `No bill found for this student in ${month}.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bill fetched successfully.",
      data: applyLiveBillState(bill),
    });
  } catch (error) {
    logger.error("Get student bill error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getStudentBillHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studentId format.",
      });
    }

    const studentRecord = await Student.findById(studentId).populate({
      path: "userId",
      select: "_id hostelId",
    });

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student record not found.",
      });
    }

    if (!isOperationalStudent(studentRecord)) {
      return res.status(404).json({
        success: false,
        message: "Student record not found.",
      });
    }

    if (req.user.role === "student" && studentRecord.userId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own bills.",
      });
    }

    if (
      req.user.role === "caretaker" &&
      studentRecord.userId.hostelId?.toString() !== req.user.hostelId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only view bills for students in your hostel.",
      });
    }

    const { page, limit, skip } = getPagination(req.query);
    const filter = { studentId };
    const [bills, total] = await Promise.all([
      MessBill.find(filter)
        .populate(POPULATE_FULL)
        .sort({ month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MessBill.countDocuments(filter),
    ]);

    const visibleBills = filterOperationalBills(bills);

    return res.status(200).json({
      success: true,
      message: "Student bill history fetched successfully.",
      data: visibleBills.map((bill) => applyLiveBillState(bill)),
      pagination: buildPaginationMeta(page, limit, visibleBills.length),
    });
  } catch (error) {
    logger.error("Get student bill history error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getMessBillReportByMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);

    const report = await MessBillReport.findOne({ hostelId: query.hostelId, month }).populate(populateMessBillReport);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Mess bill per student report not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mess bill per student report fetched successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Get mess bill report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const generateMessBillReport = async (req, res) => {
  try {
    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);

    const bills = filterOperationalBills(await MessBill.find(query).populate(POPULATE_FULL));
    if (!bills.length) {
      return res.status(404).json({
        success: false,
        message: "No saved student bills found for this month.",
      });
    }

    const payload = {
      hostelId: query.hostelId,
      month,
      billCount: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0),
      generatedBy: req.user._id,
      status: "draft",
      submittedAt: null,
      submittedBy: null,
      approvedByWarden: null,
      wardenApprovedAt: null,
      wardenNotes: "",
      approvedByDean: null,
      deanApprovedAt: null,
      deanNotes: "",
    };

    const report = await MessBillReport.findOneAndUpdate(
      { hostelId: query.hostelId, month },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate(populateMessBillReport);

    await notifyReportStakeholders({
      month,
      hostelId: query.hostelId,
      triggeredByName: req.user.name,
      triggerLabel: "The mess bill per student report has been generated",
    });
    await notifyReportGeneratedInApp({
      month,
      hostelId: query.hostelId,
      reportName: "Mess Bill Per Student Report",
      generatedByName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Mess bill per student report generated successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Generate mess bill report error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const submitMessBillReport = async (req, res) => {
  try {
    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);
    const report = await MessBillReport.findOne({ hostelId: query.hostelId, month });

    if (!report) {
      return res.status(404).json({ success: false, message: "Mess bill per student report not found." });
    }

    if (report.status !== "draft") {
      return res.status(200).json({
        success: true,
        message: "Mess bill per student report already submitted.",
        data: report,
      });
    }

    report.status = "submitted";
    report.submittedAt = new Date();
    report.submittedBy = req.user._id;
    await report.save();
    await report.populate(populateMessBillReport);

    await notifyReportStakeholders({
      month,
      hostelId: query.hostelId,
      triggeredByName: req.user.name,
      triggerLabel: "The mess bill per student report has been submitted",
    });
    await notifyReportSubmittedInApp({
      month,
      hostelId: query.hostelId,
      reportName: "Mess Bill Per Student Report",
      submittedByName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Mess bill per student report submitted successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Submit mess bill report error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const approveMessBillReportByWarden = async (req, res) => {
  try {
    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);
    const { notes } = req.body;
    const report = await MessBillReport.findOne({ hostelId: query.hostelId, month });

    if (!report) {
      return res.status(404).json({ success: false, message: "Mess bill per student report not found." });
    }

    if (report.status !== "submitted") {
      return res.status(400).json({ success: false, message: "Warden approval is allowed only after submission." });
    }

    report.status = "warden_approved";
    report.approvedByWarden = req.user._id;
    report.wardenApprovedAt = new Date();
    report.wardenNotes = notes || "";
    await report.save();
    await report.populate(populateMessBillReport);

    await Promise.all([
      notifyReportStakeholders({
        month,
        hostelId: query.hostelId,
        triggeredByName: req.user.name,
        triggerLabel: "The mess bill per student report has been approved by the warden",
      }),
      notifyCaretakerApproval({
        month,
        hostelId: query.hostelId,
        approverRole: "Warden",
        approverName: req.user.name,
        notes: notes || "",
      }),
      notifyReportApprovedInApp({
        month,
        hostelId: query.hostelId,
        reportName: "Mess Bill Per Student Report",
        approverRole: "warden",
        approverName: req.user.name,
        actor: req.user,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Mess bill per student report approved by warden successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Approve mess bill report by warden error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const approveMessBillReportByDean = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: "Dean approval is not required for the mess bill per student report. Warden approval is the final step for this report.",
    });

    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);
    const { notes } = req.body;
    const report = await MessBillReport.findOne({ hostelId: query.hostelId, month });

    if (!report) {
      return res.status(404).json({ success: false, message: "Mess bill per student report not found." });
    }

    if (report.status !== "warden_approved") {
      return res.status(400).json({ success: false, message: "Dean approval is allowed only after warden approval." });
    }

    report.status = "dean_approved";
    report.approvedByDean = req.user._id;
    report.deanApprovedAt = new Date();
    report.deanNotes = notes || "";
    await report.save();
    await report.populate(populateMessBillReport);

    await Promise.all([
      notifyReportStakeholders({
        month,
        hostelId: query.hostelId,
        triggeredByName: req.user.name,
        triggerLabel: "The mess bill per student report has been approved by the dean/admin",
      }),
      notifyCaretakerApproval({
        month,
        hostelId: query.hostelId,
        approverRole: "Dean/Admin",
        approverName: req.user.name,
        notes: notes || "",
      }),
      notifyReportApprovedInApp({
        month,
        hostelId: query.hostelId,
        reportName: "Mess Bill Per Student Report",
        approverRole: "dean",
        approverName: req.user.name,
        actor: req.user,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Mess bill per student report approved by dean/admin successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Approve mess bill report by dean error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getBillConfig = async (req, res) => {
  try {
    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);

    const [config, bills] = await Promise.all([
      BillingSetting.findOne({ hostelId: query.hostelId, month }).populate("updatedBy", "name role"),
      MessBill.find({ hostelId: query.hostelId, month }).select("announcement_date due_date"),
    ]);

    return res.status(200).json({
      success: true,
      message: "Bill configuration fetched successfully.",
      data: {
        month,
        hostelId: query.hostelId,
        dueDate: config?.dueDate || bills[0]?.due_date || null,
        announcementDate: config?.announcementDate || bills[0]?.announcement_date || null,
        updatedBy: config?.updatedBy || null,
      },
    });
  } catch (error) {
    logger.error("Get bill configuration error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const upsertBillConfig = async (req, res) => {
  try {
    const { month } = req.params;
    const query = resolveHostelScopedBillQuery(req, month);
    const { dueDate, announcementDate } = req.body;

    if (!dueDate) {
      return res.status(400).json({ success: false, message: "dueDate is required." });
    }

    const resolvedDueDate = new Date(dueDate);
    const resolvedAnnouncementDate = announcementDate ? new Date(announcementDate) : null;

    if (Number.isNaN(resolvedDueDate.getTime())) {
      return res.status(400).json({ success: false, message: "Valid dueDate is required." });
    }

    if (resolvedAnnouncementDate && Number.isNaN(resolvedAnnouncementDate.getTime())) {
      return res.status(400).json({ success: false, message: "announcementDate must be a valid date." });
    }

    const config = await BillingSetting.findOneAndUpdate(
      { hostelId: query.hostelId, month },
      {
        hostelId: query.hostelId,
        month,
        dueDate: resolvedDueDate,
        announcementDate: resolvedAnnouncementDate,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("updatedBy", "name role");

    await MessBill.updateMany(
      { hostelId: query.hostelId, month },
      {
        $set: {
          due_date: resolvedDueDate,
          announcement_date: resolvedAnnouncementDate,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Bill due date and announcement date updated successfully.",
      data: config,
    });
  } catch (error) {
    logger.error("Update bill configuration error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const updateStudentPaymentDetails = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentMode, paymentMadeDate, utrNumber } = req.body;

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({ success: false, message: "Invalid billId format." });
    }

    const bill = await populateBillForResponse(MessBill.findById(billId));
    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found." });
    }

    if (req.user.role !== "student" || String(bill.userId?._id || bill.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only update your own payment details." });
    }

    if (bill.is_ebl_student || bill.payment_status === "ebl") {
      return res.status(400).json({
        success: false,
        message: "EBL reimbursement bills do not use the regular student payment UTR flow.",
      });
    }

    const normalizedPaymentModeInput =
      paymentMode === undefined || paymentMode === null ? "" : String(paymentMode).trim().toLowerCase();
    const normalizedUtrNumber = String(utrNumber || "").trim();
    const resolvedPaymentMode = normalizedPaymentModeInput || (normalizedUtrNumber ? "upi" : bill.student_payment_mode || "");

    if (!["cash", "upi", ""].includes(resolvedPaymentMode)) {
      return res.status(400).json({ success: false, message: "paymentMode must be cash or upi." });
    }

    const resolvedPaymentDate =
      paymentMadeDate === undefined ? bill.student_payment_made_date || null : paymentMadeDate ? new Date(paymentMadeDate) : null;
    if (resolvedPaymentDate instanceof Date && Number.isNaN(resolvedPaymentDate.getTime())) {
      return res.status(400).json({ success: false, message: "paymentMadeDate must be a valid date." });
    }

    bill.student_payment_mode = resolvedPaymentMode;
    bill.student_payment_made_date = resolvedPaymentDate;
    bill.student_utr_number = resolvedPaymentMode === "upi" ? normalizedUtrNumber : "";
    await bill.save();
    await notifyCaretakerPaymentUpdatedInApp({
      bill,
      studentName: bill.userId?.name,
      month: bill.month,
    });

    return res.status(200).json({
      success: true,
      message: "Payment details updated successfully.",
      data: {
        ...applyLiveBillState(bill),
        caretakerUtrDisplay: bill.student_utr_number || DEFAULT_UTR_MESSAGE,
      },
    });
  } catch (error) {
    logger.error("Update student payment details error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

module.exports = {
  generateBills,
  getAllBillsByMonth,
  getBillBreakdownByMonth,
  getStudentBill,
  getStudentBillHistory,
  getMessBillReportByMonth,
  generateMessBillReport,
  submitMessBillReport,
  approveMessBillReportByWarden,
  approveMessBillReportByDean,
  getBillConfig,
  upsertBillConfig,
  updateStudentPaymentDetails,
};
