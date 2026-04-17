const express = require("express");

const {
  createHostelExpense,
  updateHostelExpense,
  getHostelExpenseByMonth,
  submitHostelExpense,
  approveHostelExpenseByWarden,
  approveHostelExpenseByDean,
  downloadHostelExpensePdf,
} = require("../controllers/hostelExpenseController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/create", protect, checkRole("caretaker"), createHostelExpense);
router.put("/submit/:month", protect, checkRole("caretaker"), submitHostelExpense);
router.put("/warden-approve/:month", protect, checkRole("warden"), approveHostelExpenseByWarden);
router.put("/dean-approve/:month", protect, checkRole("admin", "dean"), approveHostelExpenseByDean);
router.get("/pdf/:month", protect, checkRole("admin", "dean", "warden", "caretaker"), downloadHostelExpensePdf);
router.get("/:month", protect, checkRole("admin", "dean", "warden", "caretaker"), getHostelExpenseByMonth);
router.patch("/:id", protect, checkRole("caretaker"), updateHostelExpense);

module.exports = router;
