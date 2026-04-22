const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  listPeriods,
  listReports,
  createPeriod,
  updatePeriod,
  getStudentEblStatus,
  generateReport,
  submitReport,
  approveReport,
  downloadReportPdf,
} = require("../controllers/eblController");

const router = express.Router();

router.get("/student", protect, checkRole("student"), getStudentEblStatus);
router.get("/periods", protect, checkRole("student", "caretaker", "warden", "admin", "dean"), listPeriods);
router.post("/periods", protect, checkRole("caretaker"), createPeriod);
router.put(
  "/periods/:id",
  protect,
  checkRole("caretaker"),
  [param("id").isMongoId().withMessage("Invalid EBL period id")],
  validateRequest,
  updatePeriod
);

router.get("/reports", protect, checkRole("caretaker", "warden", "admin", "dean"), listReports);
router.post("/reports", protect, checkRole("caretaker"), generateReport);
router.put(
  "/reports/:id/submit",
  protect,
  checkRole("caretaker"),
  [param("id").isMongoId().withMessage("Invalid EBL report id")],
  validateRequest,
  submitReport
);
router.put(
  "/reports/:id/approve",
  protect,
  checkRole("warden"),
  [param("id").isMongoId().withMessage("Invalid EBL report id")],
  validateRequest,
  approveReport
);
router.get(
  "/reports/:id/pdf",
  protect,
  checkRole("caretaker", "warden", "admin", "dean"),
  [param("id").isMongoId().withMessage("Invalid EBL report id")],
  validateRequest,
  downloadReportPdf
);

module.exports = router;
