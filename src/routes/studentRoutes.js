// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isStudent } = require('../middleware/roleMiddleware');

// All routes require authentication and student role
router.use(verifyToken);
router.use(isStudent);

// Dashboard routes
router.get('/dashboard', studentController.getDashboardData);
router.get('/stats', studentController.getStudentStats);

module.exports = router;