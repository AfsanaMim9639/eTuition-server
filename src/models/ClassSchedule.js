const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({
  // Core Information
  title: {
    type: String,
    required: [true, 'Class title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Participants
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor is required'],
    index: true
  },
  
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required'],
    index: true
  },
  
  // Scheduling
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    index: true
  },
  
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  
  // Duration in minutes
  duration: {
    type: Number,
    required: true
  },
  
  // Recurrence
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'none'],
      default: 'none'
    },
    daysOfWeek: [{
      type: Number, // 0 = Sunday, 1 = Monday, etc.
      min: 0,
      max: 6
    }],
    endDate: {
      type: Date
    },
    occurrences: {
      type: Number,
      min: 1
    }
  },
  
  // Class Details
  classType: {
    type: String,
    enum: ['online', 'in-person', 'hybrid'],
    default: 'online'
  },
  
  meetingLink: {
    type: String,
    trim: true
  },
  
  location: {
    type: String,
    trim: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled',
    index: true
  },
  
  // Cancellation/Rescheduling
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  cancellationReason: {
    type: String,
    trim: true
  },
  
  cancelledAt: {
    type: Date
  },
  
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSchedule'
  },
  
  // Attendance
  attendance: {
    studentPresent: {
      type: Boolean,
      default: null
    },
    tutorPresent: {
      type: Boolean,
      default: null
    },
    markedAt: {
      type: Date
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Reminders
  remindersSent: {
    student: {
      type: Boolean,
      default: false
    },
    tutor: {
      type: Boolean,
      default: false
    }
  },
  
  // Notes
  tutorNotes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  
  studentNotes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  
  // Related References
  relatedTuition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tuition'
  },
  
  relatedApplication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
  
}, {
  timestamps: true
});

// ================== INDEXES ==================
classScheduleSchema.index({ tutor: 1, startTime: 1 });
classScheduleSchema.index({ student: 1, startTime: 1 });
classScheduleSchema.index({ status: 1, startTime: 1 });
classScheduleSchema.index({ startTime: 1, endTime: 1 });

// ================== VIRTUAL FIELDS ==================
// Check if class is upcoming
classScheduleSchema.virtual('isUpcoming').get(function() {
  return this.status === 'scheduled' && new Date(this.startTime) > new Date();
});

// Check if class is today
classScheduleSchema.virtual('isToday').get(function() {
  const today = new Date();
  const classDate = new Date(this.startTime);
  return classDate.toDateString() === today.toDateString();
});

// ================== PRE-SAVE HOOKS ==================
// Calculate duration automatically
classScheduleSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  next();
});

// Validate end time is after start time
classScheduleSchema.pre('save', function(next) {
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
  }
  next();
});

// Validate meeting link for online classes
classScheduleSchema.pre('save', function(next) {
  if (this.classType === 'online' && !this.meetingLink && this.status === 'scheduled') {
    next(new Error('Meeting link is required for online classes'));
  }
  next();
});

// Validate location for in-person classes
classScheduleSchema.pre('save', function(next) {
  if (this.classType === 'in-person' && !this.location && this.status === 'scheduled') {
    next(new Error('Location is required for in-person classes'));
  }
  next();
});

// ================== STATIC METHODS ==================

// Get upcoming classes for a user
classScheduleSchema.statics.getUpcomingClasses = async function(userId, limit = 10) {
  const now = new Date();
  return this.find({
    $or: [{ tutor: userId }, { student: userId }],
    status: 'scheduled',
    startTime: { $gte: now }
  })
  .sort({ startTime: 1 })
  .limit(limit)
  .populate('tutor student', 'name email profileImage')
  .exec();
};

// Get today's classes for a user
classScheduleSchema.statics.getTodayClasses = async function(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    $or: [{ tutor: userId }, { student: userId }],
    status: { $in: ['scheduled', 'in-progress'] },
    startTime: { $gte: startOfDay, $lte: endOfDay }
  })
  .sort({ startTime: 1 })
  .populate('tutor student', 'name email profileImage')
  .exec();
};

// Get classes for a date range
classScheduleSchema.statics.getClassesByDateRange = async function(userId, startDate, endDate) {
  return this.find({
    $or: [{ tutor: userId }, { student: userId }],
    startTime: { $gte: startDate, $lte: endDate }
  })
  .sort({ startTime: 1 })
  .populate('tutor student', 'name email profileImage')
  .exec();
};

// Check for scheduling conflicts
classScheduleSchema.statics.checkConflict = async function(userId, startTime, endTime, excludeId = null) {
  const query = {
    $or: [{ tutor: userId }, { student: userId }],
    status: { $in: ['scheduled', 'in-progress'] },
    $or: [
      // New class starts during existing class
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      // New class ends during existing class
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      // New class completely overlaps existing class
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflicts = await this.find(query)
    .populate('tutor student', 'name email')
    .exec();
  
  return conflicts;
};

// Get class statistics for a user
classScheduleSchema.statics.getClassStats = async function(userId, role) {
  const filter = role === 'tutor' ? { tutor: userId } : { student: userId };
  
  const stats = await this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' }
      }
    }
  ]);
  
  return stats;
};

// ================== INSTANCE METHODS ==================

// Cancel class
classScheduleSchema.methods.cancelClass = async function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return this.save();
};

// Mark attendance
classScheduleSchema.methods.markAttendance = async function(role, isPresent, markedBy) {
  if (role === 'student') {
    this.attendance.studentPresent = isPresent;
  } else if (role === 'tutor') {
    this.attendance.tutorPresent = isPresent;
  }
  
  this.attendance.markedAt = new Date();
  this.attendance.markedBy = markedBy;
  
  return this.save();
};

// Complete class
classScheduleSchema.methods.completeClass = async function() {
  if (this.status !== 'in-progress' && this.status !== 'scheduled') {
    throw new Error('Only scheduled or in-progress classes can be completed');
  }
  
  this.status = 'completed';
  return this.save();
};

// Start class
classScheduleSchema.methods.startClass = async function() {
  if (this.status !== 'scheduled') {
    throw new Error('Only scheduled classes can be started');
  }
  
  this.status = 'in-progress';
  return this.save();
};

module.exports = mongoose.model('ClassSchedule', classScheduleSchema);