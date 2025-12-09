const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tuition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tuition',
    required: [true, 'Tuition reference is required']
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student reference is required']
  },
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor reference is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  currency: {
    type: String,
    default: 'BDT'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'cash'],
    default: 'bkash'
  },
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true,
    trim: true
  },
  stripePaymentIntentId: {
    type: String
  },
  bkashPaymentId: {
    type: String
  },
  nagadPaymentRef: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  description: {
    type: String,
    trim: true
  },
  // Additional fields for Bangladesh payment systems
  senderNumber: {
    type: String // For bKash, Nagad, Rocket
  },
  receiverNumber: {
    type: String
  },
  platformFee: {
    type: Number,
    default: 0
  },
  tutorReceives: {
    type: Number // Amount after platform fee
  },
  refundAmount: {
    type: Number
  },
  refundReason: {
    type: String
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for better query performance
paymentSchema.index({ student: 1, status: 1, createdAt: -1 });
paymentSchema.index({ tutor: 1, status: 1, createdAt: -1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1, paymentDate: -1 });

// Calculate tutor receives amount before saving
paymentSchema.pre('save', function(next) {
  if (this.isModified('amount') && !this.tutorReceives) {
    // Platform takes 10% fee (adjust as needed)
    this.platformFee = this.amount * 0.10;
    this.tutorReceives = this.amount - this.platformFee;
  }
  
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Static method to generate unique transaction ID
paymentSchema.statics.generateTransactionId = function(method) {
  const prefix = method.toUpperCase().substring(0, 3);
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}${timestamp}${random}`;
};

module.exports = mongoose.model('Payment', paymentSchema);