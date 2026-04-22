const mongoose = require("mongoose");

const Hostel = require("../models/Hostel");
const HostelExpense = require("../models/HostelExpense");
const Expense = require("../models/Expense");
const Report = require("../models/Report");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const MessBill = require("../models/MessBill");
const MessBillReport = require("../models/MessBillReport");
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const BillingSetting = require("../models/BillingSetting");
const Student = require("../models/Student");
const StudentConsumption = require("../models/StudentConsumption");
const { calculateHostelExpense } = require("../services/hostelExpenseCalculationService");
const { generateMessBills } = require("../services/calculationService");
const {
  buildReportSource,
  calculateMonthlyExpenseReport,
} = require("../services/monthlyExpenseReportService");
const {
  notifyStudentBillGenerated,
  notifyStudentBillGeneratedInApp,
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
  formatCurrency,
} = require("../utils/pdfLayout");
const { resolveReportContacts } = require("../utils/reportContacts");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const POPULATE_CONFIG = [
  { path: "hostelId", select: "name type location" },
  { path: "createdBy", select: "name email username role" },
];

const resolveHostelId = (req, providedHostelId) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }

  return providedHostelId;
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundCurrency = (value = 0) => Number(toNumber(value).toFixed(2));

const getHostelHeadcounts = async (hostelId) => {
  const students = await Student.find({ isActive: true })
    .populate({
      path: "userId",
      select: "hostelId role isActive",
    })
    .select("gender");

  const scopedStudents = students.filter(
    (student) =>
      student.userId?.role === "student" &&
      student.userId?.isActive !== false &&
      student.userId?.hostelId?.toString() === hostelId.toString()
  );

  const total_students = scopedStudents.length;
  const total_girls = scopedStudents.filter((student) => student.gender === "female").length;
  const total_boys = scopedStudents.filter((student) => student.gender === "male").length;

  return {
    total_students,
    total_girls,
    total_boys,
  };
};

const getDaysInMonth = (month) => {
  const [monthLabel, year] = String(month || "").split("-");
  const monthIndex = MONTHS.indexOf(monthLabel);
  return new Date(Number(year), monthIndex + 1, 0).getDate();
};

const getStudentsForBilling = async (hostelId) => {
  const students = await Student.find({ isActive: true }).populate({
    path: "userId",
    select: "_id name username email hostelId role isActive",
    match: { hostelId },
  });

  return students.filter(
    (student) => student.userId && student.userId.role === "student" && student.userId.isActive !== false
  );
};

const getProteinStudentCounts = async (hostelId, month) => {
  const students = await getStudentsForBilling(hostelId);
  if (!students.length) {
    return {
      egg_students_count: 0,
      chicken_students_count: 0,
      paneer_students_count: 0,
    };
  }

  const studentIds = students.map((student) => student._id);
  const records = await StudentConsumption.find({
    month,
    studentId: { $in: studentIds },
  }).select("egg_count chicken_count paneer_count");

  return records.reduce(
    (acc, record) => ({
      egg_students_count: acc.egg_students_count + (toNumber(record.egg_count) > 0 ? 1 : 0),
      chicken_students_count: acc.chicken_students_count + (toNumber(record.chicken_count) > 0 ? 1 : 0),
      paneer_students_count: acc.paneer_students_count + (toNumber(record.paneer_count) > 0 ? 1 : 0),
    }),
    {
      egg_students_count: 0,
      chicken_students_count: 0,
      paneer_students_count: 0,
    }
  );
};

const validateCommonInput = async ({ month, hostelId }) => {
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
    const error = new Error("Hostel not found.");
    error.status = 404;
    throw error;
  }

  return hostel;
};

