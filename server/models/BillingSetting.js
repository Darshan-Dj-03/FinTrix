const mongoose = require("mongoose");

const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const billingSettingSchema = new mongoose.Schema(
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
    dueDate: {
      type: Date,
      default: null,
    },
    announcementDate: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "updatedBy is required."],
    },
  },
  { timestamps: true }
);

billingSettingSchema.index({ hostelId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("BillingSetting", billingSettingSchema);
