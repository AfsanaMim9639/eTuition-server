const mongoose = require('mongoose');

const tuitionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required']
  },
  grade: {  // Changed back to 'grade' to match your routes
    type: String,
    required: [true, 'Grade is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required']
  },
  salary: {
    type: Number,
    required: [true, 'Salary is required'],
    min: 0
  },
  schedule: {  // Added schedule field
    type: String,
    required: [true, 'Schedule is required']
  },
  requirements: {
    type: String,
    required: [true, 'Requirements are required']
  },
  
  // Reference fields
  studentId: {  // Changed from postedBy to studentId to match your backend logic
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  approvedTutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Additional fields from your MongoDB
  days_per_week: {
    type: Number,
    min: 1,
    max: 7
  },
  class_duration: {
    type: String
  },
  student_gender: {
    type: String,
    enum: ['Male', 'Female', 'Any'],
    default: 'Any'
  },
  tutor_gender_preference: {
    type: String,
    enum: ['Male', 'Female', 'Any'],
    default: 'Any'
  },
  preferred_medium: {
    type: String,
    enum: ['Bangla Medium', 'English Medium', 'English Version', 'Both'],
    default: 'Both'
  },
  tutoring_type: {
    type: String,
    enum: ['Home Tutoring', 'Online Tutoring', 'Both'],
    required: [true, 'Tutoring type is required']
  },
  student_details: {
    type: mongoose.Schema.Types.Mixed
  },
  contact: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Status and tracking
  status: {
    type: String,
    enum: ['open', 'closed', 'ongoing', 'completed'],
    default: 'open'
  },
  views: {
    type: Number,
    default: 0
  },
  postedAt: {  // Added postedAt to match your backend usage
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  },
  
  // Additional fields
  description: {
    type: String
  }
}, {
  timestamps: true  // This will add createdAt and updatedAt
});

// Virtual fields for compatibility
tuitionSchema.virtual('daysPerWeek').get(function() {
  return this.days_per_week;
});

tuitionSchema.virtual('category').get(function() {
  if (this.tutoring_type === 'Home Tutoring') return 'Offline';
  if (this.tutoring_type === 'Online Tutoring') return 'Online';
  return 'Both';
});

tuitionSchema.virtual('medium').get(function() {
  return this.preferred_medium;
});

// Ensure virtual fields are included in JSON
tuitionSchema.set('toJSON', { virtuals: true });
tuitionSchema.set('toObject', { virtuals: true });

// Index for better query performance
tuitionSchema.index({ status: 1, postedAt: -1 });
tuitionSchema.index({ studentId: 1, status: 1 });
tuitionSchema.index({ subject: 1, tutoring_type: 1 });
tuitionSchema.index({ grade: 1, location: 1 });

module.exports = mongoose.model('Tuition', tuitionSchema);