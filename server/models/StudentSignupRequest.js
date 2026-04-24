const mongoose = require("mongoose");

const studentSignupRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    isTemporaryId: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending_caretaker", "pending_admin", "approved", "rejected"],
      default: "pending_caretaker",
    },
    assignedHostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
    },
    assignedIsEBL: {
      type: Boolean,
      default: false,
    },
    assignedEblCategory: {
      type: String,
      enum: ["", "SC", "ST"],
      default: "",
      uppercase: true,
      trim: true,
    },
    caretakerReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    caretakerReviewedAt: {
      type: Date,
      default: null,
    },
    adminReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminReviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

studentSignupRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("StudentSignupRequest", studentSignupRequestSchema);
