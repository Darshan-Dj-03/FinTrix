const mongoose = require("mongoose");

const Student = require("../models/Student");
const MessBill = require("../models/MessBill");
const EblPeriod = require("../models/EblPeriod");
const EblReport = require("../models/EblCategoryReport");
const { runInTransaction } = require("../utils/transaction");
const { createAuditLog } = require("../services/auditService");
const {
  notifyReportGeneratedInApp,
  notifyReportSubmittedInApp,
  notifyReportApprovedInApp,
} = require("../services/notificationService");
const logger = require("../utils/logger");
const {
  createPdfDocument,
  drawUniversityHeader,
  drawContactDetailsBlock,
  drawSectionHeading,
  drawTable,
  formatCurrency,
  drawSignatureBlock,
} = require("../utils/pdfLayout");
const { resolveReportContacts } = require("../utils/reportContacts");
const { enumerateMonthsInRange, monthToSortable } = require("../utils/monthRange");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const POPULATE_EBL_PERIOD = [
  {
    path: "studentId",
    select: "studentId gender isEBL isActive studentClass",
    populate: {
      path: "userId",
      select: "name username email hostelId isActive",
      populate: {
        path: "hostelId",
        select: "name type location",
      },
    },
  },
  { path: "userId", select: "name username email hostelId" },
  { path: "hostelId", select: "name type location" },
  { path: "createdBy", select: "name role email" },
  { path: "updatedBy", select: "name role email" },
  { path: "approvedByWarden", select: "name role email" },
];

const REPORT_TYPE_LABELS = {
  pre_receipt: "EBL Pre-Receipt Report",
  month_wise: "EBL Month-wise Calculation Report",
};

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const isOperationalStudent = (student) =>
  Boolean(
    student &&
      student.isActive !== false &&
      student.userId &&
      student.userId.isActive !== false
  );

const filterMonthsBySelectedRange = (months = [], fromMonth, toMonth) => {
  if (!fromMonth || !toMonth) {
    return months;
  }

  const selectedStart = Math.min(monthToSortable(fromMonth), monthToSortable(toMonth));
  const selectedEnd = Math.max(monthToSortable(fromMonth), monthToSortable(toMonth));

  return months.filter((month) => {
    const sortable = monthToSortable(month);
    return sortable >= selectedStart && sortable <= selectedEnd;
  });
};

const buildComputedMonthlyDetails = (period, fromMonth = null, toMonth = null) => {
  const allMonths = validateMonthRange(period.fromMonth, period.toMonth);
  const selectedMonths = filterMonthsBySelectedRange(allMonths, fromMonth, toMonth);
  const monthlyShare = allMonths.length ? Number(period.monthlyGoiAmount || 0) / allMonths.length : 0;
  const storedDetails = new Map(
    (period.monthlyDetails || []).map((detail) => [detail.month, detail])
  );

  return selectedMonths.map((month) => {
    const stored = storedDetails.get(month);
    const messBillAmount = roundMoney(Number(stored?.messBillAmount || 0));
    const goiAmount = roundMoney(monthlyShare);
    const differenceAmount = roundMoney(messBillAmount - goiAmount);

    return {
      month,
      messBillAmount,
      goiAmount,
      differenceAmount,
      billId: stored?.billId || null,
    };
  });
};

const buildPeriodTotals = (monthlyDetails = [], goiAmount = 0) => {
  const totalMessBill = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.messBillAmount || 0), 0)
  );
  const totalScholarship = roundMoney(Number(goiAmount || 0));
  const totalDifference = roundMoney(totalMessBill - totalScholarship);

  return {
    totalMessBill,
    totalScholarship,
    totalDifference,
    totalClaimAmount: roundMoney(Math.max(totalDifference, 0)),
  };
};

const withEffectiveTotals = (period) => {
  const plain = typeof period.toObject === "function" ? period.toObject() : period;
  const monthlyDetails = buildComputedMonthlyDetails(plain);
  return {
    ...plain,
    monthlyDetails,
    totals: buildPeriodTotals(monthlyDetails, plain.monthlyGoiAmount || 0),
  };
};

