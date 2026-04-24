const express = require("express");
const router = express.Router();

const {
  login,
  signupStudent,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  refreshSession,
  changePassword,
  requestProfilePasswordOtp,
  changePasswordWithOtp,
  getCurrentUser,
  updateProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authRateLimiter } = require("../middleware/rateLimitMiddleware");

/**
 * @route  POST /auth/login
 * @access Public – no token required
 */
router.post("/login", authRateLimiter, login);
router.post("/signup/student", authRateLimiter, signupStudent);
router.post("/forgot-password/request", authRateLimiter, requestPasswordResetOtp);
router.post("/forgot-password/reset", authRateLimiter, resetPasswordWithOtp);
router.post("/refresh", authRateLimiter, refreshSession);

/**
 * @route  POST /auth/change-password
 * @access Protected – any authenticated user
 */
router.post("/change-password", authRateLimiter, protect, changePassword);
router.post("/profile/change-password/request-otp", authRateLimiter, protect, requestProfilePasswordOtp);
router.post("/profile/change-password/verify-otp", authRateLimiter, protect, changePasswordWithOtp);
router.get("/me", protect, getCurrentUser);
router.put("/profile", protect, updateProfile);

module.exports = router;
