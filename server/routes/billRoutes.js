const express = require("express");
const router = express.Router();

const {
  generateBills,
  getAllBillsByMonth,
  getStudentBill,
} = require("../controllers/messController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /bill/generate/:month
 * @access Protected – caretaker only
 * @desc   Generate mess bills for all active students in the caretaker's hostel
 *         for the given month. Prevents duplicate generation.
 *
 * Param: month (string, "Mon-YYYY" format, e.g. "Jan-2026")
 */
router.post(
  "/generate/:month",
  protect,
  checkRole("caretaker"),
  generateBills
);

/**
 * @route  GET /bill/all/:month
 * @access Protected – caretaker or admin
 * @desc   Retrieve all bills for a given month.
 *         Caretakers see only their hostel's bills.
 *         Admins see all hostels' bills.
 *
 * Param: month (string, "Mon-YYYY" format)
 */
router.get(
  "/all/:month",
  protect,
  checkRole("caretaker", "admin"),
  getAllBillsByMonth
);

/**
 * @route  GET /bill/student/:studentId/:month
 * @access Protected – student (own bill), caretaker (all), admin (all)
 * @desc   Retrieve a specific student's bill for a given month.
 *         Students can only access their own bill.
 *         Caretakers and admins can access any student's bill.
 *
 * Params:
 *   studentId (string) – Student document _id
 *   month (string, "Mon-YYYY" format)
 */
router.get(
  "/student/:studentId/:month",
  protect,
  getStudentBill
);

module.exports = router;
