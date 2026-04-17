const mongoose = require("mongoose");
const MessBill = require('../models/MessBill');
const StudentConsumption = require('../models/StudentConsumption');
const Expense = require('../models/Expense');
const Payment = require("../models/Payment");
const logger = require("../utils/logger");

const activeStudentLookupStages = [
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
      localField: "student.userId",
      foreignField: "_id",
      as: "studentUser",
    },
  },
  { $unwind: "$studentUser" },
  {
    $match: {
      "student.isActive": { $ne: false },
      "studentUser.isActive": { $ne: false },
    },
  },
];

const resolveScopedHostelId = (req) => {
  if (req.user.role === "caretaker") {
    return req.user.hostelId || null;
  }

  return req.query.hostelId || null;
};

/**
 * Get summary analytics for a month
 * GET /analytics/summary/:month
 * Access: Admin, Caretaker
 */
const getSummaryAnalytics = async (req, res) => {
  try {
    const { month } = req.params;

    // Build filter based on role
    const scopedHostelId = resolveScopedHostelId(req);
    const matchStage = { month };

    if (scopedHostelId) {
      matchStage.hostelId = scopedHostelId;
    }

    const bills = await MessBill.aggregate([
      { $match: matchStage },
      ...activeStudentLookupStages,
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalExpense: { $sum: '$total_amount' },
          totalFines: { $sum: '$fine' },
          averageBill: { $avg: '$total_amount' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$payment_status', 'paid'] }, '$total_amount', 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $in: ['$payment_status', ['pending', 'partial']] }, '$total_amount', 0],
            },
          },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ['$payment_status', 'paid'] }, 1, 0],
            },
          },
          unpaidCount: {
            $sum: {
              $cond: [{ $in: ['$payment_status', ['pending', 'partial']] }, 1, 0],
            },
          },
        },
      },
    ]);

    const summary = bills[0] || {
      totalBills: 0,
      totalExpense: 0,
      totalFines: 0,
      averageBill: 0,
      totalPaid: 0,
      totalPending: 0,
      paidCount: 0,
      unpaidCount: 0,
    };

    res.status(200).json({
      success: true,
      month,
      summary: {
        totalBills: summary.totalBills,
        totalExpense: parseFloat(summary.totalExpense.toFixed(2)),
        totalFines: parseFloat(summary.totalFines.toFixed(2)),
        averageBill: parseFloat(summary.averageBill.toFixed(2)),
        collectionStatus: {
          totalPaid: parseFloat(summary.totalPaid.toFixed(2)),
          totalPending: parseFloat(summary.totalPending.toFixed(2)),
          paidStudents: summary.paidCount,
          unpaidStudents: summary.unpaidCount,
          collectionPercentage:
            summary.totalBills > 0
              ? parseFloat(((summary.paidCount / summary.totalBills) * 100).toFixed(2))
              : 0,
        },
      },
    });
  } catch (error) {
    logger.error("Analytics summary error", { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get hostel-wise expense analytics
 * GET /analytics/hostel/:month
 * Access: Admin only
 */
const getHostelAnalytics = async (req, res) => {
  try {
    const { month } = req.params;

    const hostelAnalytics = await MessBill.aggregate([
      { $match: { month } },
      ...activeStudentLookupStages,
      {
        $lookup: {
          from: 'hostels',
          localField: 'hostelId',
          foreignField: '_id',
          as: 'hostel',
        },
      },
      { $unwind: '$hostel' },
      {
        $group: {
          _id: '$hostelId',
          hostelName: { $first: '$hostel.name' },
          hostelType: { $first: '$hostel.type' },
          totalStudents: { $sum: 1 },
          totalExpense: { $sum: '$total_amount' },
          averageBill: { $avg: '$total_amount' },
          totalFines: { $sum: '$fine' },
          paidStudents: {
            $sum: {
              $cond: [{ $eq: ['$payment_status', 'paid'] }, 1, 0],
            },
          },
          unpaidStudents: {
            $sum: {
              $cond: [{ $in: ['$payment_status', ['pending', 'partial']] }, 1, 0],
            },
          },
        },
      },
      { $sort: { hostelName: 1 } },
    ]);

    res.status(200).json({
      success: true,
      month,
      count: hostelAnalytics.length,
      hostels: hostelAnalytics.map(h => ({
        hostelId: h._id,
        hostelName: h.hostelName,
        hostelType: h.hostelType,
        totalStudents: h.totalStudents,
        totalExpense: parseFloat(h.totalExpense.toFixed(2)),
        averageBill: parseFloat(h.averageBill.toFixed(2)),
        totalFines: parseFloat(h.totalFines.toFixed(2)),
        collectionPercentage:
          h.totalStudents > 0
            ? parseFloat(((h.paidStudents / h.totalStudents) * 100).toFixed(2))
            : 0,
        payment: {
          paid: h.paidStudents,
          unpaid: h.unpaidStudents,
        },
      })),
    });
  } catch (error) {
    logger.error("Hostel analytics error", { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get consumption analytics
 * GET /analytics/consumption/:month
 * Access: Admin, Caretaker
 */
const getConsumptionAnalytics = async (req, res) => {
  try {
    const { month } = req.params;

    const matchStage = { month };
    const scopedHostelId = resolveScopedHostelId(req);
    if (scopedHostelId) {
      matchStage.hostelId = new mongoose.Types.ObjectId(scopedHostelId);
    }

    const consumptions = await StudentConsumption.aggregate([
      { $match: matchStage },
      ...activeStudentLookupStages,
      {
        $group: {
          _id: null,
          totalEggs: { $sum: '$egg_count' },
          totalChicken: { $sum: '$chicken_count' },
          totalPaneer: { $sum: '$paneer_count' },
          studentsConsuming: { $sum: 1 },
          avgEggPerStudent: { $avg: '$egg_count' },
          avgChickenPerStudent: { $avg: '$chicken_count' },
          avgPaneerPerStudent: { $avg: '$paneer_count' },
        },
      },
    ]);

    const data = consumptions[0] || {
      totalEggs: 0,
      totalChicken: 0,
      totalPaneer: 0,
      studentsConsuming: 0,
      avgEggPerStudent: 0,
      avgChickenPerStudent: 0,
      avgPaneerPerStudent: 0,
    };

    res.status(200).json({
      success: true,
      month,
      consumption: {
        items: {
          eggs: {
            total: data.totalEggs,
            average: parseFloat(data.avgEggPerStudent.toFixed(2)),
          },
          chicken: {
            total: data.totalChicken,
            average: parseFloat(data.avgChickenPerStudent.toFixed(2)),
          },
          paneer: {
            total: data.totalPaneer,
            average: parseFloat(data.avgPaneerPerStudent.toFixed(2)),
          },
        },
        totalStudentsConsuming: data.studentsConsuming,
      },
    });
  } catch (error) {
    logger.error("Consumption analytics error", { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get detailed student-wise breakdown
 * GET /analytics/students/:month
 * Access: Admin, Caretaker (own hostel)
 */
const getStudentAnalytics = async (req, res) => {
  try {
    const { month } = req.params;

    const scopedHostelId = resolveScopedHostelId(req);
    const matchStage = { month };

    if (scopedHostelId) {
      matchStage.hostelId = scopedHostelId;
    }

    const students = await MessBill.aggregate([
      { $match: matchStage },
      ...activeStudentLookupStages,
      {
        $project: {
          studentId: '$student._id',
          studentName: '$studentUser.name',
          gender: '$student.gender',
          isEBL: '$student.isEBL',
          billAmount: '$total_amount',
          fine: '$fine',
          status: '$payment_status',
          dueDate: '$due_date',
        },
      },
      { $sort: { studentName: 1 } },
    ]);

    res.status(200).json({
      success: true,
      month,
      count: students.length,
      students: students.map(s => ({
        studentId: s.studentId,
        name: s.studentName,
        gender: s.gender,
        isEBL: s.isEBL,
        billAmount: parseFloat(s.billAmount.toFixed(2)),
        fine: parseFloat(s.fine.toFixed(2)),
        totalDue: parseFloat((s.billAmount + s.fine).toFixed(2)),
        paymentStatus: s.status,
        dueDate: new Date(s.dueDate).toLocaleDateString(),
      })),
    });
  } catch (error) {
    logger.error("Student analytics error", { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get monthly finance analytics
 * GET /analytics/finance/:month
 * Access: Admin only
 */
const getFinanceAnalytics = async (req, res) => {
  try {
    const { month } = req.params;

    const scopedHostelId = resolveScopedHostelId(req);
    const expenseMatch = { month };
    const billMatch = { month };
    const paymentMatch = { month, status: "paid" };

    if (scopedHostelId) {
      expenseMatch.hostelId = new mongoose.Types.ObjectId(scopedHostelId);
      billMatch.hostelId = new mongoose.Types.ObjectId(scopedHostelId);
      paymentMatch.hostelId = new mongoose.Types.ObjectId(scopedHostelId);
    }

    const [expenseData] = await Expense.aggregate([
      { $match: expenseMatch },
      {
        $project: {
          total: {
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
      { $group: { _id: null, totalExpenses: { $sum: "$total" } } },
    ]);

    const [billData] = await MessBill.aggregate([
      { $match: billMatch },
      ...activeStudentLookupStages,
      {
        $group: {
          _id: null,
          totalBilled: { $sum: "$total_amount" },
          outstanding: {
            $sum: {
              $subtract: [
                { $add: ["$total_amount", "$fine"] },
                { $ifNull: ["$amount_paid", 0] },
              ],
            },
          },
        },
      },
    ]);

    const [paymentData] = await Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, totalCollected: { $sum: "$amount" } } },
    ]);

    return res.status(200).json({
      success: true,
      month,
      data: {
        totalExpenses: Number(expenseData?.totalExpenses || 0),
        totalBilled: Number(billData?.totalBilled || 0),
        totalCollected: Number(paymentData?.totalCollected || 0),
        outstanding: Math.max(Number(billData?.outstanding || 0), 0),
      },
    });
  } catch (error) {
    logger.error("Finance analytics error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  getSummaryAnalytics,
  getHostelAnalytics,
  getConsumptionAnalytics,
  getStudentAnalytics,
  getFinanceAnalytics,
};
