const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user.userId;

    // Validate conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied'
      });
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content,
      type: 'text'
    });

    // Populate sender info
    await message.populate('sender', 'name email role profileImage');

    // Update conversation's last message
    conversation.lastMessage = {
      content,
      sender: userId,
      timestamp: new Date(),
      read: false
    };

    // Increment unread count for other participants
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });

    await conversation.save();

    // Emit socket event (will be handled in socket handler)
    const io = req.app.get('io');
    if (io) {
      // Emit to all participants except sender
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId.toString()) {
          io.to(participantId.toString()).emit('new-message', {
            conversationId,
            message: message.toObject()
          });
        }
      });
    }

    res.status(201).json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied'
      });
    }

    // Get messages with pagination
    const messages = await Message.find({
      conversation: conversationId,
      deletedBy: { $ne: userId }
    })
    .populate('sender', 'name email role profileImage')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Get total count
    const total = await Message.countDocuments({
      conversation: conversationId,
      deletedBy: { $ne: userId }
    });

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can delete their message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Soft delete - add user to deletedBy array
    if (!message.deletedBy.includes(userId)) {
      message.deletedBy.push(userId);
      await message.save();
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(message.conversation.toString()).emit('message-deleted', {
        messageId: id,
        conversationId: message.conversation
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// Mark message as delivered
exports.markAsDelivered = async (req, res) => {
  try {
    const { id } = req.params;

    await Message.findByIdAndUpdate(id, {
      delivered: true
    });

    res.status(200).json({
      success: true,
      message: 'Message marked as delivered'
    });

  } catch (error) {
    console.error('Mark as delivered error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as delivered',
      error: error.message
    });
  }
};