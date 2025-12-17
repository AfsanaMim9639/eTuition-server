// models/Application.js - UPDATED

const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  tuition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tuition',
    required: [true, 'Tuition reference is required']
  },
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor reference is required']
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student reference is required']
  },
  
  // ✅ NEW FIELDS - Form data
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  qualifications: {
    type: String,
    required: [true, 'Qualifications are required'],
    trim: true,
    minlength: [20, 'Qualifications must be at least 20 characters']
  },
  experience: {
    type: String,
    required: [true, 'Experience is required'],
    trim: true
  },
  expectedSalary: {
    type: Number,
    required: [true, 'Expected salary is required'],
    min: [0, 'Expected salary cannot be negative']
  },
  
  message: {
  type: String,
  trim: true,
  minlength: [50, 'Message must be at least 50 characters']
  // required নেই = optional
},
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  
  // Timestamps
  appliedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  
  // Rejection details
  rejectionReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// ✅ Index for better query performance
applicationSchema.index({ tuition: 1, tutor: 1 }, { unique: true }); // Prevent duplicate applications
applicationSchema.index({ status: 1, appliedAt: -1 });
applicationSchema.index({ tutor: 1, status: 1 });
applicationSchema.index({ student: 1, status: 1 });

// ✅ Update respondedAt when status changes
applicationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.respondedAt) {
    this.respondedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Application', applicationSchema);