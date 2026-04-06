const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: [true, 'Month is required (format: Mon-YYYY)'],
      match: [
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/,
        'Month must be in Mon-YYYY format',
      ],
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
    totalExpenses: {
      type: Number,
      required: [true, 'Total expenses is required'],
      min: [0, 'Total expenses cannot be negative'],
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
ledgerSchema.index({ month: 1, hostelId: 1, createdAt: -1 });

module.exports = mongoose.model('Ledger', ledgerSchema);