const syncMonthlyExpenseReport = async ({
  hostelId,
  month,
  userId,
  openingBalance,
  manualClosingBalance,
}) => {
  const existingReport = await MonthlyExpenseReport.findOne({ hostelId, month });
  if (existingReport && existingReport.status !== "draft") {
    return existingReport;
  }

  const source = await buildReportSource(hostelId, month);

  const opening_balance = Number(
    openingBalance !== undefined ? openingBalance : existingReport?.opening_balance || 0
  );
  const closing_balance_last_month = Number(
    manualClosingBalance !== undefined
      ? manualClosingBalance
      : existingReport?.closing_balance_last_month || 0
  );
  const reportValues = calculateMonthlyExpenseReport({
    source,
    opening_balance,
    manual_closing_balance: closing_balance_last_month,
  });

  if (!existingReport) {
    return MonthlyExpenseReport.create({
      hostelId,
      month,
      ...reportValues,
      generatedBy: userId,
      hostelExpenseId: source.hostelExpense._id,
    });
  }

  existingReport.msc_total = reportValues.msc_total;
  existingReport.closing_balance_last_month = reportValues.closing_balance_last_month;
  existingReport.total_closing_balance = reportValues.total_closing_balance;
  existingReport.opening_balance = reportValues.opening_balance;
  existingReport.total_opening_balance = reportValues.total_opening_balance;
  existingReport.guest_charges = reportValues.guest_charges;
  existingReport.total_expenditure = reportValues.total_expenditure;
  existingReport.total_days = reportValues.total_days;
  existingReport.mess_bill_per_day = reportValues.mess_bill_per_day;
  existingReport.electricity_bill = reportValues.electricity_bill;
  existingReport.internet = reportValues.internet;
  existingReport.labour_payment = reportValues.labour_payment;
  existingReport.other_misc = reportValues.other_misc;
  existingReport.total_students = reportValues.total_students;
  existingReport.total_boys = reportValues.total_boys;
  existingReport.total_girls = reportValues.total_girls;
  existingReport.closing_balance_source_month = reportValues.closing_balance_source_month;
  existingReport.opening_balance_manual = reportValues.opening_balance_manual;
  existingReport.hostelExpenseId = source.hostelExpense._id;
  existingReport.generatedBy = existingReport.generatedBy || userId;
  await existingReport.save();
  return existingReport;
};

