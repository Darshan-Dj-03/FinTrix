const mongoose = require("mongoose");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const eblReportSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    reportType: {
      type: String,
      enum: ["pre_receipt", "month_wise", "university_claim", "university_claim_month_wise"],
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
    status: {
      type: String,
      enum: ["draft", "submitted", "warden_approved"],
      default: "draft",
    },
    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
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
    totalDifference: {
      type: Number,
      default: 0,
    },
    totalUniversityClaim: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRemainingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    submittedAt: {
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
    wardenNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

eblReportSchema.index({ hostelId: 1, reportType: 1, fromMonth: 1, toMonth: 1 }, { unique: true });
eblReportSchema.index({ hostelId: 1, status: 1, reportType: 1 });

let legacyIndexCleanupPromise = null;

eblReportSchema.statics.ensureIndexesReady = async function ensureIndexesReady() {
  if (!legacyIndexCleanupPromise) {
    legacyIndexCleanupPromise = (async () => {
      const collection = this.collection;
      const indexes = await collection.indexes();
      const legacyIndexName = "hostelId_1_category_1_fromMonth_1_toMonth_1";

      if (indexes.some((index) => index.name === legacyIndexName)) {
        await collection.dropIndex(legacyIndexName);
      }

      await this.syncIndexes();
    })().catch((error) => {
      legacyIndexCleanupPromise = null;
      throw error;
    });
  }

  return legacyIndexCleanupPromise;
};

module.exports = mongoose.model("EblCategoryReport", eblReportSchema);
