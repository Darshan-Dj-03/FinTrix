const express = require("express");
const { body, param } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  addAdvance,
  listAdvancesByMonth,
  updateAdvance,
  deleteAdvance,
} = require("../controllers/advanceController");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const router = express.Router();

router.post(
  "/add",
  protect,
  checkRole("caretaker", "admin"),
  [
    body("month").matches(MONTH_REGEX).withMessage("Month must be in Mon-YYYY format"),
    body("prefectStudentId").isMongoId().withMessage("Valid prefectStudentId is required"),
    body("takenAmount").isFloat({ min: 0 }).withMessage("takenAmount must be non-negative"),
    body("closedAmount").optional().isFloat({ min: 0 }).withMessage("closedAmount must be non-negative"),
    body("billDates").optional().isArray().withMessage("billDates must be an array"),
  ],
  validateRequest,
  addAdvance
);

router.get(
  "/month/:month",
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  [param("month").matches(MONTH_REGEX).withMessage("Month must be in Mon-YYYY format")],
  validateRequest,
  listAdvancesByMonth
);

router.put(
  "/update/:advanceId",
  protect,
  checkRole("caretaker", "admin"),
  [param("advanceId").isMongoId().withMessage("Invalid advance id")],
  validateRequest,
  updateAdvance
);

router.delete(
  "/:advanceId",
  protect,
  checkRole("caretaker", "admin"),
  [param("advanceId").isMongoId().withMessage("Invalid advance id")],
  validateRequest,
  deleteAdvance
);

module.exports = router;
