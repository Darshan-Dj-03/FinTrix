const mongoose = require("mongoose");
const User = require("../models/User");
const Hostel = require("../models/Hostel");

// Temporary password assigned to every newly created user
const TEMP_PASSWORD = "Fintrix@123";

/**
 * @route   POST /admin/create-user
 * @access  Protected – admin only
 * @desc    Create a new non-student user (caretaker, warden, dean).
 *          Returns the generated credentials so the admin can share them.
 *
 * Body: { name, username, role, hostelId? }
 */
const createUser = async (req, res) => {
  try {
    const { name, username, role, hostelId } = req.body;

    // 1. Validate required fields
    if (!name || !username || !role) {
      return res.status(400).json({
        success: false,
        message: "name, username, and role are required.",
      });
    }

    // 2. Prevent creating admin or student via this route
    //    Students must be created via POST /student/add
    const restrictedRoles = ["admin", "student"];
    if (restrictedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Cannot create a user with role "${role}" via this route.`,
      });
    }

    // 3. Validate hostelId if provided (must be a real Hostel document)
    if (hostelId) {
      if (!mongoose.Types.ObjectId.isValid(hostelId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hostelId format.",
        });
      }
      const hostelExists = await Hostel.findById(hostelId);
      if (!hostelExists) {
        return res.status(404).json({
          success: false,
          message: "Hostel not found. Please provide a valid hostelId.",
        });
      }
    }

    // 4. Check if username is already taken
    const existingUser = await User.findOne({
      username: username.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `Username "${username}" is already taken.`,
      });
    }

    // 5. Create user with temp password
    //    The pre-save hook in User.js handles hashing automatically
    const newUser = await User.create({
      name,
      username: username.toLowerCase().trim(),
      password: TEMP_PASSWORD,
      role,
      hostelId: hostelId || null,
      isFirstLogin: true,
    });

    // 5. Return credentials (only time plain temp password is revealed)
    return res.status(201).json({
      success: true,
      message: `User "${newUser.username}" created successfully.`,
      credentials: {
        username: newUser.username,
        temporaryPassword: TEMP_PASSWORD,
      },
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
        hostelId: newUser.hostelId,
        isFirstLogin: newUser.isFirstLogin,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    // Handle mongoose duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username already exists.",
      });
    }
    console.error("Create user error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { createUser };
