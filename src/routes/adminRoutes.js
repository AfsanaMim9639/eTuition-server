const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

// All routes require admin role
router.use(verifyToken, isAdmin);

// Dashboard
router.get('/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.delete('/users/:userId', adminController.deleteUser);

// Tuition management
router.get('/tuitions', adminController.getAllTuitionsAdmin);
router.patch('/tuitions/:tuitionId/status', adminController.updateTuitionStatus);

// Payment management (⭐ Added this)
router.get('/payments', adminController.getAllPayments);

module.exports = router;