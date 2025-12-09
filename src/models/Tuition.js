const mongoose = require('mongoose');

const tuitionSchema = new mongoose.Schema({
  // Original MongoDB fields
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required']
  },
  level: {  // Changed from 'class' to 'level'
    type: String,
    required: [true, 'Level is required']
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
  days_per_week: {  // Changed from 'daysPerWeek' to 'days_per_week'
    type: Number,
    required: [true, 'Days per week is required'],
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
  requirements: {
    type: String,
    required: [true, 'Requirements are required']
  },
  posted_by: {
    type: String,
    required: true
  },
  contact: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'ongoing', 'completed'],
    default: 'open'
  },
  posted_date: {
    type: String
  },
  views: {
    type: Number,
    default: 0
  },
  
  // Additional fields for compatibility
  description: {
    type: String
  },
  postedBy: {  // For User reference if needed
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedTutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual field to map 'level' to 'class' for frontend compatibility
tuitionSchema.virtual('class').get(function() {
  return this.level;
});

// Virtual field to map 'days_per_week' to 'daysPerWeek'
tuitionSchema.virtual('daysPerWeek').get(function() {
  return this.days_per_week;
});

// Virtual field to map 'tutoring_type' to 'category'
tuitionSchema.virtual('category').get(function() {
  if (this.tutoring_type === 'Home Tutoring') return 'Offline';
  if (this.tutoring_type === 'Online Tutoring') return 'Online';
  return 'Both';
});

// Virtual field to map 'preferred_medium' to 'medium'
tuitionSchema.virtual('medium').get(function() {
  return this.preferred_medium;
});

// Ensure virtual fields are included in JSON
tuitionSchema.set('toJSON', { virtuals: true });
tuitionSchema.set('toObject', { virtuals: true });

// Index for better query performance
tuitionSchema.index({ status: 1, createdAt: -1 });
tuitionSchema.index({ subject: 1, tutoring_type: 1 });
tuitionSchema.index({ posted_date: -1 });

module.exports = mongoose.model('Tuition', tuitionSchema);