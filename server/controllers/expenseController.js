const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Hostel = require("../models/Hostel");

// ─── Month format validator ───────────────────────────────────────────────────
const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

// ─── Calculation Engine ───────────────────────────────────────────────────────

/**
 * Given the two raw inputs that drive derived fields, returns an object
 * containing all computed values ready to be spread into a create/update payload.
 *
 * KEB split:
 *   keb_girls = keb_total × 70%
 *   keb_boys  = keb_total × 30%
 *   Values are rounded to 2 decimal places to avoid floating-point drift.
 *
 * Labour:
 *   labour_total      = working_days × 325 × 6   (shared across all students)
 *   night_watch_total = working_days × 325        (girls hostel only)
 *
 * @param {number} keb_total
 * @param {number} working_days
 * @returns {{ keb_girls, keb_boys, labour_total, night_watch_total }}
 */
const calculateDerivedFields = (keb_total = 0, working_days = 0) => {
  const keb   = Number(keb_total)    || 0;
  const days  = Number(working_days) || 0;

  return {
    keb_girls:         parseFloat((keb * 0.70).toFixed(2)),
    keb_boys:          parseFloat((keb * 0.30).toFixed(2)),
    labour_total:      days * 325 * 6,
    night_watch_total: days * 325,
  };
};

// ─── Populate helper ──────────────────────────────────────────────────────────
// Reused in create, get, and update responses to keep shape consistent.
const POPULATE_HOSTEL    = { path: "hostelId",  select: "name type location" };
const POPULATE_CREATED_BY = { path: "createdBy", select: "name username role" };

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @route   POST /expense/create
 * @access  Protected – caretaker only
 * @desc    Create a monthly expense record for a hostel.
 *          Raw inputs are accepted; derived values are computed automatically.
 *
 * Body (all monetary fields default to 0 if omitted):
 *   month*, hostelId*,
 *   elp, cylinder, oil, kirana, milk,
 *   keb_total, working_days,
 *   bakery_total, banana_total,
 *   egg_price, chicken_price, paneer_price
 */
