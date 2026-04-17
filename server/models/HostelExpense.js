const mongoose = require("mongoose");

const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const hostelExpenseBillItemSchema = new mongoose.Schema(
  {
    store_name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    bill_number: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    bill_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const hostelExpenseBreakdownSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [hostelExpenseBillItemSchema],
      default: [],
    },
  },
  { _id: false }
);

const hostelExpenseSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: [true, "hostelId is required."],
    },
    month: {
      type: String,
      required: [true, "month is required."],
      trim: true,
      match: [monthPattern, 'month must be in "Mon-YYYY" format (e.g. Jan-2026).'],
    },

    elp: { type: Number, default: 0, min: 0 },
    chicken: { type: Number, default: 0, min: 0 },
    cylinder: { type: Number, default: 0, min: 0 },
    keb_total: { type: Number, default: 0, min: 0 },
    keb_girls: { type: Number, default: 0, min: 0 },
    keb_boys: { type: Number, default: 0, min: 0 },
    keb_per_girl: { type: Number, default: 0, min: 0 },
    keb_per_boy: { type: Number, default: 0, min: 0 },
    oil: { type: Number, default: 0, min: 0 },
    kirani: { type: Number, default: 0, min: 0 },
    milk: { type: Number, default: 0, min: 0 },
    labour_bill: { type: Number, default: 0, min: 0 },
    labour_night_watch: { type: Number, default: 0, min: 0 },
    labour_per_student: { type: Number, default: 0, min: 0 },
    labour_night_watch_per_girl: { type: Number, default: 0, min: 0 },
    hostel_fund: { type: Number, default: 0, min: 0 },

    milling: { type: Number, default: 0, min: 0 },
    veg: { type: Number, default: 0, min: 0 },
    banana: { type: Number, default: 0, min: 0 },
    bakery: { type: Number, default: 0, min: 0 },
    misc_per_student: { type: Number, default: 0, min: 0 },

    egg_total: { type: Number, default: 0, min: 0 },
    chicken_total_misc: { type: Number, default: 0, min: 0 },
    paneer_total: { type: Number, default: 0, min: 0 },
    egg_price_per_unit: { type: Number, default: 0, min: 0 },
    chicken_price_per_unit: { type: Number, default: 0, min: 0 },
    paneer_price_per_unit: { type: Number, default: 0, min: 0 },
    egg_price_per_3: { type: Number, default: 0, min: 0 },
    chicken_price_per_3: { type: Number, default: 0, min: 0 },
    paneer_price_per_3: { type: Number, default: 0, min: 0 },

    total_students: { type: Number, default: 0, min: 0 },
    total_girls: { type: Number, default: 0, min: 0 },
    total_boys: { type: Number, default: 0, min: 0 },
    egg_students_count: { type: Number, default: 0, min: 0 },
    chicken_students_count: { type: Number, default: 0, min: 0 },
    paneer_students_count: { type: Number, default: 0, min: 0 },
    bill_breakdowns: {
      type: [hostelExpenseBreakdownSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "warden_approved", "dean_approved"],
      default: "draft",
    },
    submittedAt: { type: Date, default: null },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedByWarden: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    wardenApprovedAt: { type: Date, default: null },
    wardenNotes: { type: String, default: "" },
    approvedByDean: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deanApprovedAt: { type: Date, default: null },
    deanNotes: { type: String, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required."],
    },
  },
  {
    timestamps: true,
  }
);

hostelExpenseSchema.index({ hostelId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("HostelExpense", hostelExpenseSchema);
