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
router.get('/users/:userId', adminController.getUserById); // ⭐ ADD THIS
router.patch('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.patch('/users/:userId/info', adminController.updateUserInfo); // ⭐ ADD THIS
router.delete('/users/:userId', adminController.deleteUser);

// Tuition management
router.get('/tuitions', adminController.getAllTuitionsAdmin);
router.get('/tuitions/:tuitionId', adminController.getTuitionById);  // ⭐ NEW
router.patch('/tuitions/:tuitionId/status', adminController.updateTuitionStatus);
router.patch('/tuitions/:tuitionId/approve', adminController.approveTuition);  // ⭐ NEW
router.patch('/tuitions/:tuitionId/reject', adminController.rejectTuition);  // ⭐ NEW

// Payment management
router.get('/payments', adminController.getAllPayments);

module.exports = router;