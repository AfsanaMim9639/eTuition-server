const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  createSchedule,
  getSchedules,
  getUpcomingClasses,
  getTodayClasses,
  getScheduleById,
  updateSchedule,
  cancelSchedule,
  markAttendance,
  completeClass,
  startClass,
  getClassStatistics,
  deleteSchedule
} = require('../controllers/scheduleController');

// ==================== PUBLIC ROUTES ====================
// None - All schedule routes require authentication

// ==================== PROTECTED ROUTES ====================

// Get class statistics
router.get('/stats', verifyToken, getClassStatistics);

// Get upcoming classes
router.get('/upcoming', verifyToken, getUpcomingClasses);

// Get today's classes
router.get('/today', verifyToken, getTodayClasses);

// Get all schedules (with filters)
router.get('/', verifyToken, getSchedules);

// Get single schedule
router.get('/:id', verifyToken, getScheduleById);

// Create new schedule
router.post('/', verifyToken, createSchedule);

// Update schedule
router.put('/:id', verifyToken, updateSchedule);

// Cancel schedule
router.patch('/:id/cancel', verifyToken, cancelSchedule);

// Mark attendance
router.patch('/:id/attendance', verifyToken, markAttendance);

// Complete class
router.patch('/:id/complete', verifyToken, completeClass);

// Start class
router.patch('/:id/start', verifyToken, startClass);

// Delete schedule (Admin only or creator)
router.delete('/:id', verifyToken, deleteSchedule);

module.exports = router;