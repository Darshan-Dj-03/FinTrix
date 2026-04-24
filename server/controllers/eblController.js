const mongoose = require("mongoose");

const Student = require("../models/Student");
const MessBill = require("../models/MessBill");
const EblPeriod = require("../models/EblPeriod");
const EblReport = require("../models/EblCategoryReport");
const Report = require("../models/Report");
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
    select: "studentId gender isEBL isActive",
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
  university_claim: "EBL University Claim Report",
  university_claim_month_wise: "EBL University Claim Month-wise Report",
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
  const storedDetails = new Map(
    (period.monthlyDetails || []).map((detail) => [detail.month, detail])
  );

  return selectedMonths.map((month) => {
    const stored = storedDetails.get(month);
    const messBillAmount = roundMoney(Number(stored?.messBillAmount || 0));
    const goiAmount = roundMoney(
      stored?.goiAmount !== undefined ? Number(stored.goiAmount || 0) : 0
    );
    const shouldIgnoreLegacyClaimedAmount =
      period.universityClaimAmount === undefined &&
      stored?.claimedAmount !== undefined &&
      roundMoney(Number(stored?.claimedAmount || 0)) === goiAmount;
    const claimedAmount = roundMoney(
      shouldIgnoreLegacyClaimedAmount ? 0 : Number(stored?.claimedAmount || 0)
    );
    const differenceAmount = roundMoney(messBillAmount - goiAmount);
    const studentPaidAmount = roundMoney(Number(stored?.studentPaidAmount || 0));
    const remainingBalance = roundMoney(Math.max(differenceAmount - claimedAmount - studentPaidAmount, 0));
    const paymentStatus =
      remainingBalance <= 0
        ? "paid"
        : claimedAmount > 0
          ? "partial_university_claim_received"
          : goiAmount > 0
            ? "partial_scholarship_received"
            : stored?.paymentStatus || "ebl";

    return {
      month,
      messBillAmount,
      goiAmount,
      claimedAmount,
      differenceAmount,
      studentPaidAmount,
      remainingBalance,
      paymentStatus,
      billId: stored?.billId || null,
    };
  });
};

const buildPeriodTotals = (monthlyDetails = [], goiAmount = 0) => {
  const totalMessBill = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.messBillAmount || 0), 0)
  );
  const totalScholarship = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.goiAmount || 0), 0)
  );
  const totalClaimedAmount = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.claimedAmount || 0), 0)
  );
  const totalDifference = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.differenceAmount || 0), 0)
  );
  const totalStudentPaid = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.studentPaidAmount || 0), 0)
  );
  const totalRemainingBalance = roundMoney(
    monthlyDetails.reduce((sum, item) => sum + Number(item.remainingBalance || 0), 0)
  );

  return {
    totalMessBill,
    totalScholarship,
    totalClaimedAmount,
    totalDifference,
    totalStudentPaid,
    totalRemainingBalance,
    totalClaimAmount: roundMoney(Math.max(totalDifference - totalClaimedAmount, 0)),
  };
};

const allocateByWeights = (total, weights = []) => {
  const normalizedTotal = roundMoney(Math.max(Number(total || 0), 0));
  const normalizedWeights = weights.map((weight) => roundMoney(Math.max(Number(weight || 0), 0)));
  const totalWeight = roundMoney(normalizedWeights.reduce((sum, value) => sum + value, 0));

  if (!normalizedTotal || !totalWeight) {
    return normalizedWeights.map(() => 0);
  }

  const cappedTotal = Math.min(normalizedTotal, totalWeight);
  const allocations = normalizedWeights.map(() => 0);
  let remainingTotal = cappedTotal;
  let remainingWeight = totalWeight;

  normalizedWeights.forEach((weight, index) => {
    if (!weight || remainingTotal <= 0) {
      return;
    }

    let share =
      index === normalizedWeights.length - 1
        ? remainingTotal
        : roundMoney((remainingTotal * weight) / remainingWeight);

    share = Math.min(share, weight, remainingTotal);
    allocations[index] = share;
    remainingTotal = roundMoney(remainingTotal - share);
    remainingWeight = roundMoney(Math.max(remainingWeight - weight, 0));
  });

  if (remainingTotal > 0) {
    for (let index = 0; index < allocations.length && remainingTotal > 0; index += 1) {
      const capacity = roundMoney(normalizedWeights[index] - allocations[index]);
      if (capacity <= 0) {
        continue;
      }
      const extra = Math.min(capacity, remainingTotal);
      allocations[index] = roundMoney(allocations[index] + extra);
      remainingTotal = roundMoney(remainingTotal - extra);
    }
  }

  return allocations;
};

