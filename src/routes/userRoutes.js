const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.get('/tutors', userController.getAllTutors);
router.get('/tutors/latest', userController.getLatestTutors);
router.get('/:userId', userController.getUserProfile);

// Protected routes
router.put('/profile', verifyToken, userController.updateUserProfile);

module.exports = router;