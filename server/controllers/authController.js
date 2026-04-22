const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Student = require("../models/Student");

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Generates a signed JWT for a given user ID.
 * Expiry is controlled by JWT_EXPIRES_IN env var (default: 7d).
 */
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId, type: "refresh" }, getRefreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  });

const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");

const loadStudentProfile = async (userId) =>
  Student.findOne({ userId }).select("studentId gender isEBL studentClass isActive createdAt");

const buildAuthResponse = async (user, { accessToken, refreshToken }) => {
  const studentProfile = user.role === "student" ? await loadStudentProfile(user._id) : null;

  return {
    token: accessToken,
    refreshToken,
    user: buildAuthUserPayload(user, studentProfile),
    studentProfile,
  };
};

const buildAuthUserPayload = (user, studentProfile = null) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  phoneNumber: user.phoneNumber || "",
  role: user.role,
  hostelId: user.hostelId,
  isFirstLogin: user.isFirstLogin,
  isActive: user.isActive,
  isEBL: studentProfile ? studentProfile.isEBL : user.isEBL,
  studentClass: studentProfile?.studentClass || "",
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @route   POST /auth/login
 * @access  Public
 * @desc    Authenticate user and return JWT + role info.
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedIdentifier = username?.toLowerCase().trim();

    // 1. Validate input presence
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Email or student ID and password are required.",
      });
    }

    // 2. Find user by username (include password for comparison)
    const user = await User.findOne({
      $or: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }],
    }).select("+password");

    if (!user) {
      // Use a generic message to avoid username enumeration
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive. Please contact an administrator.",
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
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();
    const authPayload = await buildAuthResponse(user, { accessToken, refreshToken });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      ...authPayload,
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

const refreshSession = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required.",
      });
    }

    const decoded = jwt.verify(refreshToken, getRefreshSecret());
    if (decoded.type !== "refresh") {
      return res.status(401).json({ success: false, message: "Invalid refresh token." });
    }

    const user = await User.findById(decoded.id).select("-password +refreshTokenHash");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "This account is inactive. Please contact an administrator.",
      });
    }

    if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ success: false, message: "Refresh token is invalid." });
    }

    const nextAccessToken = generateAccessToken(user._id);
    const nextRefreshToken = generateRefreshToken(user._id);
    user.refreshTokenHash = hashToken(nextRefreshToken);
    await user.save();

    const authPayload = await buildAuthResponse(user, {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    });

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully.",
      ...authPayload,
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Refresh token has expired. Please log in again." });
    }

    console.error("Refresh session error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    const user = await User.findById(req.user._id)
      .select("-password")
      .populate({ path: "hostelId", select: "name type location" });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (phoneNumber !== undefined) {
      const sanitizedPhone = String(phoneNumber || "").trim();
      if (sanitizedPhone.length > 25) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be 25 characters or less.",
        });
      }

      user.phoneNumber = sanitizedPhone;
      await user.save();
    }

    let studentProfile = null;
    if (user.role === "student") {
      studentProfile = await Student.findOne({ userId: user._id }).select(
        "studentId gender isEBL studentClass isActive createdAt"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        user: buildAuthUserPayload(user, studentProfile),
        studentProfile,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate({ path: "hostelId", select: "name type location" });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive. Please contact an administrator.",
      });
    }

    let studentProfile = null;
    if (user.role === "student") {
      studentProfile = await Student.findOne({ userId: user._id }).select(
        "studentId gender isEBL studentClass isActive createdAt"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Current user fetched successfully.",
      data: {
        user: buildAuthUserPayload(user, studentProfile),
        studentProfile,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { login, refreshSession, changePassword, getCurrentUser, updateProfile };
