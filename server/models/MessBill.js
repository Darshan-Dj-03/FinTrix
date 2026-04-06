const mongoose = require("mongoose");

/**
 * MessBill schema – stores one student's monthly mess bill for a hostel.
 *
 * Charges are broken down into categories:
 *   - Base mess (elp, cylinder, oil, kirana, milk combined and split per student)
 *   - KEB (electricity split by gender)
 *   - Labour (shared across all active students)
 *   - Night watch (girls only)
 *   - Bakery + Banana (shared across all active students)
 *   - Unit items (egg, chicken, paneer – based on per-student consumption)
 *
 * Fine is calculated based on payment delay:
 *   - days_late <= 30: fine = days_late × 2
 *   - days_late > 30: fine = (30 × 2) + (remaining_days × 5)
 *   - For EBL students: fine may be reduced or zeroed (configurable)
 *
 * Unique constraint: one bill per student per month.
 */
const messBillSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────
    /**
     * Reference to Student document (1-to-1 with a User account).
     * Used for population and student self-access.
     */
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "studentId is required"],
    },

    /**
     * Reference to User document (for direct user info access).
     * Denormalized for convenience; derives from Student.userId.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },

    /**
     * Reference to Hostel.
     * Used to link bill to hostel context.
     */
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: [true, "hostelId is required"],
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

    // ── Charges ────────────────────────────────────────────────────────────────

    /**
     * Base mess charge: (elp + cylinder + oil + kirana + milk) / total_active_students
     */
    base_mess: {
      type: Number,
      default: 0,
      min: [0, "base_mess cannot be negative"],
    },

    /**
     * KEB (electricity) charge per student based on gender:
     *   girls: keb_girls / total_girls
     *   boys:  keb_boys / total_boys
     */
    keb_charge: {
      type: Number,
      default: 0,
      min: [0, "keb_charge cannot be negative"],
    },

    /**
     * Labour charge per student: labour_total / total_active_students
     */
    labour_charge: {
      type: Number,
      default: 0,
      min: [0, "labour_charge cannot be negative"],
    },

    /**
     * Night watch charge (girls only): night_watch_total / total_girls
     * For male students, this is always 0.
     */
    night_watch_charge: {
      type: Number,
      default: 0,
      min: [0, "night_watch_charge cannot be negative"],
    },

    /**
     * Bakery + Banana charge per student:
     * (bakery_total + banana_total) / total_active_students
     */
    bakery_charge: {
      type: Number,
      default: 0,
      min: [0, "bakery_charge cannot be negative"],
    },

    /**
     * Sum of dynamic monthly charges distributed per student.
     */
    additional_charge: {
      type: Number,
      default: 0,
      min: [0, "additional_charge cannot be negative"],
    },

    // ── Unit Items ─────────────────────────────────────────────────────────────

    /**
     * Egg consumption count for this student in the month.
     * Defaults to 0 if no consumption record exists.
     */
    egg_count: {
      type: Number,
      default: 0,
      min: [0, "egg_count cannot be negative"],
    },

    /**
     * Total egg charge: egg_price × egg_count
     */
    egg_total: {
      type: Number,
      default: 0,
      min: [0, "egg_total cannot be negative"],
    },

    /**
     * Chicken consumption count for this student in the month.
     */
    chicken_count: {
      type: Number,
      default: 0,
      min: [0, "chicken_count cannot be negative"],
    },

    /**
     * Total chicken charge: chicken_price × chicken_count
     */
    chicken_total: {
      type: Number,
      default: 0,
      min: [0, "chicken_total cannot be negative"],
    },

    /**
     * Paneer consumption count for this student in the month.
     */
    paneer_count: {
      type: Number,
      default: 0,
      min: [0, "paneer_count cannot be negative"],
    },

    /**
     * Total paneer charge: paneer_price × paneer_count
     */
    paneer_total: {
      type: Number,
      default: 0,
      min: [0, "paneer_total cannot be negative"],
    },

    // ── Final Amount & Payment ─────────────────────────────────────────────────

    /**
     * Total mess bill = base_mess + keb_charge + labour_charge +
     *                   (night_watch_charge if female, else 0) +
     *                   bakery_charge + additional_charge +
     *                   egg_total + chicken_total + paneer_total
     */
    total_amount: {
      type: Number,
      required: [true, "total_amount is required"],
      min: [0, "total_amount cannot be negative"],
    },

    /**
     * Fine amount based on payment delay.
     * Days late = current_date - due_date
     *   days_late <= 30: fine = days_late × 2
     *   days_late > 30:  fine = (30 × 2) + ((days_late - 30) × 5)
     *
     * For EBL students, fine defaults to 0 (configurable in calculation).
     */
    fine: {
      type: Number,
      default: 0,
      min: [0, "fine cannot be negative"],
    },

    /**
     * Due date for payment (typically 20th of the month after publication).
     * Used to calculate fine if payment is late.
     */
    due_date: {
      type: Date,
      required: [true, "due_date is required"],
    },

    /**
     * Payment status.
     *   - "pending": bill not yet paid
     *   - "paid": payment received in full
     */
    payment_status: {
      type: String,
      enum: {
        values: ["pending", "paid"],
        message: 'payment_status must be "pending" or "paid"',
      },
      default: "pending",
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

/**
 * Compound unique index: only ONE bill allowed per student per month.
 * This prevents accidental duplicate generation.
 */
messBillSchema.index({ studentId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MessBill", messBillSchema);
