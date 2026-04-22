const mongoose = require("mongoose");

const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const { buildReportSource } = require("../services/monthlyExpenseReportService");
const {
  syncMonthlyExpenseReport,
  syncBillDependentArtifacts,
} = require("./hostelExpenseController");
const {
  notifyReportStakeholders,
  notifyCaretakerApproval,
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
  drawSummaryPanel,
  drawSignatureBlock,
  ensureSpace,
  formatCurrency,
} = require("../utils/pdfLayout");
const { resolveReportContacts } = require("../utils/reportContacts");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const drawDeanSubmissionBlock = (doc, { month, redrawHeader }) => {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  ensureSpace(doc, 170, redrawHeader);

  const lines = [
    "To,",
    "    Dean Students Welfare,",
    "    University of Horticultural Sciences,",
    "    Bagalkot",
    "",
    "[Through Proper Channel]",
    "",
    "Sir,",
    "",
    `Sub: Submission of Total Monthly Expenditure Report for ${month} ...reg.`,
    "",
    `With reference to the above subject, I am herewith submitting the total monthly expenditure report for ${month} for your kind information and needful.`,
  ];

  lines.forEach((line) => {
    if (!line) {
      doc.moveDown(0.22);
      return;
    }

    if (line === "[Through Proper Channel]") {
      doc.font("Times-Bold").fontSize(12).fillColor("#111827").text(line, left, doc.y, {
        width,
        align: "center",
      });
      return;
    }

    doc.font("Times-Roman").fontSize(12).fillColor("#111827").text(line, left, doc.y, {
      width,
      align: line.startsWith("Sub:") ? "center" : "left",
    });
  });

  doc.moveDown(0.4);
};

const populateConfig = [
  { path: "hostelId", select: "name type location" },
  { path: "generatedBy", select: "name email username role" },
  {
    path: "hostelExpenseId",
    select:
      "month kirani oil milling veg milk cylinder elp chicken_total_misc paneer_total egg_total banana bakery",
  },
];

const resolveHostelId = (req) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }

  return req.query.hostelId || req.body.hostelId || null;
};

