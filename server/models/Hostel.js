const mongoose = require("mongoose");

/**
 * Hostel schema – represents a physical hostel building in the system.
 * Users (caretaker, warden, student) and Expenses are linked to a Hostel.
 */
const hostelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hostel name is required"],
      trim: true,
      unique: true,
    },

    location: {
      type: String,
      trim: true,
      default: null,
    },

    // "boys" or "girls" – drives KEB split logic (boys 30%, girls 70%)
    type: {
      type: String,
      enum: {
        values: ["boys", "girls"],
        message: 'Hostel type must be "boys" or "girls".',
      },
      required: [true, "Hostel type is required"],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

module.exports = mongoose.model("Hostel", hostelSchema);
