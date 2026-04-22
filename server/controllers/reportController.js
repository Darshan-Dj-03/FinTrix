const mongoose = require("mongoose");
const Report = require("../models/Report");
const Expense = require("../models/Expense");
const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const Hostel = require("../models/Hostel");
const {
  notifyReportStakeholders,
  notifyCaretakerApproval,
  notifyReportGeneratedInApp,
  notifyReportSubmittedInApp,
  notifyReportApprovedInApp,
} = require("../services/notificationService");
const { runInTransaction } = require("../utils/transaction");
const { createAuditLog } = require("../services/auditService");
const logger = require("../utils/logger");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const resolveHostelId = (req, providedHostelId) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }
  return providedHostelId || req.query.hostelId || req.body.hostelId || null;
};

const buildMonthlySnapshot = async (month, hostelFilter = null, session = null) => {
  const expenseMatch = { month };
  const billMatch = { month };
  const chargeMatch = { month };

  if (hostelFilter) {
    expenseMatch.hostelId = new mongoose.Types.ObjectId(hostelFilter);
    billMatch.hostelId = new mongoose.Types.ObjectId(hostelFilter);
    chargeMatch.hostelId = new mongoose.Types.ObjectId(hostelFilter);
  }

  const [expenseData] = await Expense.aggregate([
    { $match: expenseMatch },
    {
      $project: {
        monthExpense: {
          $add: [
            "$elp",
            "$cylinder",
            "$oil",
            "$kirana",
            "$milk",
            "$keb_total",
            "$labour_total",
            "$night_watch_total",
            "$bakery_total",
            "$banana_total",
          ],
        },
      },
    },
    { $group: { _id: null, total: { $sum: "$monthExpense" } } },
  ]).session(session);

  const [chargeData] = await Charge.aggregate([
    { $match: chargeMatch },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session);

  const [billedData] = await MessBill.aggregate([
    { $match: billMatch },
    { $group: { _id: null, total: { $sum: "$total_amount" } } },
  ]).session(session);

  const paymentPipeline = [
    { $match: { month, status: "paid" } },
  ];

  if (hostelFilter) {
    paymentPipeline.push({ $match: { hostelId: new mongoose.Types.ObjectId(hostelFilter) } });
  }

  paymentPipeline.push({ $group: { _id: null, total: { $sum: "$amount" } } });
  const paymentData = await Payment.aggregate(paymentPipeline).session(session);

  const hostelWiseBreakdown = await MessBill.aggregate([
    { $match: billMatch },
    {
      $group: {
        _id: "$hostelId",
        totalBilled: { $sum: "$total_amount" },
        totalStudents: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "hostels",
        localField: "_id",
        foreignField: "_id",
        as: "hostel",
      },
    },
    { $unwind: "$hostel" },
    {
      $project: {
        _id: 0,
        hostelId: "$_id",
        hostelName: "$hostel.name",
        totalBilled: 1,
        totalStudents: 1,
      },
    },
  ]).session(session);

  const studentWiseSummary = await MessBill.aggregate([
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
  ]).session(session);

  const totalExpenses = Number(expenseData?.total || 0) + Number(chargeData?.total || 0);
  const totalBilled = Number(billedData?.total || 0);
  const totalCollected = Number(paymentData[0]?.total || 0);
  const outstanding = totalBilled - totalCollected;

  return {
    totalExpenses,
    totalBilled,
    totalCollected,
    outstanding,
    hostelWiseBreakdown,
    studentWiseSummary,
    snapshot: {
      generatedAt: new Date(),
      expenses: {
        baseExpenses: Number(expenseData?.total || 0),
      },
      charges: {
        dynamicCharges: Number(chargeData?.total || 0),
      },
      payments: {
        collected: totalCollected,
      },
      totals: {
        totalExpenses,
        totalBilled,
        totalCollected,
        outstanding,
      },
    },
  };
};

const getReportByMonthAndScope = (month, hostelId, session = null) => {
  const query = Report.findOne({ month, hostelId }).populate([
    { path: "hostelId", select: "name type location" },
    { path: "generatedBy", select: "name username role" },
    { path: "submittedBy", select: "name username role" },
    { path: "approvedByWarden", select: "name username role" },
    { path: "approvedByDean", select: "name username role" },
  ]);

  if (session) {
    query.session(session);
  }

  return query;
};

const generateReport = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = req.user.hostelId;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found." });
    }

    const populated = await runInTransaction(async (session) => {
      const snapshot = await buildMonthlySnapshot(month, hostelId, session);
      let report = await Report.findOne({ month, hostelId }).session(session);

      if (report && report.status !== "draft") {
        const error = new Error("Report is already submitted or approved and cannot be regenerated.");
        error.status = 409;
        throw error;
      }

      if (!report) {
        [report] = await Report.create(
          [
            {
              month,
              hostelId,
              status: "draft",
              generatedBy: req.user._id,
              ...snapshot,
            },
          ],
          { session }
        );
      } else {
        report.generatedBy = req.user._id;
        report.totalExpenses = snapshot.totalExpenses;
        report.totalBilled = snapshot.totalBilled;
        report.totalCollected = snapshot.totalCollected;
        report.outstanding = snapshot.outstanding;
        report.hostelWiseBreakdown = snapshot.hostelWiseBreakdown;
        report.studentWiseSummary = snapshot.studentWiseSummary;
        report.snapshot = snapshot.snapshot;
        await report.save({ session });
      }

      await createAuditLog({
        action: "REPORT_GENERATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: report._id,
        entityType: "Report",
        metadata: {
          month,
          hostelId,
          totals: snapshot.snapshot.totals,
        },
        session,
      });

      return getReportByMonthAndScope(month, hostelId, session);
    });

    await notifyReportStakeholders({
      month,
      hostelId,
      triggeredByName: req.user.name,
      triggerLabel: "The main billing report has been generated",
    });
    await notifyReportGeneratedInApp({
      month,
      hostelId,
      reportName: "Main Billing Report",
      generatedByName: req.user.name,
      actor: req.user,
    });

    return res.status(201).json({
      success: true,
      message: "Report generated successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000 || error.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message || "Report already exists for this hostel and month.",
      });
    }
    logger.error("Generate report error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const submitReport = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = req.user.hostelId;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const report = await Report.findOne({ month, hostelId });
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    if (report.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft reports can be submitted.",
      });
    }

    const populated = await runInTransaction(async (session) => {
      const transactionalReport = await Report.findOne({ month, hostelId }).session(session);
      if (!transactionalReport) {
        const error = new Error("Report not found.");
        error.status = 404;
        throw error;
      }

      if (transactionalReport.status !== "draft") {
        const error = new Error("Only draft reports can be submitted.");
        error.status = 400;
        throw error;
      }

      transactionalReport.status = "submitted";
      transactionalReport.submittedBy = req.user._id;
      transactionalReport.submittedAt = new Date();
      await transactionalReport.save({ session });

      await createAuditLog({
        action: "REPORT_SUBMITTED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: transactionalReport._id,
        entityType: "Report",
        metadata: { month, hostelId },
        session,
      });

      return getReportByMonthAndScope(month, hostelId, session);
    });

    await notifyReportStakeholders({
      month,
      hostelId,
      triggeredByName: req.user.name,
      triggerLabel: "The main billing report has been submitted",
    });
    await notifyReportSubmittedInApp({
      month,
      hostelId,
      reportName: "Main Billing Report",
      submittedByName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Report submitted successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Submit report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const wardenApprove = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req, req.body.hostelId);
    const { notes } = req.body;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await Report.findOne({ month, hostelId });
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    if (report.status !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "Warden approval is allowed only after submission.",
      });
    }

    if (report.approvedByWarden) {
      return res.status(409).json({
        success: false,
        message: "Report already approved by warden.",
      });
    }

    const populated = await runInTransaction(async (session) => {
      const transactionalReport = await Report.findOne({ month, hostelId }).session(session);
      if (!transactionalReport) {
        const error = new Error("Report not found.");
        error.status = 404;
        throw error;
      }

      if (transactionalReport.status !== "submitted") {
        const error = new Error("Warden approval is allowed only after submission.");
        error.status = 400;
        throw error;
      }

      if (transactionalReport.approvedByWarden) {
        const error = new Error("Report already approved by warden.");
        error.status = 409;
        throw error;
      }

      transactionalReport.status = "warden_approved";
      transactionalReport.approvedByWarden = req.user._id;
      transactionalReport.wardenApprovedAt = new Date();
      if (notes) {
        transactionalReport.wardenNotes = notes;
      }
      await transactionalReport.save({ session });

      await createAuditLog({
        action: "REPORT_WARDEN_APPROVED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: transactionalReport._id,
        entityType: "Report",
        metadata: { month, hostelId, notes: notes || "" },
        session,
      });

      return getReportByMonthAndScope(month, hostelId, session);
    });

    await Promise.all([
      notifyReportStakeholders({
        month,
        hostelId,
        triggeredByName: req.user.name,
        triggerLabel: "The main billing report has been approved by the warden",
      }),
      notifyCaretakerApproval({
        month,
        hostelId,
        approverRole: "Warden",
        approverName: req.user.name,
        notes: notes || "",
      }),
      notifyReportApprovedInApp({
        month,
        hostelId,
        reportName: "Main Billing Report",
        approverRole: "warden",
        approverName: req.user.name,
        actor: req.user,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Report approved by warden successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Warden approval error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const deanApprove = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: "Dean approval is not required for the main billing report. Warden approval is the final step for this report.",
    });

    const { month } = req.params;
    const hostelId = resolveHostelId(req, req.body.hostelId);
    const { notes } = req.body;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await Report.findOne({ month, hostelId });
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    if (report.status !== "warden_approved") {
      return res.status(400).json({
        success: false,
        message: "Dean approval is allowed only after warden approval.",
      });
    }

    if (report.approvedByDean) {
      return res.status(409).json({
        success: false,
        message: "Report already approved by dean/admin.",
      });
    }

    const populated = await runInTransaction(async (session) => {
      const transactionalReport = await Report.findOne({ month, hostelId }).session(session);
      if (!transactionalReport) {
        const error = new Error("Report not found.");
        error.status = 404;
        throw error;
      }

      if (transactionalReport.status !== "warden_approved") {
        const error = new Error("Dean approval is allowed only after warden approval.");
        error.status = 400;
        throw error;
      }

      if (transactionalReport.approvedByDean) {
        const error = new Error("Report already approved by dean/admin.");
        error.status = 409;
        throw error;
      }

      transactionalReport.status = "dean_approved";
      transactionalReport.approvedByDean = req.user._id;
      transactionalReport.deanApprovedAt = new Date();
      if (notes) {
        transactionalReport.deanNotes = notes;
      }
      await transactionalReport.save({ session });

      await createAuditLog({
        action: "REPORT_DEAN_APPROVED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: transactionalReport._id,
        entityType: "Report",
        metadata: { month, hostelId, notes: notes || "" },
        session,
      });

      return getReportByMonthAndScope(month, hostelId, session);
    });

    await Promise.all([
      notifyReportStakeholders({
        month,
        hostelId,
        triggeredByName: req.user.name,
        triggerLabel: "The main billing report has been approved by the dean/admin",
      }),
      notifyCaretakerApproval({
        month,
        hostelId,
        approverRole: "Dean/Admin",
        approverName: req.user.name,
        notes: notes || "",
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Report approved by dean/admin successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Dean approval error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const getReportStatus = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req, req.query.hostelId);

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await getReportByMonthAndScope(month, hostelId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Report status fetched successfully.",
      data: {
        month: report.month,
        hostelId: report.hostelId,
        status: report.status,
        submittedAt: report.submittedAt,
        wardenApprovedAt: report.wardenApprovedAt,
        deanApprovedAt: report.deanApprovedAt,
      },
    });
  } catch (error) {
    console.error("Get report status error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getFullMonthlyReport = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req, req.query.hostelId);

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const report = hostelId ? await Report.findOne({ month, hostelId }) : null;
    const snapshot = report ? report.toObject() : await buildMonthlySnapshot(month, hostelId || null);

    return res.status(200).json({
      success: true,
      message: "Full monthly report fetched successfully.",
      data: {
        month,
        hostelId: hostelId || null,
        ...snapshot,
        generatedAt: report?.snapshot?.generatedAt || new Date(),
      },
    });
  } catch (error) {
    logger.error("Get full report error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  generateReport,
  submitReport,
  wardenApprove,
  deanApprove,
  getReportStatus,
  getFullMonthlyReport,
};
