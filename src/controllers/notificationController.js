const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// Get all notifications for current user
exports.getMyNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    console.log('📬 Fetching notifications for user:', req.user.userId);

    const query = { user: req.user.userId };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .populate('relatedUser', 'name profileImage')
      .populate('relatedTuition', 'title subject')
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(req.user.userId);

    console.log(`✅ Found ${notifications.length} notifications`);

    res.json({
      status: 'success',
      count: notifications.length,
      total,
      unreadCount,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: notifications
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications'
    });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.userId);
    
    res.json({
      status: 'success',
      count
    });
  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch unread count'
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('✅ Marking notification as read:', id);

    const notification = await Notification.findOne({
      _id: id,
      user: req.user.userId
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      status: 'success',
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('❌ Mark as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    console.log('✅ Marking all notifications as read for:', req.user.userId);

    const result = await Notification.markAllAsRead(req.user.userId);

    res.json({
      status: 'success',
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all as read'
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting notification:', id);

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user.userId
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification'
    });
  }
};

// Delete all read notifications
exports.deleteAllRead = async (req, res) => {
  try {
    console.log('🗑️ Deleting all read notifications for:', req.user.userId);

    const result = await Notification.deleteMany({
      user: req.user.userId,
      isRead: true
    });

    res.json({
      status: 'success',
      message: 'All read notifications deleted',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Delete all read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notifications'
    });
  }
};

// Create notification (for testing or admin use)
exports.createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, link, priority, relatedTuition, relatedApplication } = req.body;

    const notification = await Notification.create({
      user: userId || req.user.userId,
      type,
      title,
      message,
      link,
      priority,
      relatedTuition,
      relatedApplication
    });

    res.status(201).json({
      status: 'success',
      message: 'Notification created',
      data: notification
    });
  } catch (error) {
    console.error('❌ Create notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create notification'
    });
  }
};