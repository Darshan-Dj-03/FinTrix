const express = require("express");
const router = express.Router();

const {
  createExpense,
  getExpenseByMonth,
  updateExpense,
  deleteExpense,
} = require("../controllers/expenseController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /expense/create
 * @access Protected – caretaker only
 * @desc   Create a new monthly expense record for a hostel
 */
router.post("/create", protect, checkRole("caretaker"), createExpense);

/**
 * @route  GET /expense/:month
 * @access Protected – caretaker or admin
 * @desc   Get expense(s) for a given month. Optionally filter by ?hostelId=
 *         Example: GET /expense/Jan-2026
 *                  GET /expense/Jan-2026?hostelId=<id>
 */
router.get("/:month", protect, checkRole("admin", "caretaker"), getExpenseByMonth);

/**
 * @route  PATCH /expense/:id
 * @access Protected – caretaker only
 * @desc   Update raw inputs; derived fields are automatically recalculated
 */
router.patch("/:id", protect, checkRole("caretaker"), updateExpense);

/**
 * @route  DELETE /expense/:id
 * @access Protected – caretaker only
 */
router.delete("/:id", protect, checkRole("caretaker"), deleteExpense);

module.exports = router;
