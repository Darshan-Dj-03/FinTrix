const mongoose = require("mongoose");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const eblMonthlyDetailSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      match: [MONTH_REGEX, 'month must be in "Mon-YYYY" format'],
    },
    messBillAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    goiAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    claimedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    differenceAmount: {
      type: Number,
      required: true,
    },
    studentPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["ebl", "partial_scholarship_received", "partial_university_claim_received", "paid"],
      default: "ebl",
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MessBill",
      default: null,
    },
  },
  { _id: false }
);

const eblPeriodSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    fromMonth: {
      type: String,
      required: true,
      match: [MONTH_REGEX, 'fromMonth must be in "Mon-YYYY" format'],
    },
    toMonth: {
      type: String,
      required: true,
      match: [MONTH_REGEX, 'toMonth must be in "Mon-YYYY" format'],
    },
    monthlyGoiAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    universityClaimAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    periodUtr: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    scholarshipNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["draft", "verified", "warden_approved"],
      default: "draft",
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
    approvedByWarden: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    monthlyDetails: {
      type: [eblMonthlyDetailSchema],
      default: [],
    },
    totals: {
      totalMessBill: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalScholarship: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalClaimedAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalDifference: {
        type: Number,
        default: 0,
      },
      totalStudentPaid: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalRemainingBalance: {
        type: Number,
        default: 0,
      },
      totalClaimAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

eblPeriodSchema.index(
  { studentId: 1, hostelId: 1, fromMonth: 1, toMonth: 1 },
  { unique: true }
);
eblPeriodSchema.index({ hostelId: 1, status: 1 });
eblPeriodSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("EblPeriod", eblPeriodSchema);
