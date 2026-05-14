const express = require("express");
const { body, param, query } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { paymentRateLimiter } = require("../middleware/rateLimitMiddleware");
const {
  listHostelDeposits,
  createHostelDeposit,
  updateHostelDeposit,
  verifyHostelDeposit,
  generateHostelDepositReport,
  downloadHostelDepositReportPdf,
} = require("../controllers/hostelDepositController");

const router = express.Router();

router.get(
  "/",
  paymentRateLimiter,
  protect,
  checkRole("student", "caretaker", "admin"),
  [
    query("studentId").optional().isMongoId().withMessage("Invalid studentId"),
    query("status").optional().isIn(["draft", "accepted"]).withMessage("status must be draft or accepted"),
  ],
  validateRequest,
  listHostelDeposits
);

router.post(
  "/",
  paymentRateLimiter,
  protect,
  checkRole("student", "caretaker", "admin"),
  [
    body("studentId").optional().isMongoId().withMessage("Invalid studentId"),
    body("academicYear").trim().notEmpty().withMessage("academicYear is required"),
    body("amountReceived").isFloat({ min: 0 }).withMessage("amountReceived must be a non-negative number"),
  ],
  validateRequest,
  createHostelDeposit
);

router.put(
  "/:id",
  paymentRateLimiter,
  protect,
  checkRole("student", "caretaker", "admin"),
  [
    param("id").isMongoId().withMessage("Invalid hostel deposit id"),
    body("amountReceived").optional().isFloat({ min: 0 }).withMessage("amountReceived must be a non-negative number"),
  ],
  validateRequest,
  updateHostelDeposit
);

router.put(
  "/:id/verify",
  paymentRateLimiter,
  protect,
  checkRole("caretaker", "admin"),
  [param("id").isMongoId().withMessage("Invalid hostel deposit id")],
  validateRequest,
  verifyHostelDeposit
);

router.get(
  "/report/yearly",
  paymentRateLimiter,
  protect,
  checkRole("caretaker", "admin"),
  [query("academicYear").trim().notEmpty().withMessage("academicYear is required")],
  validateRequest,
  generateHostelDepositReport
);

router.get(
  "/report/yearly/pdf",
  paymentRateLimiter,
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  [query("academicYear").trim().notEmpty().withMessage("academicYear is required")],
  validateRequest,
  downloadHostelDepositReportPdf
);

module.exports = router;
