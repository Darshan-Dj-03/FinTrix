const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Charge name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
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
    chargeType: {
      type: String,
      enum: {
        values: ['regular', 'special', 'penalty'],
        message: 'Invalid charge type',
      },
      default: 'regular',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
  },
  { timestamps: true }
);

// Index for querying charges by hostel and month
chargeSchema.index({ hostelId: 1, month: 1 });

module.exports = mongoose.model('Charge', chargeSchema);
