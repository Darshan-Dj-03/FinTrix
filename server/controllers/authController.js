const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Student = require("../models/Student");
const StudentSignupRequest = require("../models/StudentSignupRequest");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const { runInTransaction } = require("../utils/transaction");
const { sendEmail, buildEmailShell } = require("../utils/mailerService");
const logger = require("../utils/logger");

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
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();
const normalizeStudentId = (studentId = "") => String(studentId || "").trim().toUpperCase();
const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const OTP_VALIDITY_MINUTES = 10;

const issueOtpForUser = async ({
  user,
  email,
  subject,
  title,
  preheader,
  intro,
  footerNote,
}) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

  await PasswordResetOtp.updateMany(
    { email, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  await PasswordResetOtp.create({
    userId: user._id,
    email,
    otpHash: hashToken(otp),
    expiresAt,
  });

  await sendEmail({
    to: email,
    subject,
    html: buildEmailShell({
      title,
      preheader,
      greeting: `Dear ${user.name || "User"},`,
      intro,
      highlight: `OTP: ${otp}`,
      rows: [
        { label: "Email", value: email },
        { label: "Validity", value: `${OTP_VALIDITY_MINUTES} minutes` },
      ],
      outro: "If you did not request this action, you can safely ignore this email.",
      footerNote,
    }),
  });
};

const validateOtpAndLoadUser = async ({ email, otp }) => {
  const resetRecord = await PasswordResetOtp.findOne({
    email,
    usedAt: null,
  }).sort({ createdAt: -1 });

  if (!resetRecord || resetRecord.expiresAt.getTime() < Date.now() || resetRecord.otpHash !== hashToken(otp)) {
    return { error: "Invalid or expired OTP." };
  }

  const user = await User.findById(resetRecord.userId).select("+refreshTokenHash +password");
  if (!user || user.isActive === false || (user.role === "student" && (user.approvalStatus || "approved") !== "approved")) {
    return { error: "Password reset is available only for approved active accounts." };
  }

  return { user, resetRecord };
};

const getStudentApprovalMessage = (user) => {
  const approvalStatus = user?.approvalStatus || "approved";

  if (approvalStatus === "pending_caretaker") {
    return "Your signup request is waiting for caretaker review.";
  }

  if (approvalStatus === "pending_admin") {
    return "Your signup request is waiting for admin approval.";
  }

  if (approvalStatus === "rejected") {
    return "Your signup request was rejected. Please contact the hostel office.";
  }

  return "This student account is not yet approved.";
};

const ensureApprovedStudentAccess = (user) => {
  if (user?.role === "student" && (user.approvalStatus || "approved") !== "approved") {
    return getStudentApprovalMessage(user);
  }

  if (user?.isActive === false) {
    return "This account is inactive. Please contact an administrator.";
  }

  return null;
};

const generateTemporaryStudentId = async (session) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `TEMP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    const normalizedCandidate = normalizeStudentId(candidate);
    const usernameCandidate = normalizedCandidate.toLowerCase();

    const [studentConflict, userConflict, pendingConflict] = await Promise.all([
      Student.findOne({ studentId: normalizedCandidate }).session(session),
      User.findOne({ username: usernameCandidate }).session(session),
      StudentSignupRequest.findOne({ studentId: normalizedCandidate }).session(session),
    ]);

    if (!studentConflict && !userConflict && !pendingConflict) {
      return normalizedCandidate;
    }
  }

  const error = new Error("Unable to generate a unique temporary student ID. Please try again.");
  error.status = 500;
  throw error;
};

const loadStudentProfile = async (userId) =>
  Student.findOne({ userId }).select("studentId gender isEBL isActive createdAt");

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
  approvalStatus: user.approvalStatus || "approved",
  isEBL: studentProfile ? studentProfile.isEBL : user.isEBL,
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
      return res.status(401).json({
        success: false,
        message: "Account not found. If you are a new student, please sign up first.",
      });
    }

    const accessError = ensureApprovedStudentAccess(user);
    if (accessError) {
      return res.status(403).json({
        success: false,
        message: accessError,
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

const requestProfilePasswordOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name email role isActive approvalStatus");

    if (!user || user.isActive === false) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const accessError = ensureApprovedStudentAccess(user);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const normalizedEmail = normalizeEmail(user.email);
    await issueOtpForUser({
      user,
      email: normalizedEmail,
      subject: "FINTRIX profile password change OTP",
      title: "Profile Password Change OTP",
      preheader: "Use this OTP to change your FINTRIX password from your profile.",
      intro: "A profile password change request was received for your FINTRIX account. Use the OTP below to continue securely.",
      footerNote: "Profile password change OTPs are generated securely by FINTRIX.",
    });

    return res.status(200).json({
      success: true,
      message: "An OTP has been sent to your registered email address.",
      data: {
        email: normalizedEmail,
      },
    });
  } catch (error) {
    console.error("Request profile password OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const changePasswordWithOtp = async (req, res) => {
  try {
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "otp and newPassword are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    const currentUser = await User.findById(req.user._id).select("email");
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const normalizedEmail = normalizeEmail(currentUser.email);
    const { user, resetRecord, error } = await validateOtpAndLoadUser({
      email: normalizedEmail,
      otp,
    });

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    if (String(user._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "OTP does not belong to the current account." });
    }

    user.password = newPassword;
    user.isFirstLogin = false;
    user.refreshTokenHash = null;
    await user.save();

    resetRecord.usedAt = new Date();
    await resetRecord.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password with OTP error:", error);
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

    const accessError = ensureApprovedStudentAccess(user);
    if (accessError) {
      return res.status(401).json({
        success: false,
        message: accessError,
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
        "studentId gender isEBL isActive createdAt"
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

    const accessError = ensureApprovedStudentAccess(user);
    if (accessError) {
      return res.status(403).json({
        success: false,
        message: accessError,
      });
    }

    let studentProfile = null;
    if (user.role === "student") {
      studentProfile = await Student.findOne({ userId: user._id }).select(
        "studentId gender isEBL isActive createdAt"
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

const signupStudent = async (req, res) => {
  try {
    const { name, email, password, gender, studentIdMode, studentId } = req.body;

    if (!name || !email || !password || !gender) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, and gender are required.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    logger.info("Student signup request received", {
      email: normalizedEmail,
      studentIdMode: String(studentIdMode || "manual").toLowerCase(),
    });

    const payload = await runInTransaction(async (session) => {
      const wantsManualId = String(studentIdMode || "").toLowerCase() === "manual";
      const resolvedStudentId = wantsManualId
        ? normalizeStudentId(studentId)
        : await generateTemporaryStudentId(session);
      const username = resolvedStudentId.toLowerCase();

      if (wantsManualId && !resolvedStudentId) {
        const error = new Error("studentId is required when entering an existing ID.");
        error.status = 400;
        throw error;
      }

      const [existingUser, existingStudent, existingRequest] = await Promise.all([
        User.findOne({
          $or: [{ email: normalizedEmail }, { username }],
        }).session(session),
        Student.findOne({ studentId: resolvedStudentId }).session(session),
        StudentSignupRequest.findOne({ studentId: resolvedStudentId }).session(session),
      ]);

      if (existingUser || existingStudent) {
        const error = new Error("A user with this email or student ID already exists.");
        error.status = 409;
        throw error;
      }

      if (existingRequest) {
        const error = new Error("A signup request already exists for this email or student ID.");
        error.status = 409;
        throw error;
      }

      const [user] = await User.create(
        [
          {
            name: String(name || "").trim(),
            username,
            email: normalizedEmail,
            phoneNumber: "",
            password,
            role: "student",
            hostelId: null,
            isFirstLogin: false,
            isActive: false,
            approvalStatus: "pending_caretaker",
          },
        ],
        { session }
      );

      const [request] = await StudentSignupRequest.create(
        [
          {
            userId: user._id,
            studentId: resolvedStudentId,
            isTemporaryId: !wantsManualId,
            gender,
            status: "pending_caretaker",
          },
        ],
        { session }
      );

      return { user, request };
    });

    const responseBody = {
      success: true,
      message: "Signup request submitted successfully. Please wait for approval.",
      data: {
        signupRequestId: payload.request._id,
        studentId: payload.request.studentId,
        isTemporaryId: payload.request.isTemporaryId,
        approvalStatus: payload.user.approvalStatus,
      },
    };

    res.status(201).json(responseBody);

    sendEmail({
      to: normalizedEmail,
      subject: "FINTRIX signup request received",
      html: buildEmailShell({
        title: "Signup Request Received",
        preheader: "Your student signup request has been submitted.",
        greeting: `Dear ${String(name || "Student").trim()},`,
        intro: "Your student signup request has been received successfully in FINTRIX and is now waiting for caretaker review.",
        highlight: payload.request.isTemporaryId
          ? `Temporary Student ID: ${payload.request.studentId}`
          : `Student ID: ${payload.request.studentId}`,
        rows: [
          { label: "Student ID", value: payload.request.studentId },
          { label: "Request Status", value: "Pending Caretaker Review" },
          { label: "Next Step", value: "Caretaker review, then admin approval" },
        ],
        outro: "Please keep this student ID safe. You can sign in only after your request has been approved.",
        footerNote: "Signup request notifications are sent automatically from FINTRIX.",
      }),
    })
      .then((emailResult) => {
        if (emailResult?.skipped) {
          logger.warn("Signup confirmation email skipped", {
            email: normalizedEmail,
            reason: emailResult.reason,
          });
          return;
        }

        if (!emailResult?.success) {
          logger.warn("Signup confirmation email failed", {
            email: normalizedEmail,
            reason: emailResult?.error || "Unknown email failure",
          });
          return;
        }

        logger.info("Signup confirmation email sent", {
          email: normalizedEmail,
          messageId: emailResult.messageId,
        });
      })
      .catch((emailError) => {
        logger.error("Unexpected signup email error", {
          email: normalizedEmail,
          error: emailError.message,
          stack: emailError.stack,
        });
      });

    logger.info("Student signup request created", {
      email: normalizedEmail,
      signupRequestId: String(payload.request._id),
      studentId: payload.request.studentId,
      isTemporaryId: payload.request.isTemporaryId,
    });
    return;
  } catch (error) {
    if (error.code === 11000 || error.status === 409) {
      return res.status(409).json({ success: false, message: error.message || "Duplicate signup request." });
    }

    logger.error("Student signup request failed", {
      error: error.message,
      stack: error.stack,
    });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const requestPasswordResetOtp = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+refreshTokenHash");

    if (user && user.isActive !== false && (user.role !== "student" || (user.approvalStatus || "approved") === "approved")) {
      await issueOtpForUser({
        user,
        email: normalizedEmail,
        subject: "FINTRIX password reset OTP",
        title: "Password Reset OTP",
        preheader: "Use this OTP to reset your FINTRIX password.",
        intro: "A password reset request was received for your FINTRIX account. Use the OTP below to continue.",
        footerNote: "Password reset OTPs are generated securely by FINTRIX.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "If an approved account exists for that email, an OTP has been sent.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!normalizedEmail || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "email, otp, and newPassword are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    const { user, resetRecord, error } = await validateOtpAndLoadUser({
      email: normalizedEmail,
      otp,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    user.password = newPassword;
    user.isFirstLogin = false;
    user.refreshTokenHash = null;
    await user.save();

    resetRecord.usedAt = new Date();
    await resetRecord.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
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
};
