const Notification = require('../models/Notification');

/**
 * Create a notification
 * @param {String} userId - User ID to send notification to
 * @param {Object} data - Notification data
 */
const createNotification = async (userId, data) => {
  try {
    await Notification.create({
      user: userId,
      ...data
    });
    console.log(`📬 Notification sent to user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
};

/**
 * Create notifications for multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} data - Notification data
 */
const createBulkNotifications = async (userIds, data) => {
  try {
    const notifications = userIds.map(userId => ({
      user: userId,
      ...data
    }));
    
    await Notification.insertMany(notifications);
    console.log(`📬 Bulk notifications sent to ${userIds.length} users`);
  } catch (error) {
    console.error('❌ Error creating bulk notifications:', error);
  }
};

/**
 * Notification templates for different events
 */
const NotificationTemplates = {
  // Student receives tutor application
  applicationReceived: (tutorName, tuitionTitle, tuitionId, applicationId, tutorId) => ({
    type: 'application_received',
    title: 'New Tutor Application',
    message: `${tutorName} has applied for your tuition: ${tuitionTitle}`,
    link: `/dashboard/student/tuition/${tuitionId}/applications`,
    relatedTuition: tuitionId,
    relatedApplication: applicationId,
    relatedUser: tutorId,
    priority: 'high'
  }),

  // Tutor's application accepted
  applicationAccepted: (tuitionTitle, tuitionId, studentId) => ({
    type: 'application_accepted',
    title: 'Application Accepted! 🎉',
    message: `Congratulations! Your application for "${tuitionTitle}" has been accepted`,
    link: `/dashboard/tutor/ongoing`,
    relatedTuition: tuitionId,
    relatedUser: studentId,
    priority: 'high'
  }),

  // Tutor's application rejected
  applicationRejected: (tuitionTitle, tuitionId) => ({
    type: 'application_rejected',
    title: 'Application Status Update',
    message: `Your application for "${tuitionTitle}" was not selected`,
    link: `/dashboard/tutor/applications`,
    relatedTuition: tuitionId,
    priority: 'medium'
  }),

  // Application withdrawn
  applicationWithdrawn: (tutorName, tuitionTitle, tuitionId, applicationId) => ({
    type: 'system_alert',
    title: 'Application Withdrawn',
    message: `${tutorName} has withdrawn their application for "${tuitionTitle}"`,
    link: `/dashboard/student/tuition/${tuitionId}/applications`,
    relatedTuition: tuitionId,
    relatedApplication: applicationId,
    priority: 'low'
  }),

  // New tuition posted (for matching tutors)
  newTuitionPosted: (subject, grade, location, tuitionId) => ({
    type: 'tuition_posted',
    title: 'New Tuition Match',
    message: `New ${subject} tuition for ${grade} in ${location}`,
    link: `/tuitions/${tuitionId}`,
    relatedTuition: tuitionId,
    priority: 'medium'
  }),

  // Payment received (for tutor)
  paymentReceived: (amount, studentName, tuitionTitle) => ({
    type: 'payment_received',
    title: 'Payment Received',
    message: `You received ৳${amount} from ${studentName} for "${tuitionTitle}"`,
    link: `/dashboard/tutor/revenue`,
    priority: 'high'
  }),

  // Payment made (for student)
  paymentMade: (amount, tutorName, tuitionTitle) => ({
    type: 'payment_made',
    title: 'Payment Successful',
    message: `Payment of ৳${amount} sent to ${tutorName} for "${tuitionTitle}"`,
    link: `/dashboard/student/payments`,
    priority: 'medium'
  }),

  // Review received (for tutor)
  reviewReceived: (studentName, rating, tutorId) => ({
    type: 'review_received',
    title: 'New Review',
    message: `${studentName} left you a ${rating}⭐ review`,
    link: `/tutors/${tutorId}`,
    priority: 'medium'
  }),

  // Message received
  messageReceived: (senderName, preview, conversationId) => ({
    type: 'message_received',
    title: 'New Message',
    message: `${senderName}: ${preview}`,
    link: `/dashboard/messages/${conversationId}`,
    priority: 'medium'
  }),

  // Account status change
  accountStatusChanged: (status) => ({
    type: 'account_update',
    title: 'Account Status Update',
    message: `Your account status has been changed to: ${status}`,
    link: `/dashboard/profile`,
    priority: 'urgent'
  }),

  // System alert
  systemAlert: (title, message, link) => ({
    type: 'system_alert',
    title,
    message,
    link,
    priority: 'medium'
  })
};

/**
 * Send notification using template
 * @param {String} userId - User ID
 * @param {String} templateName - Template name from NotificationTemplates
 * @param  {...any} args - Template arguments
 */
const sendNotification = async (userId, templateName, ...args) => {
  try {
    const template = NotificationTemplates[templateName];
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }
    
    const notificationData = template(...args);
    await createNotification(userId, notificationData);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  NotificationTemplates,
  sendNotification
};