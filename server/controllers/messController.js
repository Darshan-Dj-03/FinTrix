const mongoose = require("mongoose");
const Student = require("../models/Student");
const User = require("../models/User");
const Expense = require("../models/Expense");
const MessBill = require("../models/MessBill");
const StudentConsumption = require("../models/StudentConsumption");
const { generateMessBills } = require("../services/calculationService");

// ─── Month format validator ───────────────────────────────────────────────────
const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

// ─── Populate config ──────────────────────────────────────────────────────────
const POPULATE_STUDENT = {
  path: "studentId",
  select: "studentId gender isEBL isActive",
  populate: {
    path: "userId",
    select: "name username",
  },
};

const POPULATE_FULL = [
  {
    path: "studentId",
    select: "studentId gender isEBL isActive",
    populate: {
      path: "userId",
      select: "name username",
    },
  },
  {
    path: "userId",
    select: "name username",
  },
  {
    path: "hostelId",
    select: "name type location",
  },
];

/**
 * @route   POST /bill/generate/:month
 * @access  Protected – caretaker only
 * @desc    Generate mess bills for all active students in the caretaker's hostel
 *          for the given month.
 *
 * Flow:
 *  1. Extract caretaker's hostelId from req.user
 *  2. Validate month format
 *  3. Fetch expense record for hostel + month
 *  4. Check if bills already exist (prevent duplicates)
 *  5. Fetch all active students for the hostel with populated userId
 *  6. Fetch consumption records for the same students and month
 *  7. Call calculation service
 *  8. Insert all bills
 *  9. Return populated results
 *
 * Param:  month  – "Mon-YYYY" format
 */
const generateBills = async (req, res) => {
  try {
    const { month } = req.params;
    const caretakerHostelId = req.user.hostelId;

    // ── 1. Validate inputs ──────────────────────────────────────────────────────
    if (!caretakerHostelId) {
      return res.status(400).json({
        success: false,
        message: "Caretaker must be assigned to a hostel to generate bills.",
      });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // ── 2. Fetch expense record ────────────────────────────────────────────────
    const expense = await Expense.findOne({
      month,
      hostelId: caretakerHostelId,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: `No expense record found for ${month} in your hostel.`,
      });
    }

    // ── 3. Check for existing bills (prevent duplicate generation) ────────────
    const existingBills = await MessBill.findOne({
      hostelId: caretakerHostelId,
      month,
    });

    if (existingBills) {
      return res.status(409).json({
        success: false,
        message: `Bills for ${month} have already been generated for this hostel.`,
      });
    }

    // ── 4. Fetch all active students for the hostel ────────────────────────────
    const students = await Student.find({
      isActive: true,
    })
      .populate({
        path: "userId",
        select: "_id name username hostelId",
        match: { hostelId: caretakerHostelId }, // Filter by hostel
      });

    // Filter out students not in this hostel (userId.hostelId mismatch)
    const filteredStudents = students.filter((s) => s.userId !== null);

    if (filteredStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active students found in your hostel to bill for this month.",
      });
    }

    // ── 5. Fetch consumption records for these students ────────────────────────
    const studentIds = filteredStudents.map((s) => s._id);
    const consumptionRecords = await StudentConsumption.find({
      studentId: { $in: studentIds },
      month,
    });

    // ── 6. Call calculation service ─────────────────────────────────────────────
    let billPayloads;
    try {
      billPayloads = generateMessBills(expense, filteredStudents, consumptionRecords);
    } catch (calcError) {
      return res.status(400).json({
        success: false,
        message: `Calculation error: ${calcError.message}`,
      });
    }

    // ── 7. Insert all bills ─────────────────────────────────────────────────────
    const createdBills = await MessBill.insertMany(billPayloads);

    // ── 8. Populate and return ──────────────────────────────────────────────────
    const populatedBills = await MessBill.find({ _id: { $in: createdBills.map((b) => b._id) } })
      .populate(POPULATE_FULL)
      .sort({ "studentId.studentId": 1 });

    return res.status(201).json({
      success: true,
      message: `Bills for ${month} generated successfully for ${populatedBills.length} students.`,
      month,
      count: populatedBills.length,
      bills: populatedBills,
    });
  } catch (error) {
    // Handle duplicate key errors during insertion
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "One or more bills for this month already exist.",
      });
    }
    console.error("Generate bills error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   GET /bill/all/:month
 * @access  Protected – caretaker or admin
 * @desc    Get all bills for a given month.
 *          Caretakers see only their hostel's bills.
 *          Admins see all hostels' bills.
 *
 * Param:  month  – "Mon-YYYY" format
 */
const getAllBillsByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    // Validate month format
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // Build query based on user role
    const query = { month };

    if (req.user.role === "caretaker") {
      // Caretaker can only view their hostel's bills
      if (!req.user.hostelId) {
        return res.status(400).json({
          success: false,
          message: "Caretaker must be assigned to a hostel.",
        });
      }
      query.hostelId = req.user.hostelId;
    }
    // Admin (and higher roles) can see all hostels' bills

    const bills = await MessBill.find(query)
      .populate(POPULATE_FULL)
      .sort({ hostelId: 1, "studentId.studentId": 1 });

    return res.status(200).json({
      success: true,
      month,
      count: bills.length,
      bills,
    });
  } catch (error) {
    console.error("Get all bills error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   GET /bill/student/:studentId/:month
 * @access  Protected – student (own bill), caretaker (all), admin (all)
 * @desc    Get a specific student's bill for a given month.
 *
 * For students: can only access their own bill.
 * For caretaker/admin: can access any bill.
 *
 * Param:  studentId  – Student document _id
 * Param:  month      – "Mon-YYYY" format
 */
const getStudentBill = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    // Validate month format
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // Validate studentId format
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studentId format.",
      });
    }

    // ── Role-based access control ───────────────────────────────────────────────
    if (req.user.role === "student") {
      // Students can only view their own bill
      // Verify that the student belongs to this user
      const studentRecord = await Student.findById(studentId);
      if (!studentRecord) {
        return res.status(404).json({
          success: false,
          message: "Student record not found.",
        });
      }

      // Check that the student's userId matches the authenticated user
      if (studentRecord.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own bill.",
        });
      }
    }
    // Caretaker and admin can view any student's bill

    // ── Fetch the bill ──────────────────────────────────────────────────────────
    const bill = await MessBill.findOne({
      studentId,
      month,
    }).populate(POPULATE_FULL);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: `No bill found for this student in ${month}.`,
      });
    }

    return res.status(200).json({
      success: true,
      bill,
    });
  } catch (error) {
    console.error("Get student bill error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  generateBills,
  getAllBillsByMonth,
  getStudentBill,
};
