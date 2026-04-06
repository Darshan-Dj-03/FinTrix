const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { createLedger, getLedger } = require("../controllers/ledgerController");

const router = express.Router();

router.post(
  "/create/:month",
  protect,
  checkRole("admin", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  createLedger
);

router.get(
  "/:month",
  protect,
  checkRole("admin", "dean", "warden", "caretaker"),
  [param("month").notEmpty().withMessage("month is required")],
  validateRequest,
  getLedger
);

module.exports = router;
