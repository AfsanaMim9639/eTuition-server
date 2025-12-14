const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  itemType: {
    type: String,
    enum: ['tutor', 'tuition'],
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'itemModel'
  },
  itemModel: {
    type: String,
    required: true,
    enum: ['User', 'Tuition']
  },
  note: {
    type: String,
    maxlength: 200,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate bookmarks
bookmarkSchema.index({ user: 1, itemId: 1 }, { unique: true });

// Index for faster queries
bookmarkSchema.index({ user: 1, itemType: 1 });
bookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);