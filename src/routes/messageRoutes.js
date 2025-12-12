const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  sendMessage,
  getMessages,
  deleteMessage,
  markAsDelivered
} = require('../controllers/messageController');

// All routes require authentication
router.use(verifyToken);

// Send message
router.post('/', sendMessage);

// Get messages for a conversation
router.get('/conversation/:conversationId', getMessages);

// Delete message
router.delete('/:id', deleteMessage);

// Mark as delivered
router.patch('/:id/delivered', markAsDelivered);

module.exports = router;