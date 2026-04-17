const mongoose = require("mongoose");

const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const guestChargeSchema = new mongoose.Schema(
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
    event_name: {
      type: String,
      required: [true, "event_name is required."],
      trim: true,
    },
    event_start_date: {
      type: Date,
      required: [true, "event_start_date is required."],
    },
    event_end_date: {
      type: Date,
      required: [true, "event_end_date is required."],
    },
    guest_count: {
      type: Number,
      required: [true, "guest_count is required."],
      min: [0, "guest_count cannot be negative."],
    },
    amount: {
      type: Number,
      required: [true, "amount is required."],
      min: [0, "amount cannot be negative."],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "addedBy is required."],
    },
  },
  {
    timestamps: true,
  }
);

guestChargeSchema.index({ hostelId: 1, month: 1 });
guestChargeSchema.index({ hostelId: 1, month: 1, event_name: 1, event_start_date: 1 });

module.exports = mongoose.model("GuestCharge", guestChargeSchema);
