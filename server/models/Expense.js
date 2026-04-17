const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
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
    elp: { type: Number, default: 0, min: [0, "elp cannot be negative."] },
    cylinder: { type: Number, default: 0, min: [0, "cylinder cannot be negative."] },
    oil: { type: Number, default: 0, min: [0, "oil cannot be negative."] },
    kirana: { type: Number, default: 0, min: [0, "kirana cannot be negative."] },
    milk: { type: Number, default: 0, min: [0, "milk cannot be negative."] },
    milk_total: { type: Number, default: 0, min: [0, "milk_total cannot be negative."] },
    keb_total: {
      type: Number,
      default: 0,
      min: [0, "keb_total cannot be negative."],
    },
    keb_girls: { type: Number, default: 0 },
    keb_boys: { type: Number, default: 0 },
    total_worker_days: {
      type: Number,
      default: 0,
      min: [0, "total_worker_days cannot be negative."],
    },
    labour_total: { type: Number, default: 0 },
    night_watch_total: { type: Number, default: 0 },
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
    banana_bakery_total: {
      type: Number,
      default: 0,
      min: [0, "banana_bakery_total cannot be negative."],
    },
    mess_bill_total: {
      type: Number,
      default: 0,
      min: [0, "mess_bill_total cannot be negative."],
    },
    mess_bill_per_day: {
      type: Number,
      default: 0,
      min: [0, "mess_bill_per_day cannot be negative."],
    },
    dynamic_charge_total: {
      type: Number,
      default: 0,
      min: [0, "dynamic_charge_total cannot be negative."],
    },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required."],
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "warden_approved", "dean_approved"],
      default: "draft",
    },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedByWarden: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    wardenApprovedAt: { type: Date, default: null },
    wardenNotes: { type: String, default: "" },
    approvedByDean: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deanApprovedAt: { type: Date, default: null },
    deanNotes: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ month: 1, hostelId: 1 }, { unique: true });

module.exports = mongoose.model("Expense", expenseSchema);