const periodOverlapsSelectedRange = (period, fromMonth, toMonth) => {
  if (!fromMonth || !toMonth) {
    return true;
  }

  const selectedStart = Math.min(monthToSortable(fromMonth), monthToSortable(toMonth));
  const selectedEnd = Math.max(monthToSortable(fromMonth), monthToSortable(toMonth));
  const periodStart = Math.min(monthToSortable(period.fromMonth), monthToSortable(period.toMonth));
  const periodEnd = Math.max(monthToSortable(period.fromMonth), monthToSortable(period.toMonth));

  return periodStart <= selectedEnd && periodEnd >= selectedStart;
};

const validateMonthRange = (fromMonth, toMonth) => {
  if (!fromMonth || !toMonth || !MONTH_REGEX.test(fromMonth) || !MONTH_REGEX.test(toMonth)) {
    const error = new Error('fromMonth and toMonth must be in "Mon-YYYY" format.');
    error.status = 400;
    throw error;
  }

  const months = enumerateMonthsInRange(fromMonth, toMonth);
  if (!months.length) {
    const error = new Error("fromMonth must be before or equal to toMonth.");
    error.status = 400;
    throw error;
  }

  return months;
};

const getDisplayPeriodLabel = (months = [], fallbackFromMonth, fallbackToMonth) => {
  if (!months.length) {
    return `${fallbackFromMonth} to ${fallbackToMonth}`;
  }

  return `${months[0]} to ${months[months.length - 1]}`;
};

const ensureStudentAccess = async (studentId, reqUser, session = null) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    const error = new Error("Invalid studentId format.");
    error.status = 400;
    throw error;
  }

  const query = Student.findById(studentId).populate({
    path: "userId",
    select: "name username email hostelId isActive",
    populate: {
      path: "hostelId",
      select: "name type location",
    },
  });

  if (session) {
    query.session(session);
  }

  const student = await query;
  if (!student || !isOperationalStudent(student)) {
    const error = new Error("Student not found.");
    error.status = 404;
    throw error;
  }

  if (reqUser.role === "student" && String(student.userId._id) !== String(reqUser._id)) {
    const error = new Error("You can only access your own EBL records.");
    error.status = 403;
    throw error;
  }

  if (
    reqUser.role === "caretaker" &&
    String(student.userId?.hostelId?._id || student.userId?.hostelId) !== String(reqUser.hostelId)
  ) {
    const error = new Error("Caretaker can only manage EBL records for their hostel.");
    error.status = 403;
    throw error;
  }

  return student;
};

const ensureReportAccess = async (id, reqUser) => {
  const report = await EblReport.findById(id)
    .populate("hostelId", "name type location")
    .populate("generatedBy", "name role email")
    .populate("submittedBy", "name role email")
    .populate("approvedByWarden", "name role email");

  if (!report) {
    const error = new Error("EBL report not found.");
    error.status = 404;
    throw error;
  }

  const reportHostelId = String(report.hostelId?._id || report.hostelId);
  if (["caretaker", "warden"].includes(reqUser.role) && reportHostelId !== String(reqUser.hostelId)) {
    const error = new Error("You can only access EBL reports for your hostel.");
    error.status = 403;
    throw error;
  }

  return report;
};

const resolveMonthlyDetails = async ({ student, fromMonth, toMonth, goiAmount = 0, session = null }) => {
  const months = validateMonthRange(fromMonth, toMonth);

  const billQuery = MessBill.find({
    studentId: student._id,
    month: { $in: months },
  });

  if (session) {
    billQuery.session(session);
  }

  const bills = await billQuery;
  const billMap = new Map(bills.map((bill) => [bill.month, bill]));
  const monthlyShare = months.length ? Number(goiAmount || 0) / months.length : 0;

  return months.map((month) => {
    const bill = billMap.get(month);
    const messBillAmount = roundMoney(Number(bill?.total_amount || 0));
    const share = roundMoney(monthlyShare);

    return {
      month,
      messBillAmount,
      goiAmount: share,
      differenceAmount: roundMoney(messBillAmount - share),
      billId: bill?._id || null,
    };
  });
};

