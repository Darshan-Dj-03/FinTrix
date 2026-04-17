const mongoose = require("mongoose");

/**
 * StudentConsumption schema – tracks monthly per-student consumption counts
 * for unit-based food items (egg, chicken, paneer).
 *
 * Each record represents one student's consumption for one month.
 * Unique constraint: one record per student per month.
 * If no consumption record exists for a student, defaults are assumed (0 counts).
 */
const studentConsumptionSchema = new mongoose.Schema(
  {
    /**
     * Reference to the Student document.
     * Links consumption to a specific student account.
     */
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "studentId is required"],
    },

    /**
     * Month in "Mon-YYYY" format, e.g. "Jan-2026".
     * Combined with studentId, forms the unique key.
     */
    month: {
      type: String,
      required: [true, "month is required"],
      trim: true,
      match: [
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/,
        'month must be in "Mon-YYYY" format (e.g. Jan-2026)',
      ],
    },

    /**
     * Number of eggs consumed by this student in the month.
     * Multiplied by egg_price from expense to get egg_total in mess bill.
     */
    egg_count: {
      type: Number,
      default: 0,
      min: [0, "egg_count cannot be negative"],
    },

    /**
     * Number of chicken portions consumed by this student in the month.
     */
    chicken_count: {
      type: Number,
      default: 0,
      min: [0, "chicken_count cannot be negative"],
    },

    /**
     * Number of paneer portions consumed by this student in the month.
     */
    paneer_count: {
      type: Number,
      default: 0,
      min: [0, "paneer_count cannot be negative"],
    },

    /**
     * Direct milk amount consumed by this student in the month.
     * This is stored as an amount, not a count, so billing can charge
     * only students who actually consumed milk.
     */
    milk_amount: {
      type: Number,
      default: 0,
      min: [0, "milk_amount cannot be negative"],
    },

    /**
     * Manual fine added by caretaker for this student's month.
     * This is added on top of the system-calculated late fine.
     */
    fine_amount: {
      type: Number,
      default: 0,
      min: [0, "fine_amount cannot be negative"],
    },
    absent_days: {
      type: Number,
      default: 0,
      min: [0, "absent_days cannot be negative"],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

/**
 * Compound unique index: only ONE consumption record per student per month.
 * Prevents accidental duplicates and ensures data consistency.
 */
studentConsumptionSchema.index({ studentId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("StudentConsumption", studentConsumptionSchema);
