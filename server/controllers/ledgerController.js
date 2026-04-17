const mongoose = require("mongoose");
const Ledger = require("../models/Ledger");
const Expense = require("../models/Expense");
const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const Hostel = require("../models/Hostel");
const { runInTransaction } = require("../utils/transaction");
const { getPagination, buildPaginationMeta } = require("../utils/pagination");
const { createAuditLog } = require("../services/auditService");
const logger = require("../utils/logger");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getPreviousMonth = (month) => {
  const [monthName, yearStr] = month.split("-");
  const monthIndex = MONTHS.indexOf(monthName);
  const year = Number(yearStr);

  if (monthIndex <= 0) {
    return `Dec-${year - 1}`;
  }
  return `${MONTHS[monthIndex - 1]}-${year}`;
};

const resolveHostelId = (req, inputHostelId) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId;
  }
  return inputHostelId || null;
};

const createLedger = async (req, res) => {
  try {
    const { month } = req.params;
    const hostelId = resolveHostelId(req, req.body.hostelId);

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
      return res.status(400).json({ success: false, message: "Valid hostelId is required." });
    }

    const hostelExists = await Hostel.findById(hostelId);
    if (!hostelExists) {
      return res.status(404).json({ success: false, message: "Hostel not found." });
    }

    const populated = await runInTransaction(async (session) => {
      const existing = await Ledger.findOne({ hostelId, month }).session(session);
      if (existing) {
        const error = new Error("Ledger already exists for this hostel and month.");
        error.status = 409;
        throw error;
      }

      const previousMonth = getPreviousMonth(month);
      const previousLedger = await Ledger.findOne({ hostelId, month: previousMonth }).session(session);
      const openingBalance = previousLedger ? previousLedger.closingBalance : 0;

      const [expenseAggregation] = await Expense.aggregate([
        { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), month } },
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

      const [chargeAggregation] = await Charge.aggregate([
        { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), month } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).session(session);

      const [billedAggregation] = await MessBill.aggregate([
        { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), month } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]).session(session);

      const [collectedAggregation] = await Payment.aggregate([
        {
          $match: {
            hostelId: new mongoose.Types.ObjectId(hostelId),
            month,
            status: "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).session(session);

      const totalExpenses =
        Number(expenseAggregation?.total || 0) + Number(chargeAggregation?.total || 0);
      const totalBilled = Number(billedAggregation?.total || 0);
      const totalCollected = Number(collectedAggregation?.total || 0);
      const closingBalance = openingBalance + totalCollected - totalExpenses;
      const outstanding = Math.max(totalBilled - totalCollected, 0);

      const [ledger] = await Ledger.create(
        [
          {
            month,
            hostelId,
            openingBalance,
            totalExpenses,
            totalBilled,
            totalCollected,
            closingBalance,
            outstanding,
            preparedBy: req.user._id,
          },
        ],
        { session }
      );

      await createAuditLog({
        action: "LEDGER_CREATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: ledger._id,
        entityType: "Ledger",
        metadata: {
          month,
          hostelId,
          totalExpenses,
          totalBilled,
          totalCollected,
        },
        session,
      });

      return Ledger.findById(ledger._id)
        .session(session)
        .populate([
          { path: "hostelId", select: "name type location" },
          { path: "preparedBy", select: "name username role" },
        ]);
    });

    return res.status(201).json({
      success: true,
      message: "Ledger created successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000 || error.status === 409) {
      return res.status(409).json({
        success: false,
        message: "Ledger already exists for this hostel and month.",
      });
    }
    logger.error("Create ledger error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getLedger = async (req, res) => {
  try {
    const { month } = req.params;
    const queryHostelId = resolveHostelId(req, req.query.hostelId);

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const filter = { month };
    if (queryHostelId) {
      if (!mongoose.Types.ObjectId.isValid(queryHostelId)) {
        return res.status(400).json({ success: false, message: "Invalid hostelId format." });
      }
      filter.hostelId = queryHostelId;
    }

    const { page, limit, skip } = getPagination(req.query);
    const [ledgers, total] = await Promise.all([
      Ledger.find(filter)
        .populate({ path: "hostelId", select: "name type location" })
        .populate({ path: "preparedBy", select: "name username role" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Ledger.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Ledger fetched successfully.",
      data: ledgers,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    logger.error("Get ledger error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createLedger,
  getLedger,
};
