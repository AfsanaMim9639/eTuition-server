const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { verifyToken } = require('../middleware/authMiddleware');

// ✅ Apply for tuition (POST /applications/apply)
router.post('/apply', verifyToken, applicationController.applyToTuition);

// ✅ Check if already applied (GET /applications/check/:tuitionId)
router.get('/check/:tuitionId', verifyToken, applicationController.checkIfApplied);

// ✅ Get my applications - Tutor (GET /applications/my-applications)
router.get('/my-applications', verifyToken, applicationController.getMyApplications);

// ✅ Get applications for tuition - Student (GET /applications/tuition/:tuitionId)
router.get('/tuition/:tuitionId', verifyToken, applicationController.getApplicationsForTuition);

// ✅ Update application status (PATCH /applications/:applicationId/status)
router.patch('/:applicationId/status', verifyToken, applicationController.updateApplicationStatus);

// ✅ Withdraw application - Tutor (PATCH /applications/:applicationId/withdraw)
router.patch('/:applicationId/withdraw', verifyToken, applicationController.withdrawApplication);

module.exports = router;
