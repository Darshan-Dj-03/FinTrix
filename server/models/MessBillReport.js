const mongoose = require("mongoose");

const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const messBillReportSchema = new mongoose.Schema(
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
    billCount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
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
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "generatedBy is required."],
    },
  },
  { timestamps: true }
);

messBillReportSchema.index({ hostelId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MessBillReport", messBillReportSchema);
