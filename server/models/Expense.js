const mongoose = require("mongoose");

/**
 * Expense schema – stores one complete monthly expense record per hostel.
 *
 * Three categories:
 *  1. DIRECT     – simple totals (elp, cylinder, oil, kirana, milk)
 *  2. CALCULATED – values that are derived from raw inputs at save/update time
 *                  (KEB split, Labour totals, Bakery & Banana)
 *  3. UNIT       – per-unit prices only; totals computed later in mess-bill phase
 *                  (egg, chicken, paneer)
 *
 * Calculated fields are ALWAYS stored alongside their raw inputs so the
 * record is self-contained and auditable.
 */
const expenseSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────

    /**
     * Month in "Mon-YYYY" format, e.g. "Jan-2026", "Feb-2026".
     * Combined with hostelId this forms a natural unique key.
     */
    month: {
      type: String,
      required: [true, "month is required."],
      trim: true,
      match: [
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/,
        'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      ],
    },

    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: [true, "hostelId is required."],
    },

    // ── CATEGORY 1: Direct Expenses ───────────────────────────────────────────
    // Simple lump-sum values entered directly by the caretaker.

    elp: { type: Number, default: 0, min: [0, "elp cannot be negative."] },
    cylinder: { type: Number, default: 0, min: [0, "cylinder cannot be negative."] },
    oil: { type: Number, default: 0, min: [0, "oil cannot be negative."] },
    kirana: { type: Number, default: 0, min: [0, "kirana cannot be negative."] },
    milk: { type: Number, default: 0, min: [0, "milk cannot be negative."] },

    // ── CATEGORY 2a: KEB (Electricity) ────────────────────────────────────────
    // Input:  keb_total  (raw)
    // Output: keb_girls  = keb_total × 0.70  (computed)
    //         keb_boys   = keb_total × 0.30  (computed)

    keb_total: {
      type: Number,
      default: 0,
      min: [0, "keb_total cannot be negative."],
    },
    keb_girls: { type: Number, default: 0 }, // 70% – computed, do not send in body
    keb_boys: { type: Number, default: 0 },  // 30% – computed, do not send in body

    // ── CATEGORY 2b: Labour ───────────────────────────────────────────────────
    // Input:  working_days      (raw)
    // Output: labour_total      = working_days × 325 × 6  (all students, computed)
    //         night_watch_total = working_days × 325       (girls only, computed)

    working_days: {
      type: Number,
      default: 0,
      min: [0, "working_days cannot be negative."],
    },
    labour_total: { type: Number, default: 0 },       // computed
    night_watch_total: { type: Number, default: 0 },  // computed

    // ── CATEGORY 2c: Bakery & Banana ──────────────────────────────────────────
    // Stored as simple totals; will be divided among students in mess-bill phase.

    bakery_total: {
      type: Number,
      default: 0,
      min: [0, "bakery_total cannot be negative."],
    },
    banana_total: {
      type: Number,
      default: 0,
      min: [0, "banana_total cannot be negative."],
    },

    // ── CATEGORY 3: Unit-Based Prices ─────────────────────────────────────────
    // Only the per-unit price is stored here.
    // Final multiplication (price × quantity per student) happens in mess-bill.

    egg_price: {
      type: Number,
      default: 0,
      min: [0, "egg_price cannot be negative."],
    },
    chicken_price: {
      type: Number,
      default: 0,
      min: [0, "chicken_price cannot be negative."],
    },
    paneer_price: {
      type: Number,
      default: 0,
      min: [0, "paneer_price cannot be negative."],
    },

    // ── Audit ──────────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required."],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

/**
 * Compound unique index:
 * Only ONE expense record is allowed per hostel per month.
 */
expenseSchema.index({ month: 1, hostelId: 1 }, { unique: true });

module.exports = mongoose.model("Expense", expenseSchema);
