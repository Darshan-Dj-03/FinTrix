const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    month: {
      type: String,
      required: [true, 'Month is required (format: Mon-YYYY)'],
      match: [
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/,
        'Month must be in Mon-YYYY format',
      ],
    },
    billAmount: {
      type: Number,
      required: [true, 'Bill amount is required'],
      min: [0, 'Bill amount cannot be negative'],
    },
    fine: {
      type: Number,
      default: 0,
      min: [0, 'Fine cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Amount paid cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'partial', 'paid'],
        message: 'Invalid payment status',
      },
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['cash', 'bank_transfer', 'cheque', 'online'],
        message: 'Invalid payment method',
      },
      default: 'cash',
    },
    referenceNumber: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Unique index on student + month
paymentSchema.index({ studentId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
