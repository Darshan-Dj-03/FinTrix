const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Charge title is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
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
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'addedBy is required'],
    },
  },
  { timestamps: true }
);

// Query + duplicate prevention indexes
chargeSchema.index({ hostelId: 1, month: 1 });
chargeSchema.index({ hostelId: 1, month: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('Charge', chargeSchema);
