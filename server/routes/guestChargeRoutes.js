const express = require("express");
const { body, param } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  addGuestCharge,
  listGuestChargesByMonth,
  updateGuestCharge,
  deleteGuestCharge,
} = require("../controllers/guestChargeController");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const router = express.Router();

router.post(
  "/add",
  protect,
  checkRole("caretaker", "admin"),
  [
    body("month").matches(MONTH_REGEX).withMessage("Month must be in Mon-YYYY format"),
    body("event_name").trim().notEmpty().withMessage("Event name is required"),
    body("event_start_date").notEmpty().withMessage("Event start date is required"),
    body("event_end_date").notEmpty().withMessage("Event end date is required"),
    body("guest_count").isFloat({ min: 0 }).withMessage("Guest count must be non-negative"),
    body("amount").isFloat({ min: 0 }).withMessage("Amount must be non-negative"),
  ],
  validateRequest,
  addGuestCharge
);

router.get(
  "/month/:month",
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  [param("month").matches(MONTH_REGEX).withMessage("Month must be in Mon-YYYY format")],
  validateRequest,
  listGuestChargesByMonth
);

router.put(
  "/update/:guestChargeId",
  protect,
  checkRole("caretaker", "admin"),
  [param("guestChargeId").isMongoId().withMessage("Invalid guest charge id")],
  validateRequest,
  updateGuestCharge
);

router.delete(
  "/:guestChargeId",
  protect,
  checkRole("caretaker", "admin"),
  [param("guestChargeId").isMongoId().withMessage("Invalid guest charge id")],
  validateRequest,
  deleteGuestCharge
);

module.exports = router;
