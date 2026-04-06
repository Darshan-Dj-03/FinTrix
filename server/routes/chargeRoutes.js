const express = require("express");
const { param, body } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  addCharge,
  getChargesByMonth,
  updateCharge,
  deleteCharge,
} = require("../controllers/chargeController");

const router = express.Router();

router.post(
  "/add",
  protect,
  checkRole("admin", "caretaker"),
  [
    body("month").notEmpty().withMessage("month is required"),
    body("title").notEmpty().withMessage("title is required"),
    body("amount").isFloat({ min: 0 }).withMessage("amount must be a non-negative number"),
  ],
  validateRequest,
  addCharge
);

router.get(
  "/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getChargesByMonth
);

router.patch(
  "/:chargeId",
  protect,
  checkRole("admin", "caretaker"),
  [
    param("chargeId").isMongoId().withMessage("Invalid chargeId"),
    body("amount").optional().isFloat({ min: 0 }).withMessage("amount must be a non-negative number"),
  ],
  validateRequest,
  updateCharge
);

router.delete(
  "/:chargeId",
  protect,
  checkRole("admin", "caretaker"),
  [param("chargeId").isMongoId().withMessage("Invalid chargeId")],
  validateRequest,
  deleteCharge
);

module.exports = router;
