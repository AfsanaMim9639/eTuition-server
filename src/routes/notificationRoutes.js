const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware'); // ✅ Use your file name
const { isAuthenticated } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(verifyToken, isAuthenticated);

// ✅ IMPORTANT: Specific routes MUST come BEFORE generic routes
// Get unread count (MUST be before '/:id' routes)
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all as read (specific route)
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete all read notifications (specific route)
router.delete('/clear-read', notificationController.deleteAllRead);

// Get user's notifications (list)
router.get('/', notificationController.getMyNotifications);

// Create notification (for testing/admin)
router.post('/', notificationController.createNotification);

// ✅ Dynamic routes come LAST
// Mark single notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Delete single notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;