const getReportSource = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const source = await buildReportSource(hostelId, month);
    const existingReport = await MonthlyExpenseReport.findOne({ hostelId, month });

    return res.status(200).json({
      success: true,
      message: "Monthly expense report source fetched successfully.",
      data: {
        month,
        hostel: source.hostelExpense.hostelId,
        previousMonth: source.previousMonth,
        previousReportExists: false,
        requiresManualClosingBalance: true,
        existingReport: existingReport
          ? {
              id: existingReport._id,
              status: existingReport.status,
              opening_balance: existingReport.opening_balance,
              guest_charges: existingReport.guest_charges,
              closing_balance_last_month: existingReport.closing_balance_last_month,
              total_closing_balance: existingReport.total_closing_balance,
              total_opening_balance: existingReport.total_opening_balance,
              total_expenditure: existingReport.total_expenditure,
              mess_bill_per_day: existingReport.mess_bill_per_day,
            }
          : null,
        values: {
          msc_breakdown: source.msc_breakdown,
          msc_total: source.msc_total,
          other_misc_breakdown: source.other_misc_breakdown,
          other_misc: source.other_misc,
          guest_charge_breakdown: source.guest_charge_breakdown,
          guest_charge_total: source.guest_charge_total,
          electricity_bill: source.electricity_bill,
          internet: source.internet,
          labour_payment: source.labour_payment,
          total_students: source.total_students,
          total_boys: source.total_boys,
          total_girls: source.total_girls,
          days_in_month: source.daysInMonth,
          total_days: source.total_days,
          closing_balance_last_month: 0,
        },
      },
    });
  } catch (error) {
    logger.error("Get monthly expense report source error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const generateMonthlyExpenseReport = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);
    const opening_balance = Number(req.body.opening_balance || 0);
    const manual_closing_balance = Number(req.body.closing_balance_last_month || 0);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const existing = await MonthlyExpenseReport.findOne({ hostelId, month });
    if (existing && existing.status !== "draft") {
      return res.status(409).json({
        success: false,
        message: "Monthly expense report is already submitted or approved and cannot be updated.",
      });
    }

    if (manual_closing_balance < 0) {
      return res.status(400).json({
        success: false,
        message: "closing_balance_last_month must be zero or greater.",
      });
    }

    const report = await syncMonthlyExpenseReport({
      hostelId,
      month,
      userId: req.user._id,
      openingBalance: opening_balance,
      manualClosingBalance: manual_closing_balance,
    });
    await syncBillDependentArtifacts({
      hostelId,
      month,
      userId: req.user._id,
    });

    const populated = await MonthlyExpenseReport.findById(report._id).populate(populateConfig);

    await notifyReportStakeholders({
      month,
      hostelId,
      triggeredByName: req.user.name,
      triggerLabel: existing
        ? "The monthly expenditure report has been updated"
        : "The monthly expenditure report has been generated",
    });
    await notifyReportGeneratedInApp({
      month,
      hostelId,
      reportName: "Monthly Expenditure Report",
      generatedByName: req.user.name,
      actor: req.user,
    });

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing
        ? "Monthly expenditure report updated successfully."
        : "Monthly expenditure report generated successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Monthly expense report already exists for this hostel and month.",
      });
    }

    logger.error("Generate monthly expense report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const getReportByMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await MonthlyExpenseReport.findOne({ hostelId, month }).populate(populateConfig);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Monthly expense report not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Monthly expenditure report fetched successfully.",
      data: report,
    });
  } catch (error) {
    logger.error("Get monthly expense report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const getAllReports = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "caretaker") {
      filter.hostelId = req.user.hostelId;
    } else if (req.query.hostelId) {
      filter.hostelId = req.query.hostelId;
    }

    const reports = await MonthlyExpenseReport.find(filter)
      .populate(populateConfig)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Monthly expenditure reports fetched successfully.",
      data: reports,
    });
  } catch (error) {
    logger.error("List monthly expense reports error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const submitMonthlyExpenseReport = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await MonthlyExpenseReport.findOne({ hostelId, month });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Monthly expense report not found.",
      });
    }

    if (report.status === "submitted") {
      return res.status(200).json({
        success: true,
        message: "Total monthly expenditure report already submitted.",
        data: report,
      });
    }

    report.status = "submitted";
    report.submittedAt = new Date();
    report.submittedBy = req.user._id;
    await report.save();

    const populated = await MonthlyExpenseReport.findById(report._id).populate(populateConfig);

    await notifyReportStakeholders({
      month,
      hostelId,
      triggeredByName: req.user.name,
      triggerLabel: "The monthly expenditure report has been submitted",
    });
    await notifyReportSubmittedInApp({
      month,
      hostelId,
      reportName: "Monthly Expenditure Report",
      submittedByName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Total monthly expenditure report submitted successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Submit monthly expense report error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const approveMonthlyExpenseReportByWarden = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);
    const { notes } = req.body;

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await MonthlyExpenseReport.findOne({ hostelId, month });
    if (!report) {
      return res.status(404).json({ success: false, message: "Monthly expense report not found." });
    }

    if (report.status !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "Warden approval is allowed only after submission.",
      });
    }

    report.status = "warden_approved";
    report.approvedByWarden = req.user._id;
    report.wardenApprovedAt = new Date();
    report.wardenNotes = notes || "";
    await report.save();

    const populated = await MonthlyExpenseReport.findById(report._id).populate(populateConfig);

    await Promise.all([
      notifyReportStakeholders({
        month,
        hostelId,
        triggeredByName: req.user.name,
        triggerLabel: "The monthly expenditure report has been approved by the warden",
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
        reportName: "Monthly Expenditure Report",
        approverRole: "warden",
        approverName: req.user.name,
        actor: req.user,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Total monthly expenditure report approved by warden successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Approve monthly expense report by warden error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const approveMonthlyExpenseReportByDean = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);
    const { notes } = req.body;

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await MonthlyExpenseReport.findOne({ hostelId, month });
    if (!report) {
      return res.status(404).json({ success: false, message: "Monthly expense report not found." });
    }

    if (report.status !== "warden_approved") {
      return res.status(400).json({
        success: false,
        message: "Dean approval is allowed only after warden approval.",
      });
    }

    report.status = "dean_approved";
    report.approvedByDean = req.user._id;
    report.deanApprovedAt = new Date();
    report.deanNotes = notes || "";
    await report.save();

    const populated = await MonthlyExpenseReport.findById(report._id).populate(populateConfig);

    await Promise.all([
      notifyReportStakeholders({
        month,
        hostelId,
        triggeredByName: req.user.name,
        triggerLabel: "The monthly expenditure report has been approved by the dean/admin",
      }),
      notifyCaretakerApproval({
        month,
        hostelId,
        approverRole: "Dean/Admin",
        approverName: req.user.name,
        notes: notes || "",
      }),
      notifyReportApprovedInApp({
        month,
        hostelId,
        reportName: "Monthly Expenditure Report",
        approverRole: "dean",
        approverName: req.user.name,
        actor: req.user,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Total monthly expenditure report approved by dean/admin successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Approve monthly expense report by dean error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const downloadReportPdf = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const report = await MonthlyExpenseReport.findOne({ hostelId, month })
      .populate("hostelId", "name type location")
      .populate("generatedBy", "name");

    if (!report) {
      return res.status(404).json({ success: false, message: "Monthly expense report not found." });
    }

    const source = await buildReportSource(hostelId, month);
    const contacts = await resolveReportContacts({
      hostelId: report.hostelId?._id || report.hostelId,
      caretakerUserId: report.generatedBy?._id || report.generatedBy,
    });
    const doc = createPdfDocument(res, `monthly-expenditure-report-${report.month}.pdf`);

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "MONTHLY EXPENDITURE REPORT",
        hostelName: report.hostelId?.name || "-",
        month: report.month,
        generatedBy: report.generatedBy?.name || "-",
        generatedAt: report.createdAt,
        officeLabel: "Office of the Chief Warden",
      });

    renderHeader();
    drawContactDetailsBlock(doc, contacts);

    drawDeanSubmissionBlock(doc, {
      month: report.month,
    });

    drawSummaryPanel(doc, {
      title: "Report Summary",
      items: [
        { label: "MSC Total", value: formatCurrency(report.msc_total) },
        { label: "Closing Balance Last Month", value: formatCurrency(report.closing_balance_last_month) },
        { label: "Guest Charges", value: formatCurrency(report.guest_charges) },
        { label: "Total Expenditure", value: formatCurrency(report.total_expenditure) },
        { label: "Mess Bill Per Day", value: formatCurrency(report.mess_bill_per_day) },
      ],
    });

    drawSectionHeading(doc, "Main Service Cost (MSC) Breakdown");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        ...Object.entries(source.msc_breakdown).map(([key, value]) => ({
          particular: key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
          amount: formatCurrency(value),
        })),
        { particular: "MSC Total", amount: formatCurrency(report.msc_total) },
      ],
      fontSize: 10,
    });

    drawSectionHeading(doc, "Monthly Financial Flow");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "Closing Balance Last Month", amount: formatCurrency(report.closing_balance_last_month) },
        { particular: "Total Closing Balance", amount: formatCurrency(report.total_closing_balance) },
        { particular: "Opening Balance", amount: formatCurrency(report.opening_balance) },
        { particular: "Total Opening Balance", amount: formatCurrency(report.total_opening_balance) },
        { particular: "Guest Charges", amount: formatCurrency(report.guest_charges) },
        { particular: "Total Expenditure", amount: formatCurrency(report.total_expenditure) },
      ],
      fontSize: 10,
    });

    if (source.guest_charge_breakdown.length) {
      drawSectionHeading(doc, "Guest Charge Register");
      drawTable(doc, {
        columns: [
          { label: "Event", width: 180, key: "event" },
          { label: "Duration", width: 130, key: "duration" },
          { label: "Guests", width: 70, key: "guests", align: "center" },
          { label: "Amount", width: 120, key: "amount", align: "right" },
        ],
        rows: source.guest_charge_breakdown.map((charge) => ({
          event: charge.event_name || "Guest Event",
          duration: `${charge.event_start_date ? new Date(charge.event_start_date).toLocaleDateString("en-IN") : "-"} to ${charge.event_end_date ? new Date(charge.event_end_date).toLocaleDateString("en-IN") : "-"}`,
          guests: String(charge.guest_count || 0),
          amount: formatCurrency(charge.amount),
        })),
        fontSize: 9.5,
      });
    }

    drawSectionHeading(doc, "Other Miscellaneous Expenditure");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        ...Object.entries(source.other_misc_breakdown).map(([key, value]) => ({
          particular: key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
          amount: formatCurrency(value),
        })),
        { particular: "Other Misc Total", amount: formatCurrency(report.other_misc) },
      ],
      fontSize: 10,
    });

    drawSectionHeading(doc, "Operational & Student Summary");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Value", width: 170, key: "value", align: "right" },
      ],
      rows: [
        { particular: "Electricity Bill", value: formatCurrency(report.electricity_bill) },
        { particular: "Internet", value: formatCurrency(report.internet) },
        { particular: "Labour Payment", value: formatCurrency(report.labour_payment) },
        { particular: "Total Students", value: String(report.total_students || 0) },
        { particular: "Total Boys", value: String(report.total_boys || 0) },
        { particular: "Total Girls", value: String(report.total_girls || 0) },
        { particular: "Total Days", value: String(report.total_days || 0) },
        { particular: "Mess Bill Per Day", value: formatCurrency(report.mess_bill_per_day) },
      ],
      fontSize: 10,
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
  } catch (error) {
    logger.error("Download monthly expense report PDF error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Error generating report PDF.",
    });
  }
};

module.exports = {
  getReportSource,
  generateMonthlyExpenseReport,
  getReportByMonth,
  getAllReports,
  submitMonthlyExpenseReport,
  approveMonthlyExpenseReportByWarden,
  approveMonthlyExpenseReportByDean,
  downloadReportPdf,
};
