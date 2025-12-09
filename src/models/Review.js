const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor reference is required']
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student reference is required']
  },
  tuition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tuition',
    required: [true, 'Tuition reference is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    required: [true, 'Comment is required'],
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  helpful: {
    type: Number,
    default: 0
  },
  reported: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
reviewSchema.index({ tutor: 1, createdAt: -1 });
reviewSchema.index({ student: 1, tuition: 1 }, { unique: true }); // One review per student per tuition
reviewSchema.index({ rating: -1 });

// Update tutor's average rating after review is saved
reviewSchema.post('save', async function() {
  const Review = this.constructor;
  const User = mongoose.model('User');
  
  const stats = await Review.aggregate([
    { $match: { tutor: this.tutor } },
    {
      $group: {
        _id: '$tutor',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  
  if (stats.length > 0) {
    await User.findByIdAndUpdate(this.tutor, {
      rating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal
      totalReviews: stats[0].totalReviews
    });
  }
});

// Update tutor's rating when review is deleted
reviewSchema.post('remove', async function() {
  const Review = this.constructor;
  const User = mongoose.model('User');
  
  const stats = await Review.aggregate([
    { $match: { tutor: this.tutor } },
    {
      $group: {
        _id: '$tutor',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  
  if (stats.length > 0) {
    await User.findByIdAndUpdate(this.tutor, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].totalReviews
    });
  } else {
    await User.findByIdAndUpdate(this.tutor, {
      rating: 0,
      totalReviews: 0
    });
  }
});

module.exports = mongoose.model('Review', reviewSchema);