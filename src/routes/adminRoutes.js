const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

// All routes require admin role
router.use(verifyToken, isAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get('/stats', adminController.getDashboardStats);

// ============================================
// USER MANAGEMENT
// ============================================
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserById);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.patch('/users/:userId/info', adminController.updateUserInfo);
router.delete('/users/:userId', adminController.deleteUser);

// ============================================
// TUITION MANAGEMENT
// ============================================
router.get('/tuitions', adminController.getAllTuitionsAdmin);
router.get('/tuitions/:tuitionId', adminController.getTuitionById);
router.patch('/tuitions/:tuitionId/status', adminController.updateTuitionStatus);
router.patch('/tuitions/:tuitionId/approve', adminController.approveTuition);
router.patch('/tuitions/:tuitionId/reject', adminController.rejectTuition);

// ============================================
// FINANCIAL REPORTS - ⭐ NEW
// ============================================
router.get('/reports/financial', adminController.getFinancialReports);

// ============================================
// PAYMENT MANAGEMENT
// ============================================
router.get('/payments', adminController.getAllPayments);

module.exports = router;