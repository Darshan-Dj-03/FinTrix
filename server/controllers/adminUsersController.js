const mongoose = require("mongoose");

const User = require("../models/User");
const Student = require("../models/Student");
const Hostel = require("../models/Hostel");
const { runInTransaction } = require("../utils/transaction");
const { createAuditLog } = require("../services/auditService");

const MANAGED_ROLES = ["student", "caretaker", "warden", "dean"];
const HOSTEL_REQUIRED_ROLES = ["student", "caretaker"];

const normalizeEmail = (email = "") => email.toLowerCase().trim();
const normalizeStudentId = (studentId = "") => studentId.trim().toUpperCase();

const generateTemporaryStudentId = async (session) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `TEMP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    const normalizedCandidate = normalizeStudentId(candidate);
    const usernameCandidate = normalizedCandidate.toLowerCase();

    const [studentConflict, userConflict] = await Promise.all([
      Student.findOne({ studentId: normalizedCandidate }).session(session),
      User.findOne({ username: usernameCandidate }).session(session),
    ]);

    if (!studentConflict && !userConflict) {
      return normalizedCandidate;
    }
  }

  const error = new Error("Unable to generate a unique temporary student ID. Please try again.");
  error.status = 500;
  throw error;
};

const buildManagedUserResponse = (user, studentProfile = null) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  hostelId: user.hostelId,
  isFirstLogin: user.isFirstLogin,
  isActive: user.isActive,
  createdAt: user.createdAt,
  studentProfile,
});

const validateHostelAssignment = async (role, hostelId, session) => {
  if (HOSTEL_REQUIRED_ROLES.includes(role) && !hostelId) {
    const error = new Error(`hostelId is required for role "${role}".`);
    error.status = 400;
    throw error;
  }

  if (!hostelId) return null;

  if (!mongoose.Types.ObjectId.isValid(hostelId)) {
    const error = new Error("Invalid hostelId format.");
    error.status = 400;
    throw error;
  }

  const hostel = await Hostel.findById(hostelId).session(session);
  if (!hostel) {
    const error = new Error("Hostel not found.");
    error.status = 404;
    throw error;
  }

  return hostel._id;
};

const createOrUpdateStudentProfile = async ({
  session,
  userId,
  existingStudent,
  studentId,
  gender,
  isActive,
  isTemporaryId,
}) => {
  const normalizedStudentId = normalizeStudentId(studentId);

  if (!normalizedStudentId) {
    const error = new Error("studentId is required for student users.");
    error.status = 400;
    throw error;
  }

  if (!gender) {
    const error = new Error("gender is required for student users.");
    error.status = 400;
    throw error;
  }

  const studentConflict = await Student.findOne({
    studentId: normalizedStudentId,
    userId: { $ne: userId },
  }).session(session);

  if (studentConflict) {
    const error = new Error(`Student ID "${normalizedStudentId}" is already registered.`);
    error.status = 409;
    throw error;
  }

  if (existingStudent) {
    existingStudent.studentId = normalizedStudentId;
    existingStudent.gender = gender;
    existingStudent.isActive = isActive;
    existingStudent.isTemporaryId = Boolean(isTemporaryId);
    await existingStudent.save({ session });
    return existingStudent;
  }

  const [student] = await Student.create(
    [
      {
        userId,
        studentId: normalizedStudentId,
        gender,
        isActive,
        isTemporaryId: Boolean(isTemporaryId),
      },
    ],
    { session }
  );

  return student;
};

const createManagedUser = async (req, res) => {
  try {
    const { name, email, password, role, hostelId, studentId, gender, studentIdMode } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, and role are required.",
      });
    }

    if (!MANAGED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${MANAGED_ROLES.join(", ")}.`,
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const payload = await runInTransaction(async (session) => {
      let resolvedStudentId = null;
      let isTemporaryId = false;
      let username = normalizedEmail;

      if (role === "student") {
        const wantsManualId = String(studentIdMode || "").toLowerCase() === "manual";
        resolvedStudentId = wantsManualId ? normalizeStudentId(studentId) : await generateTemporaryStudentId(session);
        isTemporaryId = !wantsManualId;
        username = resolvedStudentId.toLowerCase();
      }

      const identityChecks = [{ email: normalizedEmail }, { username }];

      const existingUser = await User.findOne({ $or: identityChecks }).session(session);

      if (existingUser) {
        const conflictLabel =
          existingUser.email === normalizedEmail
            ? `Email "${normalizedEmail}"`
            : `Student ID "${resolvedStudentId || studentId?.trim()}"`;
        const error = new Error(`${conflictLabel} is already in use.`);
        error.status = 409;
        throw error;
      }

      const normalizedHostelId = await validateHostelAssignment(role, hostelId, session);

      const [user] = await User.create(
        [
          {
            name: name.trim(),
            username,
            email: normalizedEmail,
            password,
            role,
            hostelId: normalizedHostelId,
            isFirstLogin: false,
            isActive: true,
          },
        ],
        { session }
      );

      let studentProfile = null;
      if (role === "student") {
        studentProfile = await createOrUpdateStudentProfile({
          session,
          userId: user._id,
          existingStudent: null,
          studentId: resolvedStudentId,
          gender,
          isActive: true,
          isTemporaryId,
        });
      }

      await createAuditLog({
        action: "USER_CREATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: user._id,
        entityType: "User",
        metadata: {
          createdRole: role,
          hostelId: normalizedHostelId,
        },
        session,
      });

      return {
        user: await User.findById(user._id).populate("hostelId", "name type location").session(session),
        studentProfile,
      };
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: buildManagedUserResponse(payload.user, payload.studentProfile),
    });
  } catch (error) {
    if (error.code === 11000 || error.status === 409) {
      return res.status(409).json({ success: false, message: error.message || "Duplicate user." });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate("hostelId", "name type location")
      .sort({ createdAt: -1 })
      .lean();

    const students = await Student.find({ userId: { $in: users.map((user) => user._id) } })
      .select("userId studentId gender isEBL isActive isTemporaryId")
      .lean();

    const studentMap = new Map(students.map((student) => [String(student.userId), student]));

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully.",
      data: users.map((user) =>
        buildManagedUserResponse(
          user,
          user.role === "student" ? studentMap.get(String(user._id)) || null : null
        )
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const updateManagedUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, hostelId, isActive, studentId, gender, studentIdMode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }

    const payload = await runInTransaction(async (session) => {
      const user = await User.findById(id).session(session);

      if (!user) {
        const error = new Error("User not found.");
        error.status = 404;
        throw error;
      }

      if (req.user._id.toString() === user._id.toString() && isActive === false) {
        const error = new Error("You cannot deactivate your own account.");
        error.status = 400;
        throw error;
      }

      const nextRole = role ?? user.role;
      if (!["admin", ...MANAGED_ROLES].includes(nextRole)) {
        const error = new Error("Invalid role.");
        error.status = 400;
        throw error;
      }

      if (user.role !== "student" && nextRole === "admin") {
        const error = new Error("Promoting users to admin from this screen is not allowed.");
        error.status = 400;
        throw error;
      }

      if (name !== undefined) user.name = name.trim();

      if (email !== undefined) {
        const normalizedEmail = normalizeEmail(email);
        const emailConflict = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        }).session(session);

        if (emailConflict) {
          const error = new Error(`Email "${normalizedEmail}" is already in use.`);
          error.status = 409;
          throw error;
        }

        user.email = normalizedEmail;
      }

      const resolvedHostelId = await validateHostelAssignment(
        nextRole,
        hostelId ?? user.hostelId,
        session
      );
      user.hostelId = resolvedHostelId;
      user.role = nextRole;

      if (isActive !== undefined) {
        user.isActive = Boolean(isActive);
      }

      let studentProfile = await Student.findOne({ userId: user._id }).session(session);
      if (nextRole === "student") {
        const wantsManualId = String(studentIdMode || "").toLowerCase() === "manual";
        const nextStudentId =
          wantsManualId
            ? normalizeStudentId(studentId)
            : studentId
              ? normalizeStudentId(studentId)
              : studentProfile?.studentId || (await generateTemporaryStudentId(session));
        const desiredUsername = nextStudentId?.trim().toLowerCase();

        if (!desiredUsername) {
          const error = new Error("studentId is required for student users.");
          error.status = 400;
          throw error;
        }

        const usernameConflict = await User.findOne({
          username: desiredUsername,
          _id: { $ne: user._id },
        }).session(session);

        if (usernameConflict) {
          const error = new Error(`Student ID "${nextStudentId}" is already in use.`);
          error.status = 409;
          throw error;
        }

        user.username = desiredUsername;
        studentProfile = await createOrUpdateStudentProfile({
          session,
          userId: user._id,
          existingStudent: studentProfile,
          studentId: nextStudentId,
          gender: gender ?? studentProfile?.gender,
          isActive: user.isActive,
          isTemporaryId: wantsManualId ? false : studentProfile?.isTemporaryId ?? !studentId,
        });
      } else if (studentProfile) {
        if (user.email) {
          user.username = user.email;
        }
        studentProfile.isActive = false;
        await studentProfile.save({ session });
      } else if (user.email) {
        user.username = user.email;
      }

      await user.save({ session });

      await createAuditLog({
        action: "USER_UPDATED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: user._id,
        entityType: "User",
        metadata: {
          updatedRole: user.role,
          hostelId: user.hostelId,
          isActive: user.isActive,
        },
        session,
      });

      return {
        user: await User.findById(user._id)
          .populate("hostelId", "name type location")
          .session(session),
        studentProfile: user.role === "student" ? studentProfile : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: buildManagedUserResponse(payload.user, payload.studentProfile),
    });
  } catch (error) {
    if (error.code === 11000 || error.status === 409) {
      return res.status(409).json({ success: false, message: error.message || "Duplicate user." });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

module.exports = {
  createManagedUser,
  listUsers,
  updateManagedUser,
};