const syncCoveredBillsForPeriod = async (period, session = null) => {
  const billIds = (period.monthlyDetails || []).map((row) => row.billId).filter(Boolean);
  if (!billIds.length) {
    return;
  }

  const query = MessBill.find({ _id: { $in: billIds } });
  if (session) {
    query.session(session);
  }

  const coveredBills = await query;
  const normalizedPeriodUtr = String(period.periodUtr || "").trim();
  const hasPeriodUtr = Boolean(normalizedPeriodUtr);
  const appliedAt = new Date();

  for (const bill of coveredBills) {
    bill.student_payment_mode = hasPeriodUtr ? "upi" : "";
    bill.student_payment_made_date = hasPeriodUtr ? bill.student_payment_made_date || appliedAt : null;
    bill.student_utr_number = hasPeriodUtr ? normalizedPeriodUtr : "";
    bill.manual_fine = 0;
    bill.fine = 0;
    bill.amount_paid = hasPeriodUtr ? Number(bill.total_amount || 0) : 0;
    bill.payment_status = hasPeriodUtr ? "paid" : "ebl";
    await bill.save({ session });
  }
};

const listPeriods = async (req, res) => {
  try {
    const { hostelId, status, fromMonth, toMonth, studentId } = req.query;
    const filter = {};

    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) {
        return res.status(404).json({ success: false, message: "Student record not found." });
      }
      filter.studentId = student._id;
    } else if (req.user.role === "caretaker") {
      filter.hostelId = req.user.hostelId;
    } else if (hostelId && mongoose.Types.ObjectId.isValid(hostelId)) {
      filter.hostelId = hostelId;
    }

    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      filter.studentId = studentId;
    }

    if (status) {
      filter.status = status;
    }

    if (fromMonth) {
      filter.fromMonth = fromMonth;
    }

    if (toMonth) {
      filter.toMonth = toMonth;
    }

    const periods = await EblPeriod.find(filter)
      .populate(POPULATE_EBL_PERIOD)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: periods.map(withEffectiveTotals),
    });
  } catch (error) {
    logger.error("List EBL periods error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const createPeriod = async (req, res) => {
  try {
    const { studentId, fromMonth, toMonth, monthlyGoiAmount, periodUtr, scholarshipNotes } = req.body;

    if (!studentId || !fromMonth || !toMonth) {
      return res.status(400).json({
        success: false,
        message: "studentId, fromMonth, and toMonth are required.",
      });
    }

    validateMonthRange(fromMonth, toMonth);

    if (Number(monthlyGoiAmount) < 0) {
      return res.status(400).json({
        success: false,
        message: "GOI sanctioned amount cannot be negative.",
      });
    }

    const created = await runInTransaction(async (session) => {
      const student = await ensureStudentAccess(studentId, req.user, session);

      if (!student.isEBL) {
        const error = new Error("Student must be marked as an EBL student first.");
        error.status = 400;
        throw error;
      }

      const monthlyDetails = await resolveMonthlyDetails({
        student,
        fromMonth,
        toMonth,
        goiAmount: Number(monthlyGoiAmount || 0),
        session,
      });

      const totals = buildPeriodTotals(monthlyDetails, monthlyGoiAmount);

      const [period] = await EblPeriod.create(
        [
          {
            studentId: student._id,
            userId: student.userId._id,
            hostelId: student.userId.hostelId._id || student.userId.hostelId,
            fromMonth,
            toMonth,
            monthlyGoiAmount: Number(monthlyGoiAmount || 0),
            periodUtr: String(periodUtr || "").trim(),
            scholarshipNotes: String(scholarshipNotes || "").trim(),
            monthlyDetails,
            totals,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session }
      );

      await syncCoveredBillsForPeriod(period, session);

      await createAuditLog({
        action: "EBL_PERIOD_CREATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: period._id,
        entityType: "EblPeriod",
        metadata: {
          studentId: student._id,
          hostelId: period.hostelId,
          fromMonth,
          toMonth,
          goiAmount: Number(monthlyGoiAmount || 0),
        },
        session,
      });

      return EblPeriod.findById(period._id).populate(POPULATE_EBL_PERIOD).session(session);
    });

    return res.status(201).json({
      success: true,
      message: "EBL period created successfully.",
      data: withEffectiveTotals(created),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An EBL period already exists for this student and selected range.",
      });
    }
    logger.error("Create EBL period error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const updatePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlyGoiAmount, periodUtr, scholarshipNotes } = req.body;

    const updated = await runInTransaction(async (session) => {
      const period = await EblPeriod.findById(id).populate(POPULATE_EBL_PERIOD).session(session);
      if (!period) {
        const error = new Error("EBL period not found.");
        error.status = 404;
        throw error;
      }

      if (String(period.hostelId._id || period.hostelId) !== String(req.user.hostelId)) {
        const error = new Error("You can only update EBL periods for your hostel.");
        error.status = 403;
        throw error;
      }

      const student = await ensureStudentAccess(period.studentId._id || period.studentId, req.user, session);
      const nextGoiAmount =
        monthlyGoiAmount !== undefined ? Number(monthlyGoiAmount || 0) : Number(period.monthlyGoiAmount || 0);

      if (nextGoiAmount < 0) {
        const error = new Error("GOI sanctioned amount cannot be negative.");
        error.status = 400;
        throw error;
      }

      const monthlyDetails = await resolveMonthlyDetails({
        student,
        fromMonth: period.fromMonth,
        toMonth: period.toMonth,
        goiAmount: nextGoiAmount,
        session,
      });

      period.monthlyGoiAmount = nextGoiAmount;
      if (periodUtr !== undefined) {
        period.periodUtr = String(periodUtr || "").trim();
      }
      if (scholarshipNotes !== undefined) {
        period.scholarshipNotes = String(scholarshipNotes || "").trim();
      }
      period.monthlyDetails = monthlyDetails;
      period.totals = buildPeriodTotals(monthlyDetails, nextGoiAmount);
      period.updatedBy = req.user._id;

      await period.save({ session });
      await syncCoveredBillsForPeriod(period, session);

      await createAuditLog({
        action: "EBL_PERIOD_UPDATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: period._id,
        entityType: "EblPeriod",
        metadata: {
          goiAmount: period.monthlyGoiAmount,
          periodUtr: period.periodUtr,
        },
        session,
      });

      return EblPeriod.findById(period._id).populate(POPULATE_EBL_PERIOD).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "EBL period updated successfully.",
      data: withEffectiveTotals(updated),
    });
  } catch (error) {
    logger.error("Update EBL period error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const getStudentEblStatus = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).populate({
      path: "userId",
      select: "name username email hostelId isActive",
      populate: { path: "hostelId", select: "name type location" },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found." });
    }

    const periods = await EblPeriod.find({ studentId: student._id })
      .populate(POPULATE_EBL_PERIOD)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        student,
        periods: periods.map(withEffectiveTotals),
      },
    });
  } catch (error) {
    logger.error("Get student EBL status error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const listReports = async (req, res) => {
  try {
    await EblReport.ensureIndexesReady();
    const { hostelId, status, reportType } = req.query;
    const filter = {};

    if (["caretaker", "warden"].includes(req.user.role)) {
      filter.hostelId = req.user.hostelId;
    } else if (hostelId && mongoose.Types.ObjectId.isValid(hostelId)) {
      filter.hostelId = hostelId;
    }

    if (status) {
      filter.status = status;
    }

    if (reportType) {
      filter.reportType = reportType;
    }

    const reports = await EblReport.find(filter)
      .populate("hostelId", "name type location")
      .populate("generatedBy", "name role email")
      .populate("submittedBy", "name role email")
      .populate("approvedByWarden", "name role email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    logger.error("List EBL reports error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const buildReportPeriods = async ({ hostelId, fromMonth, toMonth }) => {
  const periods = await EblPeriod.find({ hostelId })
    .populate(POPULATE_EBL_PERIOD)
    .sort({ createdAt: 1 });

  return periods
    .filter((period) => periodOverlapsSelectedRange(period, fromMonth, toMonth))
    .map((period) => withEffectiveTotals(period));
};

const buildReportStudentEntries = async ({ hostelId, fromMonth, toMonth }) => {
  const periods = await buildReportPeriods({ hostelId, fromMonth, toMonth });
  const studentMap = new Map();

  periods.forEach((period) => {
    const studentKey = String(period.studentId?._id || period.studentId);
    if (!studentKey) {
      return;
    }

    const monthlyDetails = buildComputedMonthlyDetails(period, fromMonth, toMonth);
    if (!monthlyDetails.length) {
      return;
    }

    const existing = studentMap.get(studentKey) || {
      studentId: period.studentId,
      userId: period.userId,
      hostelId: period.hostelId,
      monthMap: new Map(),
      periods: [],
    };

    existing.studentId = period.studentId || existing.studentId;
    existing.userId = period.userId || existing.userId;
    existing.hostelId = period.hostelId || existing.hostelId;
    existing.periods.push(period);

    monthlyDetails.forEach((detail) => {
      existing.monthMap.set(detail.month, detail);
    });

    studentMap.set(studentKey, existing);
  });

  return Array.from(studentMap.values())
    .map((entry) => {
      const monthlyDetails = Array.from(entry.monthMap.values()).sort(
        (left, right) => monthToSortable(left.month) - monthToSortable(right.month)
      );
      const months = monthlyDetails.map((detail) => detail.month);
      const totalScholarship = roundMoney(
        monthlyDetails.reduce((sum, detail) => sum + Number(detail.goiAmount || 0), 0)
      );
      const totals = buildPeriodTotals(monthlyDetails, totalScholarship);

      return {
        studentId: entry.studentId,
        userId: entry.userId,
        hostelId: entry.hostelId,
        monthlyDetails,
        periods: entry.periods,
        periodLabel: getDisplayPeriodLabel(months, fromMonth, toMonth),
        totals: {
          ...totals,
          totalScholarship,
        },
      };
    })
    .sort((left, right) =>
      String(left.studentId?.studentId || "").localeCompare(String(right.studentId?.studentId || ""))
    );
};

const buildReportTotals = (entries = []) =>
  entries.reduce(
    (acc, period) => {
      acc.totalStudents += 1;
      acc.totalMessBill = roundMoney(acc.totalMessBill + Number(period.totals?.totalMessBill || 0));
      acc.totalScholarship = roundMoney(
        acc.totalScholarship + Number(period.totals?.totalScholarship || 0)
      );
      acc.totalDifference = roundMoney(
        acc.totalDifference + Number(period.totals?.totalDifference || 0)
      );
      return acc;
    },
    {
      totalStudents: 0,
      totalMessBill: 0,
      totalScholarship: 0,
      totalDifference: 0,
    }
  );

const generateReport = async (req, res) => {
  try {
    await EblReport.ensureIndexesReady();
    const { reportType, fromMonth, toMonth } = req.body;
    if (!["pre_receipt", "month_wise"].includes(reportType)) {
      return res.status(400).json({ success: false, message: "reportType must be pre_receipt or month_wise." });
    }

    validateMonthRange(fromMonth, toMonth);

    const entries = await buildReportStudentEntries({
      hostelId: req.user.hostelId,
      fromMonth,
      toMonth,
    });

    if (!entries.length) {
      return res.status(404).json({
        success: false,
        message: "No EBL period records found for the selected range.",
      });
    }

    const totals = buildReportTotals(entries);

    const report = await EblReport.findOneAndUpdate(
      {
        hostelId: req.user.hostelId,
        reportType,
        fromMonth,
        toMonth,
      },
      {
        $set: {
          totalStudents: totals.totalStudents,
          totalMessBill: roundMoney(totals.totalMessBill),
          totalScholarship: roundMoney(totals.totalScholarship),
          totalDifference: roundMoney(totals.totalDifference),
          status: "draft",
          generatedBy: req.user._id,
          submittedBy: null,
          submittedAt: null,
          approvedByWarden: null,
          approvedAt: null,
          wardenNotes: "",
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    )
      .populate("hostelId", "name type location")
      .populate("generatedBy", "name role email")
      .populate("submittedBy", "name role email")
      .populate("approvedByWarden", "name role email");

    await notifyReportGeneratedInApp({
      month: `${fromMonth} to ${toMonth}`,
      hostelId: req.user.hostelId,
      reportName: "EBL Report",
      generatedByName: req.user.name,
      actor: req.user,
    });

    return res.status(201).json({
      success: true,
      message: "EBL report generated successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Generate EBL report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const submitReport = async (req, res) => {
  try {
    const report = await ensureReportAccess(req.params.id, req.user);

    if (req.user.role !== "caretaker") {
      return res.status(403).json({ success: false, message: "Only caretaker can submit EBL reports." });
    }

    if (report.status !== "draft") {
      return res.status(400).json({ success: false, message: "Only draft EBL reports can be submitted." });
    }

    report.status = "submitted";
    report.submittedBy = req.user._id;
    report.submittedAt = new Date();
    await report.save();
    await notifyReportSubmittedInApp({
      month: `${report.fromMonth} to ${report.toMonth}`,
      hostelId: report.hostelId?._id || report.hostelId,
      reportName: "EBL Report",
      submittedByName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({ success: true, message: "EBL report submitted successfully.", data: report });
  } catch (error) {
    logger.error("Submit EBL report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const approveReport = async (req, res) => {
  try {
    const report = await ensureReportAccess(req.params.id, req.user);

    if (req.user.role !== "warden") {
      return res.status(403).json({ success: false, message: "Only warden can approve EBL reports." });
    }

    if (report.status !== "submitted") {
      return res.status(400).json({ success: false, message: "Only submitted EBL reports can be approved." });
    }

    report.status = "warden_approved";
    report.approvedByWarden = req.user._id;
    report.approvedAt = new Date();
    await report.save();
    await notifyReportApprovedInApp({
      month: `${report.fromMonth} to ${report.toMonth}`,
      hostelId: report.hostelId?._id || report.hostelId,
      reportName: "EBL Report",
      approverRole: "warden",
      approverName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({ success: true, message: "EBL report approved successfully.", data: report });
  } catch (error) {
    logger.error("Approve EBL report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const renderPreReceiptPdf = ({ res, report, entries, contacts }) => {
  const periodLabel = `${report.fromMonth} to ${report.toMonth}`;
  const doc = createPdfDocument(res, `ebl-pre-receipt-${report.fromMonth}-to-${report.toMonth}.pdf`, {
    size: "A4",
    layout: "landscape",
    margin: 28,
  });

  const renderHeader = () =>
    drawUniversityHeader(doc, {
      reportTitle: "PRE-RECEIPT",
      hostelName: report.hostelId?.name || "Hostel",
      month: periodLabel,
      generatedBy: report.generatedBy?.name || "Caretaker",
      generatedAt: report.updatedAt || report.createdAt,
      officeLabel: "EBL Charges / Zero Mess Bill Reimbursement Statement",
    });

  renderHeader();
  drawContactDetailsBlock(doc, contacts);
  doc
    .font("Times-Roman")
    .fontSize(10.5)
    .fillColor("#111827")
    .text(
      `Details of Pre-Receipt for EBL charges / zero mess bill of hostel boarders who stayed at ${report.hostelId?.name || "the hostel"} during the period ${periodLabel}. The concerned students difference mess bill charges have been claimed for reimbursement through the university workflow.`,
      doc.page.margins.left + 10,
      doc.y,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20,
        align: "justify",
      }
    );

  doc.moveDown(0.35);
  doc.font("Times-Bold").fontSize(12).text("The details as follows", { align: "center" });
  doc.moveDown(0.35);

  drawTable(doc, {
    columns: [
      { label: "Sl. No.", width: 38, key: "serial", align: "center" },
      { label: "Name of the Students", width: 162, key: "name" },
      { label: "ID No.", width: 92, key: "studentId" },
      { label: "Period (from-to)", width: 122, key: "period" },
      { label: "Total Mess Bill", width: 90, key: "messBill", align: "right" },
      { label: "GOI Scholarship sanctioned for this purpose (Rs.)", width: 134, key: "goi", align: "right", headerFontSize: 8.6 },
      { label: "Difference amount payable", width: 116, key: "difference", align: "right" },
    ],
    rows: [
      ...entries.map((entry, index) => ({
        serial: String(index + 1),
        name: entry.userId?.name || "Student",
        studentId: entry.studentId?.studentId || "-",
        period: entry.periodLabel,
        messBill: formatCurrency(entry.totals?.totalMessBill || 0),
        goi: formatCurrency(entry.totals?.totalScholarship || 0),
        difference: formatCurrency(entry.totals?.totalDifference || 0),
      })),
      {
        serial: "",
        name: "Grand Total",
        studentId: "",
        period: periodLabel,
        messBill: formatCurrency(report.totalMessBill || 0),
        goi: formatCurrency(report.totalScholarship || 0),
        difference: formatCurrency(report.totalDifference || 0),
      },
    ],
    fontSize: 8.8,
    rowPadding: 5,
  });

  drawSignatureBlock(doc, {
    signatures: [
      { label: "Caretaker" },
      { label: "Warden" },
      { label: "Dean and Chairman, Hostel Supervisory Committee" },
    ],
    footerDate: report.updatedAt || report.createdAt,
  });

  doc.end();
};

const renderMonthWisePdf = ({ res, report, entries, contacts }) => {
  const periodLabel = `${report.fromMonth} to ${report.toMonth}`;
  const doc = createPdfDocument(res, `ebl-month-wise-${report.fromMonth}-to-${report.toMonth}.pdf`, {
    size: "A4",
    layout: "portrait",
    margin: 28,
  });

  const renderHeader = () =>
    drawUniversityHeader(doc, {
      reportTitle: "Month wise Calculation Sheet",
      hostelName: report.hostelId?.name || "Hostel",
      month: periodLabel,
      generatedBy: report.generatedBy?.name || "Caretaker",
      generatedAt: report.updatedAt || report.createdAt,
      officeLabel: "EBL Student Reimbursement Register",
    });

  renderHeader();
  drawContactDetailsBlock(doc, contacts);

  entries.forEach((entry, index) => {
    drawSectionHeading(
      doc,
      `${entry.studentId?.studentId || "-"} ${entry.userId?.name || "Student"}${entry.studentId?.studentClass ? ` ${entry.studentId.studentClass}` : ""}`,
    );

    const monthlyRows = entry.monthlyDetails?.length
      ? entry.monthlyDetails.map((detail) => ({
          month: detail.month.replace("-", " "),
          messBill: formatCurrency(detail.messBillAmount),
          goi: formatCurrency(detail.goiAmount),
          difference: formatCurrency(detail.differenceAmount),
        }))
      : [
          {
            month: periodLabel,
            messBill: formatCurrency(0),
            goi: formatCurrency(0),
            difference: formatCurrency(0),
          },
        ];

    drawTable(doc, {
      columns: [
        { label: "Month", width: 140, key: "month" },
        { label: "Mess Bill (Rs.)", width: 110, key: "messBill", align: "right" },
        { label: "GOI Sanctioned Amount", width: 125, key: "goi", align: "right" },
        { label: "Difference Amount Payable", width: 150, key: "difference", align: "right" },
      ],
      rows: [
        ...monthlyRows,
        {
          month: "Total",
          messBill: formatCurrency(entry.totals?.totalMessBill || 0),
          goi: formatCurrency(entry.totals?.totalScholarship || 0),
          difference: formatCurrency(entry.totals?.totalDifference || 0),
        },
      ],
      fontSize: 10,
    });

    if (index !== entries.length - 1) {
      doc.moveDown(0.8);
    }
  });

  drawSignatureBlock(doc, {
    signatures: [
      { label: "Caretaker" },
      { label: "Warden" },
      { label: "Dean and Chairman, Hostel Supervisory Committee" },
    ],
    footerDate: report.updatedAt || report.createdAt,
  });

  doc.end();
};

const downloadReportPdf = async (req, res) => {
  try {
    await EblReport.ensureIndexesReady();
    const report = await ensureReportAccess(req.params.id, req.user);
    const entries = await buildReportStudentEntries({
      hostelId: report.hostelId._id || report.hostelId,
      fromMonth: report.fromMonth,
      toMonth: report.toMonth,
    });

    if (!entries.length) {
      return res.status(404).json({ success: false, message: "No EBL period records found for this report." });
    }

    const contacts = await resolveReportContacts({
      hostelId: report.hostelId?._id || report.hostelId,
      caretakerUserId: report.generatedBy?._id || report.generatedBy,
      wardenUserId: report.approvedByWarden?._id || report.approvedByWarden,
    });

    if (report.reportType === "pre_receipt") {
      return renderPreReceiptPdf({ res, report, entries, contacts });
    }

    return renderMonthWisePdf({ res, report, entries, contacts });
  } catch (error) {
    logger.error("Download EBL report PDF error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

module.exports = {
  listPeriods,
  listReports,
  createPeriod,
  updatePeriod,
  getStudentEblStatus,
  generateReport,
  submitReport,
  approveReport,
  downloadReportPdf,
  REPORT_TYPE_LABELS,
};
