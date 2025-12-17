const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isStudent, isTutor, isStudentOrAdmin } = require('../middleware/roleMiddleware');

// Student routes - Payment creation
// POST /api/payments - Create payment (matches frontend)
router.post('/', verifyToken, isStudent, paymentController.createPaymentIntent);

// POST /api/payments/create-intent - Alternative path (backward compatibility)
router.post('/create-intent', verifyToken, isStudent, paymentController.createPaymentIntent);

// POST /api/payments/confirm - Confirm payment after Stripe success
router.post('/confirm', verifyToken, isStudent, paymentController.confirmPayment);

// ✅ FIXED: Added both paths for compatibility
// GET /api/payments/my-payments - Frontend expects this path
router.get('/my-payments', verifyToken, isStudent, paymentController.getMyPayments);

// GET /api/payments/my/payments - Legacy path (keeping for backward compatibility)
router.get('/my/payments', verifyToken, isStudent, paymentController.getMyPayments);

// Tutor routes - Revenue tracking
// GET /api/payments/my-revenue - Get tutor's revenue history
router.get('/my-revenue', verifyToken, isTutor, paymentController.getMyRevenue);

// Admin routes - Payment status management
// PUT /api/payments/:id/status - Update payment status (for refunds, disputes, etc.)
router.put('/:id/status', verifyToken, isStudentOrAdmin, paymentController.updatePaymentStatus);

// Common routes - Payment details
// GET /api/payments/:id - Get specific payment details
router.get('/:id', verifyToken, paymentController.getPaymentById);

module.exports = router;