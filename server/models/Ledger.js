const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: [true, 'Month is required (format: YYYY-MM)'],
      match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'],
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel is required'],
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    totalExpense: {
      type: Number,
      required: [true, 'Total expense is required'],
      min: [0, 'Total expense cannot be negative'],
    },
    totalBilled: {
      type: Number,
      required: [true, 'Total billed is required'],
      min: [0, 'Total billed cannot be negative'],
    },
    totalCollected: {
      type: Number,
      default: 0,
      min: [0, 'Total collected cannot be negative'],
    },
    totalFines: {
      type: Number,
      default: 0,
      min: [0, 'Total fines cannot be negative'],
    },
    closingBalance: {
      type: Number,
      default: 0,
    },
    outstanding: {
      type: Number,
      default: 0,
    },
    remarks: {
      type: String,
      default: '',
    },
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Prepared by is required'],
    },
  },
  { timestamps: true }
);

// Unique index on hostel + month
ledgerSchema.index({ hostelId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Ledger', ledgerSchema);
