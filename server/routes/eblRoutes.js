const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { requestEBL, approveEBL } = require("../controllers/eblController");

const router = express.Router();

router.put(
  "/request/:studentId",
  protect,
  checkRole("student", "caretaker"),
  [param("studentId").isMongoId().withMessage("Invalid studentId")],
  validateRequest,
  requestEBL
);

router.put(
  "/approve/:studentId",
  protect,
  checkRole("admin"),
  [param("studentId").isMongoId().withMessage("Invalid studentId")],
  validateRequest,
  approveEBL
);

module.exports = router;
