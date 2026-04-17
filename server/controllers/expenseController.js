const mongoose = require("mongoose");

require("../models/User");

const Expense = require("../models/Expense");
const Hostel = require("../models/Hostel");
const HostelExpense = require("../models/HostelExpense");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const Charge = require("../models/Charge");
const Student = require("../models/Student");
const StudentConsumption = require("../models/StudentConsumption");
const logger = require("../utils/logger");
const {
  createPdfDocument,
  drawUniversityHeader,
  drawSectionHeading,
  drawTable,
  drawSummaryPanel,
  drawSignatureBlock,
  formatCurrency,
} = require("../utils/pdfLayout");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const POPULATE_HOSTEL = { path: "hostelId", select: "name type location" };
const POPULATE_CREATED_BY = { path: "createdBy", select: "name email username role" };
const POPULATE_SUBMITTED_BY = { path: "submittedBy", select: "name email role" };
const POPULATE_WARDEN = { path: "approvedByWarden", select: "name email role" };
const POPULATE_DEAN = { path: "approvedByDean", select: "name email role" };
const EXPENSE_POPULATE = [POPULATE_HOSTEL, POPULATE_CREATED_BY, POPULATE_SUBMITTED_BY, POPULATE_WARDEN, POPULATE_DEAN];

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundCurrency = (value = 0) => Number(toNumber(value).toFixed(2));

const getDaysInMonth = (month) => {
  const [monthLabel, year] = month.split("-");
  const monthIndex = MONTHS.indexOf(monthLabel);
  return new Date(Number(year), monthIndex + 1, 0).getDate();
};

const resolveHostelIdForCaretaker = (req, providedHostelId) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }

  return providedHostelId;
};

const getActiveStudentsForHostel = async (hostelId) => {
  const students = await Student.find({ isActive: true })
    .populate({
      path: "userId",
      select: "hostelId role isActive",
    })
    .select("gender");

  return students.filter(
    (student) =>
      student.userId?.role === "student" &&
      student.userId?.isActive !== false &&
      student.userId?.hostelId?.toString() === hostelId.toString()
  );
};

