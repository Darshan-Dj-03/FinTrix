const express = require("express");
const { param } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  getReportSource,
  generateMonthlyExpenseReport,
  getReportByMonth,
  getAllReports,
  submitMonthlyExpenseReport,
  approveMonthlyExpenseReportByWarden,
  approveMonthlyExpenseReportByDean,
  downloadReportPdf,
} = require("../controllers/monthlyExpenseReportController");

const router = express.Router();

router.get("/", protect, checkRole("admin", "dean", "warden", "caretaker"), getAllReports);

router.get(
  "/source/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getReportSource
);

router.post(
  "/generate/:month",
  protect,
  checkRole("caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  generateMonthlyExpenseReport
);

router.put(
  "/submit/:month",
  protect,
  checkRole("caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  submitMonthlyExpenseReport
);

router.put(
  "/warden-approve/:month",
  protect,
  checkRole("warden"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  approveMonthlyExpenseReportByWarden
);

router.put(
  "/dean-approve/:month",
  protect,
  checkRole("admin", "dean"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  approveMonthlyExpenseReportByDean
);

router.get(
  "/pdf/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  downloadReportPdf
);

router.get(
  "/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getReportByMonth
);

module.exports = router;
