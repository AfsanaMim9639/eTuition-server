const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Create or get conversation
exports.createOrGetConversation = async (req, res) => {
  try {
    const { participantId, tuitionId, type = 'student-tutor' } = req.body;
    const userId = req.user.userId;

    // Validate participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId] },
      type,
      ...(tuitionId && { tuition: tuitionId })
    })
    .populate('participants', 'name email role profileImage')
    .populate('tuition', 'title');

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participants: [userId, participantId],
        type,
        ...(tuitionId && { tuition: tuitionId }),
        unreadCount: {
          [userId]: 0,
          [participantId]: 0
        }
      });

      // Populate after creation
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name email role profileImage')
        .populate('tuition', 'title');
    }

    res.status(200).json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
      error: error.message
    });
  }
};

// Get all conversations for logged-in user
exports.getMyConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId,
      status: 'active',
      archivedBy: { $ne: userId }
    })
    .populate('participants', 'name email role profileImage')
    .populate('tuition', 'title')
    .populate('lastMessage.sender', 'name')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

    // Add unread count for current user
    const conversationsWithUnread = conversations.map(conv => {
      const convObj = conv.toObject();
      convObj.myUnreadCount = conv.unreadCount.get(userId.toString()) || 0;
      return convObj;
    });

    res.status(200).json({
      success: true,
      count: conversationsWithUnread.length,
      data: conversationsWithUnread
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

// Get conversation by ID
exports.getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    })
    .populate('participants', 'name email role profileImage')
    .populate('tuition', 'title');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message
    });
  }
};

// Mark conversation as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Reset unread count for this user
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    // Mark all messages as read
    await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date()
          }
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as read',
      error: error.message
    });
  }
};

// Archive conversation
exports.archiveConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Add user to archivedBy array if not already there
    if (!conversation.archivedBy.includes(userId)) {
      conversation.archivedBy.push(userId);
      await conversation.save();
    }

    res.status(200).json({
      success: true,
      message: 'Conversation archived'
    });

  } catch (error) {
    console.error('Archive conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive conversation',
      error: error.message
    });
  }
};

// Delete conversation
exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Delete all messages in this conversation
    await Message.deleteMany({ conversation: id });
    
    // Delete the conversation
    await Conversation.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Conversation deleted'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
};