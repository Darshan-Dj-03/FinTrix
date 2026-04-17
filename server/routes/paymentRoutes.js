const express = require("express");
const { body, param, query } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { paymentRateLimiter } = require("../middleware/rateLimitMiddleware");
const {
  recordPayment,
  getPaymentHistory,
  getPaymentById,
  getBillPayments,
} = require("../controllers/paymentController");

const router = express.Router();

router.post(
  "/",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker"),
  [
    body("billId").isMongoId().withMessage("Valid billId is required"),
    body("paymentMethod")
      .optional()
      .isIn(["cash", "upi"])
      .withMessage("paymentMethod must be cash or upi"),
    body("paymentMadeDate")
      .optional()
      .isISO8601()
      .withMessage("paymentMadeDate must be a valid date"),
  ],
  validateRequest,
  recordPayment
);

router.get(
  "/",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker", "student"),
  [
    query("studentId").optional().isMongoId().withMessage("Invalid studentId"),
    query("billId").optional().isMongoId().withMessage("Invalid billId"),
    query("hostelId").optional().isMongoId().withMessage("Invalid hostelId"),
  ],
  validateRequest,
  getPaymentHistory
);

router.get(
  "/bill/:billId",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker", "student"),
  [param("billId").isMongoId().withMessage("Invalid billId")],
  validateRequest,
  getBillPayments
);

router.get(
  "/:paymentId",
  paymentRateLimiter,
  protect,
  checkRole("admin", "caretaker", "student"),
  [param("paymentId").isMongoId().withMessage("Invalid paymentId")],
  validateRequest,
  getPaymentById
);

module.exports = router;
