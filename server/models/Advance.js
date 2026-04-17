const mongoose = require("mongoose");

const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const advanceBillDateSchema = new mongoose.Schema(
  {
    billDate: {
      type: Date,
      required: [true, "billDate is required."],
    },
  },
  { _id: true }
);

const advanceSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: [true, "hostelId is required."],
    },
    prefectStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "prefectStudentId is required."],
    },
    month: {
      type: String,
      required: [true, "month is required."],
      trim: true,
      match: [monthPattern, 'month must be in "Mon-YYYY" format (e.g. Jan-2026).'],
    },
    takenAmount: {
      type: Number,
      required: [true, "takenAmount is required."],
      min: [0, "takenAmount cannot be negative"],
    },
    closedAmount: {
      type: Number,
      default: 0,
      min: [0, "closedAmount cannot be negative"],
    },
    billDates: {
      type: [advanceBillDateSchema],
      default: [],
    },
    chequeDetails: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required."],
    },
  },
  { timestamps: true }
);

advanceSchema.index({ hostelId: 1, month: 1, prefectStudentId: 1, createdAt: -1 });

module.exports = mongoose.model("Advance", advanceSchema);
