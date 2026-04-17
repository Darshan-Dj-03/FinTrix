const express = require("express");
const router = express.Router();

const {
  getExpenseSource,
  createExpense,
  getExpenseByMonth,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpenseByWarden,
  approveExpenseByDean,
  downloadExpensePdf,
} = require("../controllers/expenseController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /expense/create
 * @access Protected – caretaker only
 * @desc   Create a new monthly expense record for a hostel
 */
router.post("/create", protect, checkRole("caretaker"), createExpense);
router.put("/submit/:month", protect, checkRole("caretaker"), submitExpense);
router.put("/warden-approve/:month", protect, checkRole("warden"), approveExpenseByWarden);
router.put("/dean-approve/:month", protect, checkRole("admin", "dean"), approveExpenseByDean);
router.get("/pdf/:month", protect, checkRole("admin", "dean", "warden", "caretaker"), downloadExpensePdf);

/**
 * @route  GET /expense/source/:month
 * @access Protected – caretaker or admin
 * @desc   Build the monthly expense snapshot source from hostel expense,
 *         monthly report, charges, and consumption records.
 */
router.get("/source/:month", protect, checkRole("admin", "dean", "warden", "caretaker"), getExpenseSource);

/**
 * @route  GET /expense/:month
 * @access Protected – caretaker or admin
 * @desc   Get expense(s) for a given month. Optionally filter by ?hostelId=
 *         Example: GET /expense/Jan-2026
 *                  GET /expense/Jan-2026?hostelId=<id>
 */
router.get("/:month", protect, checkRole("admin", "dean", "warden", "caretaker"), getExpenseByMonth);

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