const buildSettlementMap = (monthlySettlements = []) =>
  new Map(
    (Array.isArray(monthlySettlements) ? monthlySettlements : [])
      .filter((item) => item && item.month)
      .map((item) => [item.month, Math.max(roundMoney(Number(item.studentPaidAmount || 0)), 0)])
  );

const refreshMonthlyReportSnapshot = async ({ month, hostelId, session = null }) => {
  const existingReportQuery = Report.findOne({ month, hostelId });
  if (session) {
    existingReportQuery.session(session);
  }

  const existingReport = await existingReportQuery;
  if (!existingReport) {
    return;
  }

  const billMatch = {
    month,
    hostelId: new mongoose.Types.ObjectId(hostelId),
  };

  const [[billedData], [collectedData], studentWiseSummary] = await Promise.all([
    MessBill.aggregate([
      { $match: billMatch },
      { $group: { _id: null, total: { $sum: "$total_amount" } } },
    ]).session(session),
    MessBill.aggregate([
      { $match: billMatch },
      { $group: { _id: null, total: { $sum: "$amount_paid" } } },
    ]).session(session),
    MessBill.aggregate([
      { $match: billMatch },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          studentId: "$student._id",
          studentCode: "$student.studentId",
          name: "$user.name",
          billAmount: "$total_amount",
          paymentStatus: "$payment_status",
        },
      },
      { $sort: { name: 1 } },
    ]).session(session),
  ]);

  const totalBilled = Number(billedData?.total || 0);
  const totalCollected = Number(collectedData?.total || 0);

  existingReport.totalBilled = totalBilled;
  existingReport.totalCollected = totalCollected;
  existingReport.outstanding = Math.max(totalBilled - totalCollected, 0);
  existingReport.studentWiseSummary = studentWiseSummary;
  existingReport.snapshot = {
    ...(existingReport.snapshot || {}),
    payments: {
      ...((existingReport.snapshot || {}).payments || {}),
      collected: totalCollected,
    },
    totals: {
      ...((existingReport.snapshot || {}).totals || {}),
      totalBilled,
      totalCollected,
      outstanding: Math.max(totalBilled - totalCollected, 0),
    },
  };

  await existingReport.save({ session });
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

