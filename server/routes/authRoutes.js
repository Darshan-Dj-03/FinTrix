const express = require("express");
const router = express.Router();

const { login, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @route  POST /auth/login
 * @access Public – no token required
 */
router.post("/login", login);

/**
 * @route  POST /auth/change-password
 * @access Protected – any authenticated user
 */
router.post("/change-password", protect, changePassword);

module.exports = router;
