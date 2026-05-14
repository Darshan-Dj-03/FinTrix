const mongoose = require("mongoose");

const hostelDepositSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "studentId is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: [true, "hostelId is required"],
    },
    academicYear: {
      type: String,
      required: [true, "academicYear is required"],
      trim: true,
      maxlength: [30, "academicYear cannot exceed 30 characters"],
    },
    amountReceived: {
      type: Number,
      required: [true, "amountReceived is required"],
      min: [0, "amountReceived cannot be negative"],
    },
    amountUsed: {
      type: Number,
      default: 0,
      min: [0, "amountUsed cannot be negative"],
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "accepted"],
        message: 'status must be "draft" or "accepted"',
      },
      default: "draft",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "notes cannot exceed 500 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },
  },
  {
    timestamps: true,
  }
);

hostelDepositSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });
hostelDepositSchema.index({ hostelId: 1, academicYear: 1 });

module.exports = mongoose.model("HostelDeposit", hostelDepositSchema);