const resolveMonthlyDetails = async ({
  student,
  fromMonth,
  toMonth,
  goiAmount = 0,
  universityClaimAmount = 0,
  existingDetails = [],
  session = null,
}) => {
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
  const existingDetailMap = new Map((existingDetails || []).map((detail) => [detail.month, detail]));
  const baseRows = months.map((month) => {
    const bill = billMap.get(month);
    const messBillAmount = roundMoney(Number(bill?.total_amount || 0));
    const share = roundMoney(monthlyShare);
    const differenceAmount = roundMoney(Math.max(messBillAmount - share, 0));

    return {
      month,
      billId: bill?._id || null,
      messBillAmount,
      goiAmount: share,
      differenceAmount,
    };
  });
  const totalDifference = roundMoney(baseRows.reduce((sum, row) => sum + Number(row.differenceAmount || 0), 0));
  const appliedUniversityClaim = Math.min(roundMoney(Number(universityClaimAmount || 0)), totalDifference);
  const monthlyClaims = allocateByWeights(
    appliedUniversityClaim,
    baseRows.map((row) => row.differenceAmount)
  );

  return baseRows.map((row, index) => {
    const previousDetail = existingDetailMap.get(row.month);
    const claimedAmount = roundMoney(monthlyClaims[index] || 0);
    const studentPaidAmount = roundMoney(Number(previousDetail?.studentPaidAmount || 0));
    const remainingBalance = roundMoney(
      Math.max(row.differenceAmount - claimedAmount - studentPaidAmount, 0)
    );
    const paymentStatus =
      remainingBalance <= 0
        ? "paid"
        : claimedAmount > 0
          ? "partial_university_claim_received"
          : row.goiAmount > 0
            ? "partial_scholarship_received"
            : "ebl";

    return {
      month: row.month,
      messBillAmount: row.messBillAmount,
      goiAmount: row.goiAmount,
      claimedAmount,
      differenceAmount: row.differenceAmount,
      studentPaidAmount,
      remainingBalance,
      paymentStatus,
      billId: row.billId,
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
  const affectedMonths = new Set();
  const detailMap = new Map((period.monthlyDetails || []).map((detail) => [String(detail.billId || ""), detail]));

  for (const bill of coveredBills) {
    const detail = detailMap.get(String(bill._id));
    const claimedAmount = roundMoney(Number(detail?.claimedAmount || 0));
    const differenceAmount = roundMoney(Number(detail?.differenceAmount || 0));
    const studentPaidAmount = roundMoney(Number(detail?.studentPaidAmount || 0));
    const remainingBalance = roundMoney(Math.max(Number(detail?.remainingBalance || 0), 0));
    const goiAmount = roundMoney(Number(detail?.goiAmount || 0));
    const paymentStatus =
      remainingBalance <= 0
        ? "paid"
        : claimedAmount > 0
          ? "partial_university_claim_received"
          : goiAmount > 0
            ? "partial_scholarship_received"
            : "ebl";

    bill.manual_fine = 0;
    bill.fine = 0;
    bill.amount_paid = roundMoney(claimedAmount + studentPaidAmount);
    bill.payment_status = paymentStatus;
    bill.ebl_claimed_amount = claimedAmount;
    bill.ebl_difference_amount = differenceAmount;
    bill.ebl_student_paid_amount = studentPaidAmount;
    bill.ebl_remaining_balance = remainingBalance;
    if (normalizedPeriodUtr && !bill.student_utr_number) {
      bill.student_utr_number = bill.student_utr_number || "";
    }
    await bill.save({ session });
    affectedMonths.add(bill.month);
  }

  for (const month of affectedMonths) {
    await refreshMonthlyReportSnapshot({
      month,
      hostelId: period.hostelId?._id || period.hostelId,
      session,
    });
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
        universityClaimAmount: 0,
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
            universityClaimAmount: 0,
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
    const { monthlyGoiAmount, universityClaimAmount, periodUtr, scholarshipNotes } = req.body;

    const updated = await runInTransaction(async (session) => {
      const period = await EblPeriod.findById(id).populate(POPULATE_EBL_PERIOD).session(session);
      if (!period) {
        const error = new Error("EBL period not found.");
        error.status = 404;
        throw error;
      }

      if (req.user.role === "caretaker") {
        if (String(period.hostelId._id || period.hostelId) !== String(req.user.hostelId)) {
          const error = new Error("You can only update EBL periods for your hostel.");
          error.status = 403;
          throw error;
        }
      } else if (req.user.role === "student") {
        const periodStudentUserId = String(period.userId?._id || period.userId);
        if (periodStudentUserId !== String(req.user._id)) {
          const error = new Error("You can only update your own EBL periods.");
          error.status = 403;
          throw error;
        }
        if (period.status !== "draft") {
          const error = new Error("This EBL claim has already been accepted by the caretaker and can no longer be edited.");
          error.status = 400;
          throw error;
        }
      }

      const student = await ensureStudentAccess(period.studentId._id || period.studentId, req.user, session);
      const nextGoiAmount =
        monthlyGoiAmount !== undefined ? Number(monthlyGoiAmount || 0) : Number(period.monthlyGoiAmount || 0);
      const nextUniversityClaimAmount =
        universityClaimAmount !== undefined
          ? Number(universityClaimAmount || 0)
          : Number(period.universityClaimAmount || 0);

      if (nextGoiAmount < 0) {
        const error = new Error("GOI sanctioned amount cannot be negative.");
        error.status = 400;
        throw error;
      }

      if (nextUniversityClaimAmount < 0) {
        const error = new Error("Amount claimed from university cannot be negative.");
        error.status = 400;
        throw error;
      }

      const monthlyDetails = await resolveMonthlyDetails({
        student,
        fromMonth: period.fromMonth,
        toMonth: period.toMonth,
        goiAmount: nextGoiAmount,
        universityClaimAmount: nextUniversityClaimAmount,
        existingDetails: period.monthlyDetails || [],
        session,
      });

      period.monthlyGoiAmount = nextGoiAmount;
      period.universityClaimAmount = nextUniversityClaimAmount;
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
          universityClaimAmount: period.universityClaimAmount,
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

const verifyPeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const verifiedPeriod = await runInTransaction(async (session) => {
      const period = await EblPeriod.findById(id).populate(POPULATE_EBL_PERIOD).session(session);
      if (!period) {
        const error = new Error("EBL period not found.");
        error.status = 404;
        throw error;
      }

      if (String(period.hostelId?._id || period.hostelId) !== String(req.user.hostelId)) {
        const error = new Error("You can only verify EBL periods for your hostel.");
        error.status = 403;
        throw error;
      }

      if (period.status !== "draft") {
        const error = new Error("Only submitted draft EBL claims can be accepted.");
        error.status = 400;
        throw error;
      }

      period.status = "verified";
      period.verifiedBy = req.user._id;
      period.verifiedAt = new Date();
      period.updatedBy = req.user._id;
      await period.save({ session });

      await createAuditLog({
        action: "EBL_PERIOD_VERIFIED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: period._id,
        entityType: "EblPeriod",
        metadata: {
          studentId: period.studentId?._id || period.studentId,
          hostelId: period.hostelId?._id || period.hostelId,
          fromMonth: period.fromMonth,
          toMonth: period.toMonth,
        },
        session,
      });

      return EblPeriod.findById(period._id).populate(POPULATE_EBL_PERIOD).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "EBL claim accepted successfully.",
      data: withEffectiveTotals(verifiedPeriod),
    });
  } catch (error) {
    logger.error("Verify EBL period error", { error: error.message, stack: error.stack });
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
      acc.totalUniversityClaim = roundMoney(
        acc.totalUniversityClaim + Number(period.totals?.totalClaimedAmount || 0)
      );
      acc.totalRemainingBalance = roundMoney(
        acc.totalRemainingBalance + Number(period.totals?.totalRemainingBalance || 0)
      );
      return acc;
    },
    {
      totalStudents: 0,
      totalMessBill: 0,
      totalScholarship: 0,
      totalDifference: 0,
      totalUniversityClaim: 0,
      totalRemainingBalance: 0,
    }
  );

const generateReport = async (req, res) => {
  try {
    await EblReport.ensureIndexesReady();
    const { reportType, fromMonth, toMonth } = req.body;
    if (!["pre_receipt", "month_wise", "university_claim", "university_claim_month_wise"].includes(reportType)) {
      return res.status(400).json({ success: false, message: "reportType must be pre_receipt, month_wise, university_claim, or university_claim_month_wise." });
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
          totalUniversityClaim: roundMoney(totals.totalUniversityClaim),
          totalRemainingBalance: roundMoney(totals.totalRemainingBalance),
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
        `${entry.studentId?.studentId || "-"} ${entry.userId?.name || "Student"}`,
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

const renderUniversityClaimPdf = ({ res, report, entries, contacts }) => {
  const periodLabel = `${report.fromMonth} to ${report.toMonth}`;
  const doc = createPdfDocument(res, `ebl-university-claim-${report.fromMonth}-to-${report.toMonth}.pdf`, {
    size: "A4",
    layout: "landscape",
    margin: 28,
  });

  const renderHeader = () =>
    drawUniversityHeader(doc, {
      reportTitle: "University Claim Statement",
      hostelName: report.hostelId?.name || "Hostel",
      month: periodLabel,
      generatedBy: report.generatedBy?.name || "Caretaker",
      generatedAt: report.updatedAt || report.createdAt,
      officeLabel: "EBL University Claim Reconciliation",
    });

  renderHeader();
  drawContactDetailsBlock(doc, contacts);

  drawTable(doc, {
    columns: [
      { label: "Sl. No.", width: 34, key: "serial", align: "center" },
      { label: "Student Name", width: 124, key: "name" },
      { label: "ID No.", width: 78, key: "studentId" },
      { label: "Period", width: 96, key: "period" },
      { label: "Bill Amount", width: 74, key: "messBill", align: "right" },
      { label: "GOI Amount", width: 72, key: "goi", align: "right" },
      { label: "Difference", width: 76, key: "difference", align: "right" },
      { label: "University Claim", width: 84, key: "claim", align: "right", headerFontSize: 8.4 },
      { label: "Balance Amount", width: 88, key: "remaining", align: "right" },
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
        claim: formatCurrency(entry.totals?.totalClaimedAmount || 0),
        remaining: formatCurrency(entry.totals?.totalRemainingBalance || 0),
      })),
      {
        serial: "",
        name: "Grand Total",
        studentId: "",
        period: periodLabel,
        messBill: formatCurrency(report.totalMessBill || 0),
        goi: formatCurrency(report.totalScholarship || 0),
        difference: formatCurrency(report.totalDifference || 0),
        claim: formatCurrency(report.totalUniversityClaim || 0),
        remaining: formatCurrency(report.totalRemainingBalance || 0),
      },
    ],
    fontSize: 8.2,
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

const renderUniversityClaimMonthWisePdf = ({ res, report, entries, contacts }) => {
  const periodLabel = `${report.fromMonth} to ${report.toMonth}`;
  const doc = createPdfDocument(res, `ebl-university-claim-month-wise-${report.fromMonth}-to-${report.toMonth}.pdf`, {
    size: "A4",
    layout: "portrait",
    margin: 28,
  });

  const renderHeader = () =>
    drawUniversityHeader(doc, {
      reportTitle: "University Claim Month-wise Statement",
      hostelName: report.hostelId?.name || "Hostel",
      month: periodLabel,
      generatedBy: report.generatedBy?.name || "Caretaker",
      generatedAt: report.updatedAt || report.createdAt,
      officeLabel: "EBL University Claim Reconciliation Register",
    });

  renderHeader();
  drawContactDetailsBlock(doc, contacts);

  entries.forEach((entry, index) => {
    drawSectionHeading(doc, `${entry.studentId?.studentId || "-"} ${entry.userId?.name || "Student"}`);

    const monthlyRows = entry.monthlyDetails?.length
      ? entry.monthlyDetails.map((detail) => ({
          month: detail.month.replace("-", " "),
          messBill: formatCurrency(detail.messBillAmount),
          goi: formatCurrency(detail.goiAmount),
          difference: formatCurrency(detail.differenceAmount),
          claim: formatCurrency(detail.claimedAmount),
          remaining: formatCurrency(detail.remainingBalance),
        }))
      : [
          {
            month: periodLabel,
            messBill: formatCurrency(0),
            goi: formatCurrency(0),
            difference: formatCurrency(0),
            claim: formatCurrency(0),
            remaining: formatCurrency(0),
          },
        ];

    drawTable(doc, {
      columns: [
        { label: "Month", width: 78, key: "month" },
        { label: "Mess Bill", width: 82, key: "messBill", align: "right" },
        { label: "GOI Amount", width: 78, key: "goi", align: "right" },
        { label: "Difference", width: 78, key: "difference", align: "right" },
        { label: "University Claim", width: 92, key: "claim", align: "right", headerFontSize: 8.6 },
        { label: "Balance Amount", width: 88, key: "remaining", align: "right" },
      ],
      rows: [
        ...monthlyRows,
        {
          month: "Total",
          messBill: formatCurrency(entry.totals?.totalMessBill || 0),
          goi: formatCurrency(entry.totals?.totalScholarship || 0),
          difference: formatCurrency(entry.totals?.totalDifference || 0),
          claim: formatCurrency(entry.totals?.totalClaimedAmount || 0),
          remaining: formatCurrency(entry.totals?.totalRemainingBalance || 0),
        },
      ],
      fontSize: 8.8,
      rowPadding: 5,
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

    if (report.reportType === "university_claim") {
      return renderUniversityClaimPdf({ res, report, entries, contacts });
    }

    if (report.reportType === "university_claim_month_wise") {
      return renderUniversityClaimMonthWisePdf({ res, report, entries, contacts });
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
  verifyPeriod,
  getStudentEblStatus,
  generateReport,
  submitReport,
  approveReport,
  downloadReportPdf,
  REPORT_TYPE_LABELS,
};