const buildExpenseSource = async ({ hostelId, month }) => {
  if (!month || !hostelId) {
    const error = new Error("month and hostelId are required.");
    error.status = 400;
    throw error;
  }

  if (!MONTH_REGEX.test(month)) {
    const error = new Error('month must be in "Mon-YYYY" format (e.g. Jan-2026).');
    error.status = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(hostelId)) {
    const error = new Error("Invalid hostelId format.");
    error.status = 400;
    throw error;
  }

  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    const error = new Error("Hostel not found. Please provide a valid hostelId.");
    error.status = 404;
    throw error;
  }

  const [hostelExpense, monthlyReport, charges, students] = await Promise.all([
    HostelExpense.findOne({ month, hostelId }).populate("hostelId", "name type location"),
    MonthlyExpenseReport.findOne({ month, hostelId }),
    Charge.find({ month, hostelId }),
    getActiveStudentsForHostel(hostelId),
  ]);

  if (!hostelExpense) {
    const error = new Error(`Hostel expense sheet for ${month} was not found. Save the hostel expense sheet first.`);
    error.status = 404;
    throw error;
  }

  const studentIds = students.map((student) => student._id);
  const consumptionRecords = await StudentConsumption.find({
    month,
    studentId: { $in: studentIds },
  });

  const totals = consumptionRecords.reduce(
    (acc, record) => ({
      egg_count: acc.egg_count + toNumber(record.egg_count),
      chicken_count: acc.chicken_count + toNumber(record.chicken_count),
      paneer_count: acc.paneer_count + toNumber(record.paneer_count),
      milk_amount: acc.milk_amount + toNumber(record.milk_amount),
    }),
    { egg_count: 0, chicken_count: 0, paneer_count: 0, milk_amount: 0 }
  );

  const egg_price = roundCurrency(hostelExpense.egg_price_per_unit || 0);
  const chicken_price = roundCurrency(hostelExpense.chicken_price_per_unit || 0);
  const paneer_price = roundCurrency(hostelExpense.paneer_price_per_unit || 0);
  const egg_total = roundCurrency(totals.egg_count * egg_price);
  const chicken_total = roundCurrency(totals.chicken_count * chicken_price);
  const paneer_total = roundCurrency(totals.paneer_count * paneer_price);
  const milk_total = roundCurrency(totals.milk_amount);
  const banana_total = roundCurrency(hostelExpense.banana || 0);
  const bakery_total = roundCurrency(hostelExpense.bakery || 0);
  const banana_bakery_total = roundCurrency(banana_total + bakery_total);
  const dynamic_charge_total = roundCurrency(
    charges.reduce((sum, charge) => sum + toNumber(charge.amount), 0)
  );
  const dynamic_charge_breakdown = charges
    .map((charge) => ({
      id: String(charge._id),
      title: charge.title || "Static Charge",
      amount: roundCurrency(charge.amount || 0),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const labour_total = roundCurrency(hostelExpense.labour_bill || 0);
  const night_watch_total = roundCurrency(hostelExpense.labour_night_watch || 0);
  const labour_combined_total = roundCurrency(labour_total + night_watch_total);
  const keb_total = roundCurrency(hostelExpense.keb_total || 0);
  const days_in_month = getDaysInMonth(month);
  const mess_bill_per_day = roundCurrency(monthlyReport?.mess_bill_per_day || 0);
  const mess_bill_total = roundCurrency(days_in_month * mess_bill_per_day);

  return {
    hostel,
    hostelExpense,
    monthlyReport,
    month,
    hostelId,
    students,
    totals,
    values: {
      mess_bill_total,
      mess_bill_per_day,
      egg_total,
      chicken_total,
      paneer_total,
      milk_total,
      banana_total,
      bakery_total,
      banana_bakery_total,
      dynamic_charge_breakdown,
      dynamic_charge_total,
      labour_total,
      night_watch_total,
      labour_combined_total,
      keb_total,
      egg_price,
      chicken_price,
      paneer_price,
      days_in_month,
      total_students: students.length,
      total_girls: students.filter((student) => student.gender === "female").length,
      total_boys: students.filter((student) => student.gender === "male").length,
      egg_count_total: totals.egg_count,
      chicken_count_total: totals.chicken_count,
      paneer_count_total: totals.paneer_count,
      milk_amount_total: milk_total,
      monthly_report_available: Boolean(monthlyReport),
    },
  };
};

const buildExpenseSnapshot = ({ source, existingExpense = null }) => ({
  month: source.month,
  hostelId: source.hostelId,
  elp: 0,
  cylinder: 0,
  oil: 0,
  kirana: 0,
  milk: 0,
  milk_total: source.values.milk_total,
  keb_total: source.values.keb_total,
  keb_girls: roundCurrency(source.hostelExpense.keb_girls || 0),
  keb_boys: roundCurrency(source.hostelExpense.keb_boys || 0),
  total_worker_days: toNumber(existingExpense?.total_worker_days),
  labour_total: source.values.labour_total,
  night_watch_total: source.values.night_watch_total,
  bakery_total: source.values.bakery_total,
  banana_total: source.values.banana_total,
  banana_bakery_total: source.values.banana_bakery_total,
  mess_bill_total: source.values.mess_bill_total,
  mess_bill_per_day: source.values.mess_bill_per_day,
  dynamic_charge_total: source.values.dynamic_charge_total,
  egg_price: source.values.egg_price,
  chicken_price: source.values.chicken_price,
  paneer_price: source.values.paneer_price,
});

const getExpenseSource = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelIdForCaretaker(req, req.query.hostelId);
    const source = await buildExpenseSource({ hostelId, month });
    const existingExpense = await Expense.findOne({ month, hostelId }).populate(EXPENSE_POPULATE);

    return res.status(200).json({
      success: true,
      message: "Expense source fetched successfully.",
      data: {
        month,
        hostel: source.hostel,
        existingExpense,
        values: source.values,
      },
    });
  } catch (error) {
    logger.error("Get expense source error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const createExpense = async (req, res) => {
  try {
    const { month, hostelId: providedHostelId } = req.body;
    const hostelId = resolveHostelIdForCaretaker(req, providedHostelId);
    const source = await buildExpenseSource({ hostelId, month });

    const alreadyExists = await Expense.findOne({ month, hostelId });
    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: `An expense record for ${month} in hostel "${source.hostel.name}" already exists.`,
      });
    }

    const expense = await Expense.create({
      ...buildExpenseSnapshot({ source }),
      createdBy: req.user._id,
    });

    const populated = await expense.populate(EXPENSE_POPULATE);

    return res.status(201).json({
      success: true,
      message: `Expense snapshot for ${month} (${source.hostel.name}) created successfully.`,
      expense: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An expense record for this hostel and month already exists.",
      });
    }

    logger.error("Create expense error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const getExpenseByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const filter = { month };

    if (req.user.role === "caretaker") {
      if (!req.user.hostelId) {
        return res.status(400).json({
          success: false,
          message: "Caretaker must be assigned to a hostel.",
        });
      }
      filter.hostelId = req.user.hostelId;
    } else if (req.query.hostelId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hostelId)) {
        return res.status(400).json({ success: false, message: "Invalid hostelId format." });
      }
      filter.hostelId = req.query.hostelId;
    }

    const expenses = await Expense.find(filter)
      .populate(EXPENSE_POPULATE)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      month,
      count: expenses.length,
      expenses,
    });
  } catch (error) {
    logger.error("Get expense error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Expense.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    if (req.user.role === "caretaker" && existing.hostelId.toString() !== req.user.hostelId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update expenses from your hostel.",
      });
    }

    const source = await buildExpenseSource({ hostelId: existing.hostelId, month: existing.month });

    const updated = await Expense.findByIdAndUpdate(
      id,
      { $set: buildExpenseSnapshot({ source, existingExpense: existing }) },
      { new: true, runValidators: true }
    ).populate(EXPENSE_POPULATE);

    return res.status(200).json({
      success: true,
      message: "Expense snapshot updated successfully.",
      expense: updated,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid expense ID format." });
    }

    logger.error("Update expense error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    if (req.user.role === "caretaker" && expense.hostelId.toString() !== req.user.hostelId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete expenses from your hostel.",
      });
    }

    await Expense.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Expense record for ${expense.month} deleted successfully.`,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid expense ID format." });
    }

    logger.error("Delete expense error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const resolveApprovalHostelId = (req) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }

  return req.body.hostelId || req.query.hostelId || null;
};

const submitExpense = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveApprovalHostelId(req);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const expense = await Expense.findOne({ month, hostelId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense snapshot not found for this month." });
    }

    if (expense.status !== "draft") {
      return res.status(200).json({
        success: true,
        message: "Expense snapshot already submitted.",
        data: expense,
      });
    }

    expense.status = "submitted";
    expense.submittedAt = new Date();
    expense.submittedBy = req.user._id;
    await expense.save();

    const populated = await Expense.findById(expense._id).populate(EXPENSE_POPULATE);

    return res.status(200).json({
      success: true,
      message: "Expense snapshot submitted successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Submit expense error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const approveExpenseByWarden = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveApprovalHostelId(req);
    const { notes } = req.body;

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const expense = await Expense.findOne({ month, hostelId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense snapshot not found for this month." });
    }

    if (expense.status !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "Warden approval is allowed only after submission.",
      });
    }

    expense.status = "warden_approved";
    expense.approvedByWarden = req.user._id;
    expense.wardenApprovedAt = new Date();
    expense.wardenNotes = notes || "";
    await expense.save();

    const populated = await Expense.findById(expense._id).populate(EXPENSE_POPULATE);

    return res.status(200).json({
      success: true,
      message: "Expense snapshot approved by warden successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Approve expense by warden error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const approveExpenseByDean = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveApprovalHostelId(req);
    const { notes } = req.body;

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const expense = await Expense.findOne({ month, hostelId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense snapshot not found for this month." });
    }

    if (expense.status !== "warden_approved") {
      return res.status(400).json({
        success: false,
        message: "Dean approval is allowed only after warden approval.",
      });
    }

    expense.status = "dean_approved";
    expense.approvedByDean = req.user._id;
    expense.deanApprovedAt = new Date();
    expense.deanNotes = notes || "";
    await expense.save();

    const populated = await Expense.findById(expense._id).populate(EXPENSE_POPULATE);

    return res.status(200).json({
      success: true,
      message: "Expense snapshot approved by dean/admin successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Approve expense by dean error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const downloadExpensePdf = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveApprovalHostelId(req);

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const expense = await Expense.findOne({ month, hostelId }).populate(EXPENSE_POPULATE);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense snapshot not found for this month." });
    }

    const source = await buildExpenseSource({ hostelId, month });
    const doc = createPdfDocument(res, `expense-snapshot-${expense.month}.pdf`);

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "BILLING EXPENSE SNAPSHOT",
        hostelName: expense.hostelId?.name || "-",
        month: expense.month,
        generatedBy: expense.createdBy?.name || "-",
        generatedAt: expense.updatedAt || expense.createdAt,
        officeLabel: "Billing Preparation Register",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Snapshot Summary",
      items: [
        { label: "Mess Bill (Monthly)", value: formatCurrency(expense.mess_bill_total) },
        { label: "Mess Bill Per Day", value: formatCurrency(expense.mess_bill_per_day) },
        { label: "Static Charges Total", value: formatCurrency(expense.dynamic_charge_total) },
        { label: "Students Considered", value: String(source.values.total_students || 0) },
        { label: "Days In Month", value: String(source.values.days_in_month || 0) },
      ],
      redrawHeader: renderHeader,
    });

    drawSectionHeading(doc, "Billing Snapshot Breakdown", renderHeader);
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "Mess Bill", amount: formatCurrency(expense.mess_bill_total || 0) },
        { particular: "Milk", amount: formatCurrency(expense.milk_total || 0) },
        { particular: "Banana / Bakery", amount: formatCurrency(expense.banana_bakery_total || 0) },
        { particular: "Labour", amount: formatCurrency(Number(expense.labour_total || 0) + Number(expense.night_watch_total || 0)) },
        { particular: "Electric (KEB)", amount: formatCurrency(expense.keb_total || 0) },
        ...source.values.dynamic_charge_breakdown.map((charge) => ({
          particular: charge.title,
          amount: formatCurrency(charge.amount),
        })),
        { particular: "Static Charges Total", amount: formatCurrency(expense.dynamic_charge_total || 0) },
      ],
      redrawHeader: renderHeader,
      fontSize: 10,
    });

    drawSectionHeading(doc, "Unit Price Reference", renderHeader);
    drawTable(doc, {
      columns: [
        { label: "Item", width: 330, key: "item" },
        { label: "Unit Price", width: 170, key: "price", align: "right" },
      ],
      rows: [
        { item: "Egg Unit Price", price: formatCurrency(expense.egg_price || 0) },
        { item: "Chicken Unit Price", price: formatCurrency(expense.chicken_price || 0) },
        { item: "Paneer Unit Price", price: formatCurrency(expense.paneer_price || 0) },
      ],
      redrawHeader: renderHeader,
      fontSize: 10,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Hostel Office",
      rightLabel: "Verified By Chief Warden / Dean",
      redrawHeader: renderHeader,
    });

    doc.end();
  } catch (error) {
    logger.error("Download expense PDF error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Error generating expense PDF." });
  }
};

module.exports = {
  getExpenseSource,
  createExpense,
  getExpenseByMonth,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpenseByWarden,
  approveExpenseByDean,
  downloadExpensePdf,
};
