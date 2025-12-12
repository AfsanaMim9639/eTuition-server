const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isAuthenticated } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(verifyToken, isAuthenticated);

// Get user's notifications
router.get('/', notificationController.getMyNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete single notification
router.delete('/:id', notificationController.deleteNotification);

// Delete all read notifications
router.delete('/clear-read', notificationController.deleteAllRead);

// Create notification (for testing/admin)
router.post('/', notificationController.createNotification);

module.exports = router;