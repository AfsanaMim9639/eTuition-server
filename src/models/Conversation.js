const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  
  // Type of conversation
  type: {
    type: String,
    enum: ['student-tutor', 'admin-support'],
    required: true
  },
  
  // Related tuition (if applicable)
  tuition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tuition'
  },
  
  // Last message for preview
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date,
    read: {
      type: Boolean,
      default: false
    }
  },
  
  // Unread count for each participant
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Conversation status
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active'
  },
  
  // Archive status for each participant
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
  
}, {
  timestamps: true
});

// Indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });
conversationSchema.index({ status: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);