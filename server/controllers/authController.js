const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Generates a signed JWT for a given user ID.
 * Expiry is controlled by JWT_EXPIRES_IN env var (default: 7d).
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @route   POST /auth/login
 * @access  Public
 * @desc    Authenticate user and return JWT + role info.
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validate input presence
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    // 2. Find user by username (include password for comparison)
    const user = await User.findOne({ username: username.toLowerCase().trim() }).select(
      "+password"
    );

    if (!user) {
      // Use a generic message to avoid username enumeration
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // 3. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // 4. Generate token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        hostelId: user.hostelId,
        isFirstLogin: user.isFirstLogin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   POST /auth/change-password
 * @access  Protected (any authenticated user)
 * @desc    Change current user's password. Sets isFirstLogin = false.
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password.",
      });
    }

    // 2. Fetch user WITH password field (normally excluded)
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // 3. Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // 4. Update password and clear first-login flag
    //    The pre-save hook in User.js will hash the new password automatically
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { login, changePassword };
