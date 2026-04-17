const express = require("express");
const { body, param } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  addConsumption,
  updateConsumption,
  getConsumption,
  deleteConsumption,
  getConsumptionByMonth,
  bulkUpsertConsumption,
} = require("../controllers/consumptionController");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const router = express.Router();

router.post(
  "/bulk-upsert",
  protect,
  checkRole("caretaker"),
  [
    body("month").matches(MONTH_REGEX).withMessage('Month must be in Mon-YYYY format'),
    body("records").isArray({ min: 1 }).withMessage("records must be a non-empty array"),
    body("records.*.studentId").isMongoId().withMessage("Each studentId must be valid"),
    body("records.*.egg_count").optional().isInt({ min: 0 }).withMessage("Egg count must be non-negative"),
    body("records.*.chicken_count").optional().isInt({ min: 0 }).withMessage("Chicken count must be non-negative"),
    body("records.*.paneer_count").optional().isInt({ min: 0 }).withMessage("Paneer count must be non-negative"),
    body("records.*.milk_amount").optional().isFloat({ min: 0 }).withMessage("Milk amount must be non-negative"),
    body("records.*.fine_amount").optional().isFloat({ min: 0 }).withMessage("Fine amount must be non-negative"),
    body("records.*.absent_days").optional().isInt({ min: 0 }).withMessage("Absent days must be non-negative"),
  ],
  validateRequest,
  bulkUpsertConsumption
);

router.post(
  "/add",
  protect,
  checkRole("caretaker"),
  [
    body("studentId").isMongoId().withMessage("Invalid student ID"),
    body("month").matches(MONTH_REGEX).withMessage('Month must be in Mon-YYYY format'),
    body("egg_count").optional().isInt({ min: 0 }).withMessage("Egg count must be non-negative"),
    body("chicken_count").optional().isInt({ min: 0 }).withMessage("Chicken count must be non-negative"),
    body("paneer_count").optional().isInt({ min: 0 }).withMessage("Paneer count must be non-negative"),
    body("milk_amount").optional().isFloat({ min: 0 }).withMessage("Milk amount must be non-negative"),
    body("fine_amount").optional().isFloat({ min: 0 }).withMessage("Fine amount must be non-negative"),
    body("absent_days").optional().isInt({ min: 0 }).withMessage("Absent days must be non-negative"),
  ],
  validateRequest,
  addConsumption
);

router.put(
  "/update/:id",
  protect,
  checkRole("caretaker"),
  [
    param("id").isMongoId().withMessage("Invalid consumption ID"),
    body("egg_count").optional().isInt({ min: 0 }).withMessage("Egg count must be non-negative"),
    body("chicken_count").optional().isInt({ min: 0 }).withMessage("Chicken count must be non-negative"),
    body("paneer_count").optional().isInt({ min: 0 }).withMessage("Paneer count must be non-negative"),
    body("milk_amount").optional().isFloat({ min: 0 }).withMessage("Milk amount must be non-negative"),
    body("fine_amount").optional().isFloat({ min: 0 }).withMessage("Fine amount must be non-negative"),
    body("absent_days").optional().isInt({ min: 0 }).withMessage("Absent days must be non-negative"),
  ],
  validateRequest,
  updateConsumption
);

router.get(
  "/month/:month",
  protect,
  checkRole("admin", "caretaker"),
  [param("month").matches(MONTH_REGEX).withMessage('Month must be in Mon-YYYY format')],
  validateRequest,
  getConsumptionByMonth
);

router.get(
  "/:studentId/:month",
  protect,
  [
    param("studentId").isMongoId().withMessage("Invalid student ID"),
    param("month").matches(MONTH_REGEX).withMessage('Month must be in Mon-YYYY format'),
  ],
  validateRequest,
  getConsumption
);

router.delete(
  "/:id",
  protect,
  checkRole("caretaker"),
  [param("id").isMongoId().withMessage("Invalid consumption ID")],
  validateRequest,
  deleteConsumption
);

module.exports = router;
