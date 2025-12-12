const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor is required']
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    minlength: [10, 'Review must be at least 10 characters'],
    maxlength: [500, 'Review cannot exceed 500 characters']
  },
  helpful: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Prevent duplicate reviews - One student can review one tutor only once
reviewSchema.index({ tutor: 1, student: 1 }, { unique: true });

// Update tutor's rating when review is saved
reviewSchema.post('save', async function() {
  await this.constructor.calculateAverageRating(this.tutor);
});

// Update tutor's rating when review is deleted
reviewSchema.post('remove', async function() {
  await this.constructor.calculateAverageRating(this.tutor);
});

// Static method to calculate average rating
reviewSchema.statics.calculateAverageRating = async function(tutorId) {
  const stats = await this.aggregate([
    {
      $match: { tutor: tutorId }
    },
    {
      $group: {
        _id: '$tutor',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  const User = mongoose.model('User');
  
  if (stats.length > 0) {
    await User.findByIdAndUpdate(tutorId, {
      rating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: stats[0].totalReviews
    });
  } else {
    await User.findByIdAndUpdate(tutorId, {
      rating: 0,
      totalReviews: 0
    });
  }
};

module.exports = mongoose.model('Review', reviewSchema);