const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  generateReport,
  submitReport,
  wardenApprove,
  deanApprove,
  getReportStatus,
  getFullMonthlyReport,
} = require("../controllers/reportController");

const router = express.Router();

router.post(
  "/generate/:month",
  protect,
  checkRole("caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  generateReport
);

router.put(
  "/submit/:month",
  protect,
  checkRole("caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  submitReport
);

router.put(
  "/warden-approve/:month",
  protect,
  checkRole("warden"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  wardenApprove
);

router.put(
  "/dean-approve/:month",
  protect,
  checkRole("admin", "dean"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  deanApprove
);

router.get(
  "/status/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getReportStatus
);
router.get(
  "/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getReportStatus
);

router.get(
  "/full/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getFullMonthlyReport
);

module.exports = router;
