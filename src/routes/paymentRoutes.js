const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isStudent, isTutor } = require('../middleware/roleMiddleware');

// Student routes
router.post('/create-intent', verifyToken, isStudent, paymentController.createPaymentIntent);
router.post('/confirm', verifyToken, isStudent, paymentController.confirmPayment);
router.get('/my-payments', verifyToken, isStudent, paymentController.getMyPayments);

// Tutor routes
router.get('/my-revenue', verifyToken, isTutor, paymentController.getMyRevenue);

// Common routes
router.get('/:id', verifyToken, paymentController.getPaymentById);

module.exports = router;