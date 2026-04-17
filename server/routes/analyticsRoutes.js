const express = require("express");
const { param } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  getSummaryAnalytics,
  getHostelAnalytics,
  getConsumptionAnalytics,
  getStudentAnalytics,
  getFinanceAnalytics,
} = require("../controllers/analyticsController");

const router = express.Router();

router.get(
  "/summary/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getSummaryAnalytics
);

router.get(
  "/hostel/:month",
  protect,
  checkRole("admin", "dean", "warden"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getHostelAnalytics
);

router.get(
  "/consumption/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getConsumptionAnalytics
);

router.get(
  "/students/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getStudentAnalytics
);

router.get(
  "/finance/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getFinanceAnalytics
);

module.exports = router;