const syncExpenseSnapshot = async ({ hostelId, month, userId }) => {
  const [hostelExpense, monthlyReport, charges, students, existingExpense] = await Promise.all([
    HostelExpense.findOne({ hostelId, month }),
    MonthlyExpenseReport.findOne({ hostelId, month }),
    Charge.find({ hostelId, month }),
    getStudentsForBilling(hostelId),
    Expense.findOne({ hostelId, month }),
  ]);

  if (!hostelExpense) {
    return null;
  }

  if (existingExpense && existingExpense.status !== "draft") {
    return existingExpense;
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

  const dynamic_charge_total = roundCurrency(
    charges.reduce((sum, charge) => sum + toNumber(charge.amount), 0)
  );

  const payload = {
    month,
    hostelId,
    elp: 0,
    cylinder: 0,
    oil: 0,
    kirana: 0,
    milk: 0,
    milk_total: roundCurrency(totals.milk_amount),
    keb_total: roundCurrency(hostelExpense.keb_total || 0),
    keb_girls: roundCurrency(hostelExpense.keb_girls || 0),
    keb_boys: roundCurrency(hostelExpense.keb_boys || 0),
    total_worker_days: toNumber(existingExpense?.total_worker_days),
    labour_total: roundCurrency(hostelExpense.labour_bill || 0),
    night_watch_total: roundCurrency(hostelExpense.labour_night_watch || 0),
    bakery_total: roundCurrency(hostelExpense.bakery || 0),
    banana_total: roundCurrency(hostelExpense.banana || 0),
    banana_bakery_total: roundCurrency(
      toNumber(hostelExpense.banana || 0) + toNumber(hostelExpense.bakery || 0)
    ),
    mess_bill_total: roundCurrency((monthlyReport?.mess_bill_per_day || 0) * getDaysInMonth(month)),
    mess_bill_per_day: roundCurrency(monthlyReport?.mess_bill_per_day || 0),
    dynamic_charge_total,
    egg_price: roundCurrency(hostelExpense.egg_price_per_unit || 0),
    chicken_price: roundCurrency(hostelExpense.chicken_price_per_unit || 0),
    paneer_price: roundCurrency(hostelExpense.paneer_price_per_unit || 0),
  };

  if (!existingExpense) {
    return Expense.create({
      ...payload,
      createdBy: userId,
    });
  }

  Object.assign(existingExpense, payload);
  await existingExpense.save();
  return existingExpense;
};

const buildMainReportSnapshot = async ({ hostelId, month }) => {
  const [hostel, bills, charges, payments, expenseSnapshots] = await Promise.all([
    Hostel.findById(hostelId).select("name type location"),
    MessBill.find({ hostelId, month }).populate([
      { path: "studentId", select: "studentId" },
      { path: "userId", select: "name" },
    ]),
    Charge.find({ hostelId, month }),
    Payment.find({ hostelId, month, status: "paid" }),
    Expense.find({ hostelId, month }),
  ]);

  const totalExpenses = roundCurrency(
    expenseSnapshots.reduce(
      (sum, row) =>
        sum +
        toNumber(row.mess_bill_total) +
        toNumber(row.milk_total) +
        toNumber(row.banana_bakery_total) +
        toNumber(row.labour_total) +
        toNumber(row.night_watch_total) +
        toNumber(row.keb_total) +
        toNumber(row.dynamic_charge_total),
      0
    )
  );
  const dynamicCharges = roundCurrency(charges.reduce((sum, row) => sum + toNumber(row.amount), 0));
  const totalBilled = roundCurrency(bills.reduce((sum, row) => sum + toNumber(row.total_amount), 0));
  const totalCollected = roundCurrency(payments.reduce((sum, row) => sum + toNumber(row.amount), 0));
  const outstanding = roundCurrency(totalBilled - totalCollected);

  return {
    totalExpenses: roundCurrency(totalExpenses + dynamicCharges),
    totalBilled,
    totalCollected,
    outstanding,
    hostelWiseBreakdown: hostel
      ? [
          {
            hostelId,
            hostelName: hostel.name,
            totalBilled,
            totalStudents: bills.length,
          },
        ]
      : [],
    studentWiseSummary: bills.map((bill) => ({
      studentId: bill.studentId?._id || bill.studentId,
      studentCode: bill.studentId?.studentId || "",
      name: bill.userId?.name || "",
      billAmount: toNumber(bill.total_amount),
      paymentStatus: bill.payment_status || "pending",
    })),
    snapshot: {
      generatedAt: new Date(),
      expenses: {
        source: "auto-sync",
      },
      charges: {
        dynamicCharges,
      },
      payments: {
        collected: totalCollected,
      },
      totals: {
        totalExpenses: roundCurrency(totalExpenses + dynamicCharges),
        totalBilled,
        totalCollected,
        outstanding,
      },
    },
  };
};

const syncBillDependentArtifacts = async ({ hostelId, month, userId }) => {
  const [existingMonthlyReport, existingExpense, existingMessBillReport, existingMainReport] = await Promise.all([
    MonthlyExpenseReport.findOne({ hostelId, month }).select("status"),
    Expense.findOne({ hostelId, month }).select("status"),
    MessBillReport.findOne({ hostelId, month }).select("status"),
    Report.findOne({ hostelId, month }).select("status"),
  ]);

  const lockedArtifact = [
    ["monthly expenditure report", existingMonthlyReport],
    ["expense snapshot", existingExpense],
    ["mess bill report", existingMessBillReport],
    ["main report", existingMainReport],
  ].find(([, record]) => record && record.status !== "draft");

  if (lockedArtifact) {
    logger.warn("Skipping auto bill sync because a downstream artifact is locked", {
      hostelId: String(hostelId),
      month,
      lockedArtifact: lockedArtifact[0],
      status: lockedArtifact[1].status,
    });
    return;
  }

  const paidPaymentExists = await Payment.exists({ hostelId, month, status: "paid" });
  if (paidPaymentExists) {
    logger.warn("Skipping auto bill sync because payments already exist", {
      hostelId: String(hostelId),
      month,
    });
    return;
  }

  const expenseSnapshot = await syncExpenseSnapshot({ hostelId, month, userId });
  if (!expenseSnapshot) {
    return;
  }

  const [students, consumptionRecords, charges, existingBills, billingSetting] = await Promise.all([
    getStudentsForBilling(hostelId),
    StudentConsumption.find({ month }),
    Charge.find({ hostelId, month }),
    MessBill.find({ hostelId, month }),
    BillingSetting.findOne({ hostelId, month }),
  ]);

  if (!students.length) {
    return;
  }

  const previouslyHadBills = existingBills.length > 0;
  if (previouslyHadBills) {
    await MessBill.deleteMany({ hostelId, month });
  }

  const studentIds = new Set(students.map((student) => String(student._id)));
  const scopedConsumptionRecords = consumptionRecords.filter((record) =>
    studentIds.has(String(record.studentId))
  );
  const billPayloads = generateMessBills(expenseSnapshot, students, scopedConsumptionRecords, {
    charges,
    dueDate: billingSetting?.dueDate,
    announcementDate: billingSetting?.announcementDate,
  });
  const insertedBills = await MessBill.insertMany(billPayloads);

  const populatedBills = await MessBill.find({ _id: { $in: insertedBills.map((bill) => bill._id) } }).populate([
    { path: "studentId", select: "studentId gender isEBL isActive" },
    { path: "userId", select: "name username email" },
    { path: "hostelId", select: "name type location" },
  ]);

  if (!existingMessBillReport) {
    await MessBillReport.create({
      hostelId,
      month,
      billCount: populatedBills.length,
      totalAmount: roundCurrency(populatedBills.reduce((sum, bill) => sum + toNumber(bill.total_amount), 0)),
      generatedBy: userId,
      status: "draft",
    });
  } else if (existingMessBillReport.status === "draft") {
    existingMessBillReport.billCount = populatedBills.length;
    existingMessBillReport.totalAmount = roundCurrency(
      populatedBills.reduce((sum, bill) => sum + toNumber(bill.total_amount), 0)
    );
    await existingMessBillReport.save();
  }

  const reportSnapshot = await buildMainReportSnapshot({ hostelId, month });
  const existingReport = await Report.findOne({ hostelId, month });
  if (!existingReport) {
    await Report.create({
      month,
      hostelId,
      status: "draft",
      generatedBy: userId,
      ...reportSnapshot,
    });
  } else if (existingReport.status === "draft") {
    existingReport.totalExpenses = reportSnapshot.totalExpenses;
    existingReport.totalBilled = reportSnapshot.totalBilled;
    existingReport.totalCollected = reportSnapshot.totalCollected;
    existingReport.outstanding = reportSnapshot.outstanding;
    existingReport.hostelWiseBreakdown = reportSnapshot.hostelWiseBreakdown;
    existingReport.studentWiseSummary = reportSnapshot.studentWiseSummary;
    existingReport.snapshot = reportSnapshot.snapshot;
    await existingReport.save();
  }

  if (!previouslyHadBills) {
    await Promise.allSettled(
      populatedBills.flatMap((bill) => [notifyStudentBillGenerated(bill), notifyStudentBillGeneratedInApp(bill)])
    );
  }
};

const createHostelExpense = async (req, res) => {
  try {
    const month = req.body.month;
    const hostelId = resolveHostelId(req, req.body.hostelId);
    const hostel = await validateCommonInput({ month, hostelId });

    const existing = await HostelExpense.findOne({ month, hostelId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Hostel expense for ${month} already exists for ${hostel.name}.`,
      });
    }

    const [headcounts, proteinStudentCounts] = await Promise.all([
      getHostelHeadcounts(hostelId),
      getProteinStudentCounts(hostelId, month),
    ]);

    const created = await HostelExpense.create({
      hostelId,
      month,
      ...calculateHostelExpense({ ...req.body, ...headcounts, ...proteinStudentCounts }),
      createdBy: req.user._id,
    });

    await syncMonthlyExpenseReport({
      hostelId,
      month,
      userId: req.user._id,
    });
    await syncBillDependentArtifacts({
      hostelId,
      month,
      userId: req.user._id,
    });

    const populated = await created.populate(POPULATE_CONFIG);
    await notifyReportGeneratedInApp({
      month,
      hostelId,
      reportName: "Hostel Expenditure Details Report",
      generatedByName: req.user.name,
      actor: req.user,
    });

    return res.status(201).json({
      success: true,
      message: "Hostel expense saved successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Hostel expense for this hostel and month already exists.",
      });
    }

    logger.error("Create hostel expense error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const updateHostelExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await HostelExpense.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Hostel expense record not found.",
      });
    }

    if (req.user.role === "caretaker" && existing.hostelId.toString() !== req.user.hostelId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update hostel expense records for your hostel.",
      });
    }

    const [headcounts, proteinStudentCounts] = await Promise.all([
      getHostelHeadcounts(existing.hostelId),
      getProteinStudentCounts(existing.hostelId, existing.month),
    ]);

    const updated = await HostelExpense.findByIdAndUpdate(
      id,
      {
        $set: {
          ...calculateHostelExpense({
            ...existing.toObject(),
            ...req.body,
            ...headcounts,
            ...proteinStudentCounts,
          }),
        },
      },
      { new: true, runValidators: true }
    ).populate(POPULATE_CONFIG);

    await syncMonthlyExpenseReport({
      hostelId: existing.hostelId,
      month: existing.month,
      userId: req.user._id,
    });
    await syncBillDependentArtifacts({
      hostelId: existing.hostelId,
      month: existing.month,
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Hostel expense updated successfully.",
      data: updated,
    });
  } catch (error) {
    logger.error("Update hostel expense error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const getHostelExpenseByMonth = async (req, res) => {
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
        return res.status(400).json({
          success: false,
          message: "Invalid hostelId format.",
        });
      }

      filter.hostelId = req.query.hostelId;
    }

    const records = await HostelExpense.find(filter)
      .populate(POPULATE_CONFIG)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Hostel expense fetched successfully.",
      data: records,
    });
  } catch (error) {
    logger.error("Get hostel expense error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const submitHostelExpense = async (req, res) => {
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
      filter.hostelId = req.user.hostelId;
    } else if (req.body.hostelId) {
      filter.hostelId = req.body.hostelId;
    }

    const record = await HostelExpense.findOne(filter);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Hostel expense record not found for this month.",
      });
    }

    if (record.status === "submitted") {
      return res.status(200).json({
        success: true,
        message: "Hostel expenditure details report already submitted.",
        data: record,
      });
    }

    record.status = "submitted";
    record.submittedAt = new Date();
    record.submittedBy = req.user._id;
    await record.save();

    const populated = await HostelExpense.findById(record._id).populate(POPULATE_CONFIG);
    await notifyReportSubmittedInApp({
      month,
      hostelId: record.hostelId,
      reportName: "Hostel Expenditure Details Report",
      submittedByName: req.user.name,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Hostel expenditure details report submitted successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Submit hostel expense error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const approveHostelExpenseByWarden = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = req.body.hostelId || req.query.hostelId;
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

    const record = await HostelExpense.findOne({ month, hostelId });
    if (!record) {
      return res.status(404).json({ success: false, message: "Hostel expenditure details report not found." });
    }

    if (record.status !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "Warden approval is allowed only after submission.",
      });
    }

    record.status = "warden_approved";
    record.approvedByWarden = req.user._id;
    record.wardenApprovedAt = new Date();
    record.wardenNotes = notes || "";
    await record.save();

    const populated = await HostelExpense.findById(record._id).populate(POPULATE_CONFIG);
    await notifyReportApprovedInApp({
      month,
      hostelId,
      reportName: "Hostel Expenditure Details Report",
      approverRole: "warden",
      approverName: req.user.name,
      actor: req.user,
    });
    return res.status(200).json({
      success: true,
      message: "Hostel expenditure details report approved by warden successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Approve hostel expense by warden error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const approveHostelExpenseByDean = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: "Dean approval is not required for the hostel expenditure details report. Warden approval is the final step for this report.",
    });

    const { month } = req.params;
    const hostelId = req.body.hostelId || req.query.hostelId;
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

    const record = await HostelExpense.findOne({ month, hostelId });
    if (!record) {
      return res.status(404).json({ success: false, message: "Hostel expenditure details report not found." });
    }

    if (record.status !== "warden_approved") {
      return res.status(400).json({
        success: false,
        message: "Dean approval is allowed only after warden approval.",
      });
    }

    record.status = "dean_approved";
    record.approvedByDean = req.user._id;
    record.deanApprovedAt = new Date();
    record.deanNotes = notes || "";
    await record.save();

    const populated = await HostelExpense.findById(record._id).populate(POPULATE_CONFIG);
    return res.status(200).json({
      success: true,
      message: "Hostel expenditure details report approved by dean/admin successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Approve hostel expense by dean error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const downloadHostelExpensePdf = async (req, res) => {
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
        return res.status(400).json({
          success: false,
          message: "Invalid hostelId format.",
        });
      }

      filter.hostelId = req.query.hostelId;
    }

    const record = await HostelExpense.findOne(filter).populate(POPULATE_CONFIG);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Hostel expense record not found for this month.",
      });
    }

    const contacts = await resolveReportContacts({
      hostelId: record.hostelId?._id || record.hostelId,
      caretakerUserId: record.createdBy?._id || record.createdBy,
    });
    const doc = createPdfDocument(res, `hostel-expense-${record.month}.pdf`);

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "HOSTEL EXPENSE SHEET",
        hostelName: record.hostelId?.name || "-",
        month: record.month,
        generatedBy: record.createdBy?.name || "-",
        generatedAt: record.updatedAt || record.createdAt,
        officeLabel: "Monthly Hostel Expense Register",
      });

    renderHeader();
    drawContactDetailsBlock(doc, contacts);

    drawSummaryPanel(doc, {
      title: "Headcount Summary",
      items: [
        { label: "Total Students", value: String(record.total_students || 0) },
        { label: "Total Girls", value: String(record.total_girls || 0) },
        { label: "Total Boys", value: String(record.total_boys || 0) },
        { label: "KEB Per Girl", value: formatCurrency(record.keb_per_girl || 0) },
        { label: "KEB Per Boy", value: formatCurrency(record.keb_per_boy || 0) },
      ],
    });

    drawSectionHeading(doc, "Core Expenses");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "ELP", amount: formatCurrency(record.elp || 0) },
        { particular: "Chicken", amount: formatCurrency(record.chicken || 0) },
        { particular: "Cylinder", amount: formatCurrency(record.cylinder || 0) },
        { particular: "KEB Total", amount: formatCurrency(record.keb_total || 0) },
        { particular: "KEB Girls", amount: formatCurrency(record.keb_girls || 0) },
        { particular: "KEB Boys", amount: formatCurrency(record.keb_boys || 0) },
        { particular: "Oil", amount: formatCurrency(record.oil || 0) },
        { particular: "Kirani", amount: formatCurrency(record.kirani || 0) },
        { particular: "Milk", amount: formatCurrency(record.milk || 0) },
        { particular: "Labour Bill", amount: formatCurrency(record.labour_bill || 0) },
        { particular: "Labour Night Watch", amount: formatCurrency(record.labour_night_watch || 0) },
        { particular: "Hostel Fund", amount: formatCurrency(record.hostel_fund || 0) },
      ],
      fontSize: 10,
    });

    drawSectionHeading(doc, "Miscellaneous Expenses");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "Milling", amount: formatCurrency(record.milling || 0) },
        { particular: "Veg", amount: formatCurrency(record.veg || 0) },
        { particular: "Banana", amount: formatCurrency(record.banana || 0) },
        { particular: "Bakery", amount: formatCurrency(record.bakery || 0) },
        { particular: "Misc Per Student", amount: formatCurrency(record.misc_per_student || 0) },
      ],
      fontSize: 10,
    });

    drawSectionHeading(doc, "Protein Pricing Matrix");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 250, key: "particular" },
        { label: "Students", width: 90, key: "students", align: "center" },
        { label: "Per 3 Units", width: 80, key: "per3", align: "right" },
        { label: "Per Unit", width: 80, key: "perUnit", align: "right" },
      ],
      rows: [
        {
          particular: "Egg",
          students: String(record.egg_students_count || 0),
          per3: formatCurrency(record.egg_price_per_3 || 0),
          perUnit: formatCurrency(record.egg_price_per_unit || 0),
        },
        {
          particular: "Chicken",
          students: String(record.chicken_students_count || 0),
          per3: formatCurrency(record.chicken_price_per_3 || 0),
          perUnit: formatCurrency(record.chicken_price_per_unit || 0),
        },
        {
          particular: "Paneer",
          students: String(record.paneer_students_count || 0),
          per3: formatCurrency(record.paneer_price_per_3 || 0),
          perUnit: formatCurrency(record.paneer_price_per_unit || 0),
        },
      ],
      fontSize: 10,
    });

    drawSectionHeading(doc, "Derived Labour & Electricity Splits");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 330, key: "particular" },
        { label: "Amount", width: 170, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "Labour Per Student", amount: formatCurrency(record.labour_per_student || 0) },
        { particular: "Night Watch Per Girl", amount: formatCurrency(record.labour_night_watch_per_girl || 0) },
        { particular: "KEB Per Girl", amount: formatCurrency(record.keb_per_girl || 0) },
        { particular: "KEB Per Boy", amount: formatCurrency(record.keb_per_boy || 0) },
      ],
      fontSize: 10,
    });

    drawSignatureBlock(doc, {
      signatures: [
        { label: "Caretaker" },
        { label: "Warden" },
        { label: "Dean and Chairman, Hostel Supervisory Committee" },
      ],
      footerDate: record.updatedAt || record.createdAt,
    });

    doc.end();
  } catch (error) {
    logger.error("Download hostel expense PDF error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Error generating hostel expense PDF.",
    });
  }
};

module.exports = {
  createHostelExpense,
  updateHostelExpense,
  getHostelExpenseByMonth,
  submitHostelExpense,
  approveHostelExpenseByWarden,
  approveHostelExpenseByDean,
  downloadHostelExpensePdf,
  syncMonthlyExpenseReport,
  syncBillDependentArtifacts,
};
