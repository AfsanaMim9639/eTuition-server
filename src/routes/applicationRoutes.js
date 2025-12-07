const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isTutor, isStudent, isStudentOrAdmin } = require('../middleware/roleMiddleware');

// Tutor routes
router.post('/apply', verifyToken, isTutor, applicationController.applyToTuition);
router.get('/my-applications', verifyToken, isTutor, applicationController.getMyApplications);
router.patch('/:applicationId/withdraw', verifyToken, isTutor, applicationController.withdrawApplication);

// Student routes
router.get('/tuition/:tuitionId', verifyToken, isStudentOrAdmin, applicationController.getApplicationsForTuition);
router.patch('/:applicationId/status', verifyToken, isStudentOrAdmin, applicationController.updateApplicationStatus);

module.exports = router;