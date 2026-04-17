const express = require("express");
const router = express.Router();

const { login, changePassword, getCurrentUser } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authRateLimiter } = require("../middleware/rateLimitMiddleware");

/**
 * @route  POST /auth/login
 * @access Public – no token required
 */
router.post("/login", authRateLimiter, login);

/**
 * @route  POST /auth/change-password
 * @access Protected – any authenticated user
 */
router.post("/change-password", authRateLimiter, protect, changePassword);
router.get("/me", protect, getCurrentUser);

module.exports = router;
