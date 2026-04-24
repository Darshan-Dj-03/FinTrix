const mongoose = require("mongoose");

/**
 * Student profile schema – extended data for users with role "student".
 * Each Student document is linked 1-to-1 with a User document via userId.
 */
const studentSchema = new mongoose.Schema(
  {
    // Reference to the corresponding User document
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      unique: true,
    },

    // Human-readable student ID (e.g. "STU2024001"), also used as username
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: [true, "Gender is required"],
    },

    // EBL = SC/ST reimbursement workflow eligibility
    isEBL: {
      type: Boolean,
      default: false,
    },
    eblCategory: {
      type: String,
      enum: ["", "SC", "ST"],
      default: "",
      uppercase: true,
      trim: true,
    },
    // false = on vacation / inactive (not billed for that period)
    isActive: {
      type: Boolean,
      default: true,
    },
    isTemporaryId: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Student", studentSchema);
