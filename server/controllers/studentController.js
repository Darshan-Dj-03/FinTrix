const mongoose = require("mongoose");
const User = require("../models/User");
const Student = require("../models/Student");
const Hostel = require("../models/Hostel");

// ─── Populate config ─────────────────────────────────────────────────────────
// Deep-populates hostelId (ObjectId on User) so responses include hostel details.
const USER_POPULATE = {
  path: "userId",
  select: "name username hostelId isFirstLogin createdAt",
  populate: {
    path: "hostelId",
    select: "name type location",
  },
};

// Temporary password assigned to newly created student accounts
const TEMP_PASSWORD = "Fintrix@123";

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @route   POST /student/add
 * @access  Protected – admin only
 * @desc    Creates both a User (role=student) and a linked Student profile
 *          in a single atomic-like operation.
 *
 * Body: { name, studentId, gender, hostelId?, isEBL? }
 */
const addStudent = async (req, res) => {
  // Use a mongoose session for transactional safety (both docs or neither)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, studentId, gender, hostelId, isEBL } = req.body;

    // 1. Validate required fields
    if (!name || !studentId || !gender) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "name, studentId, and gender are required.",
      });
    }

    const normalizedStudentId = studentId.trim().toUpperCase();

    // 2. Validate hostelId if provided
    if (hostelId) {
      if (!mongoose.Types.ObjectId.isValid(hostelId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Invalid hostelId format.",
        });
      }
      const hostelExists = await Hostel.findById(hostelId).session(session);
      if (!hostelExists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Hostel not found. Please provide a valid hostelId.",
        });
      }
    }

    // 3. Check if studentId is already in use (as username or studentId)
    const existingUser = await User.findOne({
      username: normalizedStudentId.toLowerCase(),
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: `Student ID "${normalizedStudentId}" is already registered.`,
      });
    }

    // 3. Create the User document (username = studentId, lowercase)
    //    The pre-save hook hashes the password automatically
    const [newUser] = await User.create(
      [
        {
          name,
          username: normalizedStudentId.toLowerCase(),
          password: TEMP_PASSWORD,
          role: "student",
          hostelId: hostelId || null,
          isFirstLogin: true,
        },
      ],
      { session }
    );

    // 4. Create the Student profile linked to the new User
    const [newStudent] = await Student.create(
      [
        {
          userId: newUser._id,
          studentId: normalizedStudentId,
          gender,
          isEBL: isEBL || false,
          isActive: true,
        },
      ],
      { session }
    );

    // 5. Commit both documents together
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: `Student "${normalizedStudentId}" created successfully.`,
      credentials: {
        username: newUser.username,
        temporaryPassword: TEMP_PASSWORD,
      },
      student: {
        id: newStudent._id,
        studentId: newStudent.studentId,
        name: newUser.name,
        gender: newStudent.gender,
        hostelId: newUser.hostelId,
        isEBL: newStudent.isEBL,
        isActive: newStudent.isActive,
        createdAt: newStudent.createdAt,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Student ID or username already exists.",
      });
    }
    console.error("Add student error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   GET /student/all
 * @access  Protected – admin or caretaker
 * @desc    Returns all student profiles with their associated user info.
 */
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate(USER_POPULATE)
      .sort({ createdAt: -1 }); // Newest first

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get all students error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   PATCH /student/update/:id
 * @access  Protected – admin or caretaker
 * @desc    Update a student's gender, isEBL, or isActive flag.
 *          :id is the Student document _id.
 *
 * Body (all optional): { gender, isEBL, isActive }
 */
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { gender, isEBL, isActive } = req.body;

    // Build update object with only the fields provided
    const updateFields = {};
    if (gender !== undefined) updateFields.gender = gender;
    if (isEBL !== undefined) updateFields.isEBL = isEBL;
    if (isActive !== undefined) updateFields.isActive = isActive;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No updatable fields provided. Accepted: gender, isEBL, isActive.",
      });
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).populate(USER_POPULATE);

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully.",
      student: updatedStudent,
    });
  } catch (error) {
    // Handle invalid MongoDB ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID format.",
      });
    }
    console.error("Update student error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { addStudent, getAllStudents, updateStudent };
