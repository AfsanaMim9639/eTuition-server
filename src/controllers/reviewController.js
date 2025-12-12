const Review = require('../models/Review');
const User = require('../models/User');

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private (Student only)
const createReview = async (req, res) => {
  try {
    const { tutorId, rating, comment } = req.body;
    const studentId = req.user.userId;

    // Check if student is trying to review themselves
    if (tutorId === studentId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot review yourself'
      });
    }

    // Check if tutor exists and is actually a tutor
    const tutor = await User.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    if (tutor.role !== 'tutor') {
      return res.status(400).json({
        success: false,
        message: 'You can only review tutors'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ tutor: tutorId, student: studentId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this tutor'
      });
    }

    // Create review
    const review = await Review.create({
      tutor: tutorId,
      student: studentId,
      rating,
      comment
    });

    const populatedReview = await Review.findById(review._id)
      .populate('student', 'name profileImage')
      .populate('tutor', 'name');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Create review error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this tutor'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit review',
      error: error.message
    });
  }
};

// @desc    Get all reviews for a tutor
// @route   GET /api/reviews/tutor/:tutorId
// @access  Public
const getTutorReviews = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ tutor: tutorId })
      .populate('student', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments({ tutor: tutorId });

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReviews: total
      }
    });
  } catch (error) {
    console.error('Get tutor reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// @desc    Get student's all reviews
// @route   GET /api/reviews/my-reviews
// @access  Private (Student only)
const getMyReviews = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const reviews = await Review.find({ student: studentId })
      .populate('tutor', 'name profileImage subjects')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your reviews',
      error: error.message
    });
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private (Owner only)
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const studentId = req.user.userId;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check ownership
    if (review.student.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reviews'
      });
    }

    // Update review
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();

    const updatedReview = await Review.findById(review._id)
      .populate('student', 'name profileImage')
      .populate('tutor', 'name');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review',
      error: error.message
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Owner only)
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.userId;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check ownership
    if (review.student.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    // Store tutor ID before deletion for rating recalculation
    const tutorId = review.tutor;
    
    await review.deleteOne();
    
    // Recalculate rating manually after deletion
    await Review.calculateAverageRating(tutorId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
};

// @desc    Check if student can review tutor
// @route   GET /api/reviews/can-review/:tutorId
// @access  Private (Student only)
const canReviewTutor = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const studentId = req.user.userId;

    const existingReview = await Review.findOne({ tutor: tutorId, student: studentId });

    res.status(200).json({
      success: true,
      canReview: !existingReview,
      hasReviewed: !!existingReview,
      review: existingReview
    });
  } catch (error) {
    console.error('Can review tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check review status',
      error: error.message
    });
  }
};

module.exports = {
  createReview,
  getTutorReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  canReviewTutor
};