const createExpense = async (req, res) => {
  try {
    const {
      month,
      hostelId,
      // Category 1 – Direct
      elp, cylinder, oil, kirana, milk,
      // Category 2a – KEB (raw)
      keb_total,
      // Category 2b – Labour (raw)
      working_days,
      // Category 2c – Bakery & Banana
      bakery_total, banana_total,
      // Category 3 – Unit prices
      egg_price, chicken_price, paneer_price,
    } = req.body;

    // ── 1. Required field validation ─────────────────────────────────────────
    if (!month || !hostelId) {
      return res.status(400).json({
        success: false,
        message: "month and hostelId are required.",
      });
    }

    // ── 2. Month format validation ───────────────────────────────────────────
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    // ── 3. Hostel existence check ────────────────────────────────────────────
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: "Hostel not found. Please provide a valid hostelId.",
      });
    }

    // ── 4. Uniqueness check (one record per hostel per month) ────────────────
    const alreadyExists = await Expense.findOne({ month, hostelId });
    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: `An expense record for ${month} in hostel "${hostel.name}" already exists.`,
      });
    }

    // ── 5. Compute derived fields ────────────────────────────────────────────
    const derived = calculateDerivedFields(keb_total, working_days);

    // ── 6. Persist ───────────────────────────────────────────────────────────
    const expense = await Expense.create({
      month,
      hostelId,
      // Direct
      elp:       Number(elp)       || 0,
      cylinder:  Number(cylinder)  || 0,
      oil:       Number(oil)       || 0,
      kirana:    Number(kirana)    || 0,
      milk:      Number(milk)      || 0,
      // KEB – raw + computed
      keb_total:  Number(keb_total)  || 0,
      ...derived, // injects keb_girls, keb_boys, labour_total, night_watch_total
      // Labour – raw (computed already spread above)
      working_days: Number(working_days) || 0,
      // Bakery & Banana
      bakery_total: Number(bakery_total) || 0,
      banana_total: Number(banana_total) || 0,
      // Unit prices
      egg_price:     Number(egg_price)     || 0,
      chicken_price: Number(chicken_price) || 0,
      paneer_price:  Number(paneer_price)  || 0,
      // Audit
      createdBy: req.user._id,
    });

    const populated = await expense.populate([POPULATE_HOSTEL, POPULATE_CREATED_BY]);

    return res.status(201).json({
      success: true,
      message: `Expense for ${month} (${hostel.name}) created successfully.`,
      expense: populated,
    });
  } catch (error) {
    // Duplicate key (race condition – uniqueness index fires)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An expense record for this hostel and month already exists.",
      });
    }
    // Mongoose schema validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(". ") });
    }
    // Invalid ObjectId for hostelId
    if (error.name === "CastError" && error.path === "hostelId") {
      return res.status(400).json({ success: false, message: "Invalid hostelId format." });
    }
    console.error("Create expense error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   GET /expense/:month
 * @access  Protected – caretaker or admin
 * @desc    Return all expense records for the given month (across all hostels).
 *          Use query param ?hostelId=<id> to filter to a single hostel.
 *
 * Param:  month  – e.g. "Jan-2026"
 * Query:  hostelId (optional)
 */
const getExpenseByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    // Validate month format
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const filter = { month };

    // Optional hostelId filter via query string
    if (req.query.hostelId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hostelId)) {
        return res.status(400).json({ success: false, message: "Invalid hostelId format." });
      }
      filter.hostelId = req.query.hostelId;
    }

    const expenses = await Expense.find(filter)
      .populate(POPULATE_HOSTEL)
      .populate(POPULATE_CREATED_BY)
      .sort({ "hostelId.name": 1 });

    return res.status(200).json({
      success: true,
      month,
      count: expenses.length,
      expenses,
    });
  } catch (error) {
    console.error("Get expense error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   PATCH /expense/:id
 * @access  Protected – caretaker only
 * @desc    Update raw inputs for an existing expense record.
 *          If keb_total or working_days changes, derived fields are recalculated.
 *
 * Body (all optional):
 *   elp, cylinder, oil, kirana, milk,
 *   keb_total, working_days,
 *   bakery_total, banana_total,
 *   egg_price, chicken_price, paneer_price
 */
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    // ── 1. Fetch the existing record ─────────────────────────────────────────
    const existing = await Expense.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    const {
      elp, cylinder, oil, kirana, milk,
      keb_total,
      working_days,
      bakery_total, banana_total,
      egg_price, chicken_price, paneer_price,
    } = req.body;

    // ── 2. Resolve values: use incoming value if present, else keep existing ──
    const resolvedKebTotal    = keb_total    !== undefined ? Number(keb_total)    : existing.keb_total;
    const resolvedWorkingDays = working_days !== undefined ? Number(working_days) : existing.working_days;

    // ── 3. Recompute derived fields based on resolved raw inputs ─────────────
    const derived = calculateDerivedFields(resolvedKebTotal, resolvedWorkingDays);

    // ── 4. Build update object (only fields present in the request body) ─────
    const updateFields = {
      // Always rewrite raw inputs + derived together for consistency
      keb_total:    resolvedKebTotal,
      working_days: resolvedWorkingDays,
      ...derived,
    };

    if (elp       !== undefined) updateFields.elp       = Number(elp);
    if (cylinder  !== undefined) updateFields.cylinder  = Number(cylinder);
    if (oil       !== undefined) updateFields.oil       = Number(oil);
    if (kirana    !== undefined) updateFields.kirana    = Number(kirana);
    if (milk      !== undefined) updateFields.milk      = Number(milk);

    if (bakery_total !== undefined) updateFields.bakery_total = Number(bakery_total);
    if (banana_total !== undefined) updateFields.banana_total = Number(banana_total);

    if (egg_price     !== undefined) updateFields.egg_price     = Number(egg_price);
    if (chicken_price !== undefined) updateFields.chicken_price = Number(chicken_price);
    if (paneer_price  !== undefined) updateFields.paneer_price  = Number(paneer_price);

    // ── 5. Persist ───────────────────────────────────────────────────────────
    const updated = await Expense.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate(POPULATE_HOSTEL)
      .populate(POPULATE_CREATED_BY);

    return res.status(200).json({
      success: true,
      message: "Expense record updated successfully.",
      expense: updated,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID format.",
      });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(". ") });
    }
    console.error("Update expense error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   DELETE /expense/:id
 * @access  Protected – caretaker only
 * @desc    Delete an expense record by its MongoDB _id.
 */
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Expense record for ${deleted.month} deleted successfully.`,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID format.",
      });
    }
    console.error("Delete expense error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { createExpense, getExpenseByMonth, updateExpense, deleteExpense };
