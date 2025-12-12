const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  type: {
    type: String,
    enum: [
      'application_received',    // Student receives tutor application
      'application_accepted',    // Tutor's application accepted
      'application_rejected',    // Tutor's application rejected
      'tuition_posted',         // New tuition posted (notify relevant tutors)
      'payment_received',       // Tutor receives payment
      'payment_made',           // Student made payment
      'review_received',        // Tutor receives review
      'message_received',       // New message
      'system_alert',           // System notifications
      'account_update'          // Account status changes
    ],
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  link: {
    type: String,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Related references (optional)
  relatedTuition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tuition'
  },
  relatedApplication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Metadata
  readAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

// Update readAt when isRead changes to true
notificationSchema.pre('save', function(next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Set default expiration (90 days from creation)
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    this.expiresAt = expiryDate;
  }
  next();
});

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static method to delete old notifications
notificationSchema.statics.deleteOldNotifications = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  return this.deleteMany({ createdAt: { $lt: cutoffDate } });
};

module.exports = mongoose.model('Notification', notificationSchema);