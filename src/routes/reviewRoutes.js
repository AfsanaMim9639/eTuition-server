const express = require('express');
const router = express.Router();
const {
  createReview,
  getTutorReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  canReviewTutor
} = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.get('/tutor/:tutorId', getTutorReviews);

// Protected routes (Student only)
router.use(verifyToken); // All routes below need authentication

router.post('/', createReview);
router.get('/my-reviews', getMyReviews);
router.get('/can-review/:tutorId', canReviewTutor);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

module.exports = router;