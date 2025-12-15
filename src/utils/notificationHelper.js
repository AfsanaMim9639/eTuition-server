// utils/notificationHelper.js
const Notification = require('../models/Notification');

/**
 * Create notification helper
 * @param {Object} data - Notification data
 */
const createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    console.log('✅ Notification created:', notification.type);
    return notification;
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    throw error;
  }
};

/**
 * Send notification when new message is received
 */
const notifyNewMessage = async (message, recipientId, senderId, conversationId) => {
  try {
    await createNotification({
      user: recipientId,
      type: 'message_received',
      title: 'New Message',
      message: `You received a new message from ${message.sender?.name || 'someone'}`,
      link: `/messages?conversation=${conversationId}`,
      priority: 'high',
      relatedUser: senderId
    });
  } catch (error) {
    console.error('Failed to notify new message:', error);
  }
};

/**
 * Send notification when tuition is posted
 */
const notifyTuitionPosted = async (tuition, tutorIds) => {
  try {
    // Notify all matching tutors
    const notifications = tutorIds.map(tutorId => ({
      user: tutorId,
      type: 'tuition_posted',
      title: 'New Tuition Posted',
      message: `A new tuition for ${tuition.subject} has been posted`,
      link: `/tuitions/${tuition._id}`,
      priority: 'medium',
      relatedTuition: tuition._id
    }));

    await Notification.insertMany(notifications);
    console.log(`✅ Notified ${tutorIds.length} tutors about new tuition`);
  } catch (error) {
    console.error('Failed to notify tuition posted:', error);
  }
};

/**
 * Send notification when tutor post is created
 */
const notifyTutorPost = async (post, studentIds) => {
  try {
    const notifications = studentIds.map(studentId => ({
      user: studentId,
      type: 'tutor_post_created',
      title: 'New Tutor Available',
      message: `A new tutor for ${post.subjects?.join(', ')} is available`,
      link: `/tutors/${post.tutor}`,
      priority: 'medium',
      relatedUser: post.tutor
    }));

    await Notification.insertMany(notifications);
    console.log(`✅ Notified ${studentIds.length} students about new tutor`);
  } catch (error) {
    console.error('Failed to notify tutor post:', error);
  }
};

/**
 * Send notification for application received
 */
const notifyApplicationReceived = async (application, studentId, tutorName) => {
  try {
    await createNotification({
      user: studentId,
      type: 'application_received',
      title: 'New Application',
      message: `${tutorName} has applied for your tuition`,
      link: `/my-tuitions/${application.tuition}?tab=applications`,
      priority: 'high',
      relatedApplication: application._id,
      relatedUser: application.tutor
    });
  } catch (error) {
    console.error('Failed to notify application received:', error);
  }
};

/**
 * Send notification for application accepted
 */
const notifyApplicationAccepted = async (application, tutorId, tuitionTitle) => {
  try {
    await createNotification({
      user: tutorId,
      type: 'application_accepted',
      title: 'Application Accepted! 🎉',
      message: `Your application for "${tuitionTitle}" has been accepted`,
      link: `/my-applications`,
      priority: 'urgent',
      relatedApplication: application._id,
      relatedTuition: application.tuition
    });
  } catch (error) {
    console.error('Failed to notify application accepted:', error);
  }
};

/**
 * Send notification for application rejected
 */
const notifyApplicationRejected = async (application, tutorId, tuitionTitle) => {
  try {
    await createNotification({
      user: tutorId,
      type: 'application_rejected',
      title: 'Application Update',
      message: `Your application for "${tuitionTitle}" was not selected`,
      link: `/my-applications`,
      priority: 'medium',
      relatedApplication: application._id
    });
  } catch (error) {
    console.error('Failed to notify application rejected:', error);
  }
};

/**
 * Send notification for new review
 */
const notifyNewReview = async (review, tutorId, studentName, rating) => {
  try {
    await createNotification({
      user: tutorId,
      type: 'review_received',
      title: 'New Review',
      message: `${studentName} left you a ${rating}-star review`,
      link: `/profile/tutor`,
      priority: 'medium',
      relatedUser: review.student
    });
  } catch (error) {
    console.error('Failed to notify new review:', error);
  }
};

/**
 * Send notification for class schedule
 */
const notifyClassSchedule = async (schedule, recipientId, type) => {
  try {
    const titles = {
      created: 'New Class Scheduled',
      updated: 'Class Schedule Updated',
      cancelled: 'Class Cancelled'
    };

    await createNotification({
      user: recipientId,
      type: 'class_schedule',
      title: titles[type] || 'Class Update',
      message: `Class on ${new Date(schedule.date).toLocaleDateString()} at ${schedule.time}`,
      link: `/classes`,
      priority: type === 'cancelled' ? 'urgent' : 'high'
    });
  } catch (error) {
    console.error('Failed to notify class schedule:', error);
  }
};

/**
 * Send notification for payment
 */
const notifyPayment = async (payment, recipientId, type, amount) => {
  try {
    const messages = {
      received: `You received a payment of ৳${amount}`,
      made: `Your payment of ৳${amount} was successful`
    };

    await createNotification({
      user: recipientId,
      type: type === 'received' ? 'payment_received' : 'payment_made',
      title: type === 'received' ? 'Payment Received' : 'Payment Made',
      message: messages[type],
      link: `/payments`,
      priority: 'high'
    });
  } catch (error) {
    console.error('Failed to notify payment:', error);
  }
};

module.exports = {
  createNotification,
  notifyNewMessage,
  notifyTuitionPosted,
  notifyTutorPost,
  notifyApplicationReceived,
  notifyApplicationAccepted,
  notifyApplicationRejected,
  notifyNewReview,
  notifyClassSchedule,
  notifyPayment
};