const mongoose = require("mongoose");
const Ledger = require("../models/Ledger");
const Expense = require("../models/Expense");
const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const Hostel = require("../models/Hostel");

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

    const existing = await Ledger.findOne({ hostelId, month });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Ledger already exists for this hostel and month.",
      });
    }

    const previousMonth = getPreviousMonth(month);
    const previousLedger = await Ledger.findOne({ hostelId, month: previousMonth });
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
      {
        $group: {
          _id: null,
          total: { $sum: "$monthExpense" },
        },
      },
    ]);

    const [chargeAggregation] = await Charge.aggregate([
      { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), month } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const [billedAggregation] = await MessBill.aggregate([
      { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), month } },
      {
        $group: {
          _id: null,
          total: { $sum: "$total_amount" },
        },
      },
    ]);

    const [collectedAggregation] = await Payment.aggregate([
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
      { $match: { "user.hostelId": new mongoose.Types.ObjectId(hostelId) } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountPaid" },
        },
      },
    ]);

    const totalExpenses =
      Number(expenseAggregation?.total || 0) + Number(chargeAggregation?.total || 0);
    const totalBilled = Number(billedAggregation?.total || 0);
    const totalCollected = Number(collectedAggregation?.total || 0);
    const closingBalance = openingBalance + totalCollected - totalExpenses;
    const outstanding = totalBilled - totalCollected;

    const ledger = await Ledger.create({
      month,
      hostelId,
      openingBalance,
      totalExpenses,
      totalBilled,
      totalCollected,
      closingBalance,
      outstanding,
      preparedBy: req.user._id,
    });

    const populated = await ledger.populate([
      { path: "hostelId", select: "name type location" },
      { path: "preparedBy", select: "name username role" },
    ]);

    return res.status(201).json({
      success: true,
      message: "Ledger created successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Ledger already exists for this hostel and month.",
      });
    }
    console.error("Create ledger error:", error);
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

    const ledgers = await Ledger.find(filter)
      .populate({ path: "hostelId", select: "name type location" })
      .populate({ path: "preparedBy", select: "name username role" })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Ledger fetched successfully.",
      data: ledgers,
    });
  } catch (error) {
    console.error("Get ledger error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createLedger,
  getLedger,
};
