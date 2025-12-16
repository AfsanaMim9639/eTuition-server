// routes/applicationRoutes.js

const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { verifyToken } = require('../middleware/authMiddleware');

// ✅ Tutor Routes
router.post('/apply', verifyToken, applicationController.applyToTuition);
router.get('/check/:tuitionId', verifyToken, applicationController.checkIfApplied);
router.get('/my-applications', verifyToken, applicationController.getMyApplications);
router.patch('/:applicationId/withdraw', verifyToken, applicationController.withdrawApplication);

// ✅ Student Routes
router.get('/tuition/:tuitionId', verifyToken, applicationController.getApplicationsForTuition);
router.patch('/:applicationId/status', verifyToken, applicationController.updateApplicationStatus);

module.exports = router;