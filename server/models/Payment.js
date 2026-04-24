const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MessBill',
      required: [true, 'Bill is required'],
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel is required'],
    },
    month: {
      type: String,
      required: [true, 'Month is required (format: Mon-YYYY)'],
      match: [
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/,
        'Month must be in Mon-YYYY format',
      ],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid'],
        message: 'Invalid payment status',
      },
      default: 'paid',
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['cash', 'upi'],
        message: 'Invalid payment method',
      },
      default: 'upi',
    },
    utrNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'UTR number cannot exceed 100 characters'],
      default: '',
    },
    paymentMadeDate: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'verifiedBy is required'],
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    idempotencyKey: {
      type: String,
      default: undefined,
      trim: true,
    },
    billPaymentKey: {
      type: String,
      default: '',
      trim: true,
    }
  },
  { timestamps: true }
);

paymentSchema.index({ billId: 1, createdAt: -1 });
paymentSchema.index({ hostelId: 1, month: 1, createdAt: -1 });
paymentSchema.index({ studentId: 1, month: 1, createdAt: -1 });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
paymentSchema.index({ billPaymentKey: 1 }, { unique: true, sparse: true });
paymentSchema.index({ utrNumber: 1, month: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
