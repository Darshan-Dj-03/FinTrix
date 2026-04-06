const mongoose = require("mongoose");
const Report = require("../models/Report");
const Expense = require("../models/Expense");
const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const Hostel = require("../models/Hostel");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const resolveHostelId = (req, providedHostelId) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }
  return providedHostelId || req.query.hostelId || req.body.hostelId || null;
};

const buildMonthlySnapshot = async (month, hostelFilter = null) => {
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
  ]);

  const [chargeData] = await Charge.aggregate([
    { $match: chargeMatch },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const [billedData] = await MessBill.aggregate([
    { $match: billMatch },
    { $group: { _id: null, total: { $sum: "$total_amount" } } },
  ]);

  const paymentPipeline = [
    { $match: { month } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
  ];

  if (hostelFilter) {
    paymentPipeline.push({
      $match: { "user.hostelId": new mongoose.Types.ObjectId(hostelFilter) },
    });
  }

  paymentPipeline.push({ $group: { _id: null, total: { $sum: "$amountPaid" } } });
  const paymentData = await Payment.aggregate(paymentPipeline);

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
  ]);

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
  ]);

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
  };
};

const getReportByMonthAndScope = async (month, hostelId) =>
  Report.findOne({ month, hostelId }).populate([
    { path: "hostelId", select: "name type location" },
    { path: "generatedBy", select: "name username role" },
    { path: "submittedBy", select: "name username role" },
    { path: "approvedByWarden", select: "name username role" },
    { path: "approvedByDean", select: "name username role" },
  ]);

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

    const snapshot = await buildMonthlySnapshot(month, hostelId);
    let report = await Report.findOne({ month, hostelId });

    if (report && report.status !== "draft") {
      return res.status(409).json({
        success: false,
        message: "Report is already submitted or approved and cannot be regenerated.",
      });
    }

    if (!report) {
      report = await Report.create({
        month,
        hostelId,
        status: "draft",
        generatedBy: req.user._id,
        ...snapshot,
      });
    } else {
      report.generatedBy = req.user._id;
      report.totalExpenses = snapshot.totalExpenses;
      report.totalBilled = snapshot.totalBilled;
      report.totalCollected = snapshot.totalCollected;
      report.outstanding = snapshot.outstanding;
      report.hostelWiseBreakdown = snapshot.hostelWiseBreakdown;
      report.studentWiseSummary = snapshot.studentWiseSummary;
      await report.save();
    }

    const populated = await getReportByMonthAndScope(month, hostelId);
    return res.status(201).json({
      success: true,
      message: "Report generated successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Report already exists for this hostel and month.",
      });
    }
    console.error("Generate report error:", error);
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

    report.status = "submitted";
    report.submittedBy = req.user._id;
    report.submittedAt = new Date();
    await report.save();

    const populated = await getReportByMonthAndScope(month, hostelId);
    return res.status(200).json({
      success: true,
      message: "Report submitted successfully.",
      data: populated,
    });
  } catch (error) {
    console.error("Submit report error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
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

    report.status = "warden_approved";
    report.approvedByWarden = req.user._id;
    report.wardenApprovedAt = new Date();
    if (notes) {
      report.wardenNotes = notes;
    }
    await report.save();

    const populated = await getReportByMonthAndScope(month, hostelId);
    return res.status(200).json({
      success: true,
      message: "Report approved by warden successfully.",
      data: populated,
    });
  } catch (error) {
    console.error("Warden approval error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const deanApprove = async (req, res) => {
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

    report.status = "dean_approved";
    report.approvedByDean = req.user._id;
    report.deanApprovedAt = new Date();
    if (notes) {
      report.deanNotes = notes;
    }
    await report.save();

    const populated = await getReportByMonthAndScope(month, hostelId);
    return res.status(200).json({
      success: true,
      message: "Report approved by dean/admin successfully.",
      data: populated,
    });
  } catch (error) {
    console.error("Dean approval error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
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

    const snapshot = await buildMonthlySnapshot(month, hostelId || null);

    return res.status(200).json({
      success: true,
      message: "Full monthly report fetched successfully.",
      data: {
        month,
        hostelId: hostelId || null,
        ...snapshot,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Get full report error:", error);
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
