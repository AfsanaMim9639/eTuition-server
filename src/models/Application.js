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
  message: {
    type: String,
    required: [true, 'Application message is required'],
    trim: true,
    minlength: [20, 'Message must be at least 20 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  // Additional fields
  tutorExperience: {
    type: Number
  },
  proposedRate: {
    type: Number
  }
}, {
  timestamps: true
});

// Index for better query performance
applicationSchema.index({ tuition: 1, tutor: 1 }, { unique: true }); // Prevent duplicate applications
applicationSchema.index({ status: 1, appliedAt: -1 });
applicationSchema.index({ tutor: 1, status: 1 });
applicationSchema.index({ student: 1, status: 1 });

// Update respondedAt when status changes
applicationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.respondedAt) {
    this.respondedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Application', applicationSchema);