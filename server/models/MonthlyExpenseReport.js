const mongoose = require("mongoose");

const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const monthlyExpenseReportSchema = new mongoose.Schema(
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
    msc_total: { type: Number, default: 0, min: 0 },
    closing_balance_last_month: { type: Number, default: 0, min: 0 },
    total_closing_balance: { type: Number, default: 0, min: 0 },
    opening_balance: { type: Number, default: 0, min: 0 },
    total_opening_balance: { type: Number, default: 0 },
    guest_charges: { type: Number, default: 0, min: 0 },
    total_expenditure: { type: Number, default: 0 },
    total_days: { type: Number, default: 0, min: 0 },
    mess_bill_per_day: { type: Number, default: 0 },
    electricity_bill: { type: Number, default: 0, min: 0 },
    internet: { type: Number, default: 0, min: 0 },
    labour_payment: { type: Number, default: 0, min: 0 },
    other_misc: { type: Number, default: 0, min: 0 },
    total_students: { type: Number, default: 0, min: 0 },
    total_boys: { type: Number, default: 0, min: 0 },
    total_girls: { type: Number, default: 0, min: 0 },
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
    opening_balance_manual: { type: Boolean, default: true },
    closing_balance_source_month: { type: String, default: null },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "generatedBy is required."],
    },
    hostelExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostelExpense",
      required: [true, "hostelExpenseId is required."],
    },
  },
  {
    timestamps: true,
  }
);

monthlyExpenseReportSchema.index({ hostelId: 1, month: 1 }, { unique: true });
monthlyExpenseReportSchema.index({ month: 1, hostelId: 1 });

module.exports = mongoose.model("MonthlyExpenseReport", monthlyExpenseReportSchema);
