const mongoose = require("mongoose");

const nocSettlementSchema = new mongoose.Schema(
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
    leavingDate: {
      type: Date,
      default: null,
    },
    baseAmount: {
      type: Number,
      required: [true, "baseAmount is required"],
      min: [0, "baseAmount cannot be negative"],
    },
    damagesAmount: {
      type: Number,
      default: 0,
      min: [0, "damagesAmount cannot be negative"],
    },
    othersAmount: {
      type: Number,
      default: 0,
      min: [0, "othersAmount cannot be negative"],
    },
    balanceAmount: {
      type: Number,
      required: [true, "balanceAmount is required"],
      min: [0, "balanceAmount cannot be negative"],
    },
    useHostelDeposit: {
      type: Boolean,
      default: false,
    },
    hostelDepositId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostelDeposit",
      default: null,
    },
    hostelDepositAppliedAmount: {
      type: Number,
      default: 0,
      min: [0, "hostelDepositAppliedAmount cannot be negative"],
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: [0, "remainingAmount cannot be negative"],
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "notes cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "paid"],
        message: 'status must be "pending" or "paid"',
      },
      default: "pending",
    },
    student_payment_mode: {
      type: String,
      enum: {
        values: ["cash", "upi", ""],
        message: 'student_payment_mode must be "cash" or "upi"',
      },
      default: "",
    },
    student_payment_made_date: {
      type: Date,
      default: null,
    },
    student_utr_number: {
      type: String,
      default: "",
      trim: true,
      maxlength: [100, "student_utr_number cannot exceed 100 characters"],
    },
    amount_paid: {
      type: Number,
      default: 0,
      min: [0, "amount_paid cannot be negative"],
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
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

nocSettlementSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });
nocSettlementSchema.index({ hostelId: 1, academicYear: 1, status: 1 });
nocSettlementSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("NocSettlement", nocSettlementSchema);
