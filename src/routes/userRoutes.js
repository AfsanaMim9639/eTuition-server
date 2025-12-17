const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// ⭐ IMPORTANT: Specific routes MUST come BEFORE dynamic routes
// Otherwise /:userId will catch /tutors and /tutors/latest

// Public routes - Specific paths first
router.get('/tutors/latest', userController.getLatestTutors);
router.get('/tutors', userController.getAllTutors);

// Protected routes
router.get('/students', verifyToken, userController.getAllStudents);
router.put('/profile', verifyToken, userController.updateUserProfile);

// Dynamic route MUST be last
router.get('/:userId', userController.getUserProfile);

module.exports = router;