const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  createOrGetConversation,
  getMyConversations,
  getConversationById,
  markAsRead,
  archiveConversation,
  deleteConversation
} = require('../controllers/conversationController');

// All routes require authentication
router.use(verifyToken);

// Create or get conversation
router.post('/', createOrGetConversation);

// Get all my conversations
router.get('/my', getMyConversations);

// Get specific conversation
router.get('/:id', getConversationById);

// Mark conversation as read
router.patch('/:id/read', markAsRead);

// Archive conversation
router.patch('/:id/archive', archiveConversation);

// Delete conversation
router.delete('/:id', deleteConversation);

module.exports = router;