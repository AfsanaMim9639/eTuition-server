const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Social login routes - support both /google and /social-login for compatibility
router.post('/google', authController.socialLogin); // ✅ Matches frontend
router.post('/social-login', authController.socialLogin); // ✅ Alternative path

// Protected routes
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/logout', verifyToken, authController.logout); // ✅ Added logout endpoint
router.put('/change-password', verifyToken, authController.changePassword); // ✅ Added password change

module.exports = router;