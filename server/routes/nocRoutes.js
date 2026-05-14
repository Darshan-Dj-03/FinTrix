const express = require("express");
const { body, param, query } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { paymentRateLimiter } = require("../middleware/rateLimitMiddleware");
const {
  listNocSettlements,
  createNocSettlement,
  updateNocSettlement,
  updateStudentNocPaymentInfo,
  recordNocPayment,
} = require("../controllers/nocController");

const router = express.Router();

router.get(
  "/",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker", "student"),
  [
    query("studentId").optional().isMongoId().withMessage("Invalid studentId"),
    query("status").optional().isIn(["pending", "paid"]).withMessage("status must be pending or paid"),
  ],
  validateRequest,
  listNocSettlements
);

router.post(
  "/",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker"),
  [
    body("studentId").isMongoId().withMessage("Valid studentId is required"),
    body("academicYear").trim().notEmpty().withMessage("academicYear is required"),
    body("balanceAmount").optional().isFloat({ min: 0 }).withMessage("balanceAmount must be a non-negative number"),
    body("baseAmount").optional().isFloat({ min: 0 }).withMessage("baseAmount must be a non-negative number"),
    body("damagesAmount").optional().isFloat({ min: 0 }).withMessage("damagesAmount must be a non-negative number"),
    body("othersAmount").optional().isFloat({ min: 0 }).withMessage("othersAmount must be a non-negative number"),
    body("useHostelDeposit").optional().isBoolean().withMessage("useHostelDeposit must be true or false"),
    body("leavingDate").optional({ nullable: true }).isISO8601().withMessage("leavingDate must be a valid date"),
  ],
  validateRequest,
  createNocSettlement
);

router.put(
  "/:id",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker"),
  [
    param("id").isMongoId().withMessage("Invalid NOC settlement id"),
    body("balanceAmount").optional().isFloat({ min: 0 }).withMessage("balanceAmount must be a non-negative number"),
    body("baseAmount").optional().isFloat({ min: 0 }).withMessage("baseAmount must be a non-negative number"),
    body("damagesAmount").optional().isFloat({ min: 0 }).withMessage("damagesAmount must be a non-negative number"),
    body("othersAmount").optional().isFloat({ min: 0 }).withMessage("othersAmount must be a non-negative number"),
    body("leavingDate").optional({ nullable: true }).isISO8601().withMessage("leavingDate must be a valid date"),
  ],
  validateRequest,
  updateNocSettlement
);

router.put(
  "/:id/payment-info",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker", "student"),
  [
    param("id").isMongoId().withMessage("Invalid NOC settlement id"),
    body("paymentMode").optional().isIn(["cash", "upi", ""]).withMessage("paymentMode must be cash or upi"),
    body("paymentMadeDate").optional({ nullable: true }).isISO8601().withMessage("paymentMadeDate must be a valid date"),
    body("useHostelDeposit").optional().isBoolean().withMessage("useHostelDeposit must be true or false"),
  ],
  validateRequest,
  updateStudentNocPaymentInfo
);

router.post(
  "/:id/record-payment",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker"),
  [
    param("id").isMongoId().withMessage("Invalid NOC settlement id"),
    body("paymentMethod").optional().isIn(["cash", "upi"]).withMessage("paymentMethod must be cash or upi"),
    body("paymentMadeDate").optional().isISO8601().withMessage("paymentMadeDate must be a valid date"),
  ],
  validateRequest,
  recordNocPayment
);

module.exports = router;
