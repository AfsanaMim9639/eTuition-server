const express = require('express');
const router = express.Router();
const tuitionController = require('../controllers/tuitionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isStudent, isStudentOrAdmin, isAdmin } = require('../middleware/roleMiddleware');

// ===================================================================
// IMPORTANT: Specific routes MUST come BEFORE dynamic routes (/:id)
// ===================================================================

// Public routes - Specific paths FIRST
router.get('/latest', tuitionController.getLatestTuitions);
router.get('/filter-options', tuitionController.getFilterOptions);

// 🆕 ADMIN ROUTES - Must come before /:id
router.get('/admin/all', verifyToken, isAdmin, tuitionController.getAllTuitionsAdmin);
router.get('/admin/pending', verifyToken, isAdmin, tuitionController.getPendingTuitions);
router.patch('/admin/:id/approve', verifyToken, isAdmin, tuitionController.approveTuition);
router.patch('/admin/:id/reject', verifyToken, isAdmin, tuitionController.rejectTuition);

// Protected routes - Student's own tuitions
router.get('/my/tuitions', verifyToken, isStudent, tuitionController.getMyTuitions);

// Public routes - General listing and details
router.get('/', tuitionController.getAllTuitions);
router.get('/:id', tuitionController.getTuitionById);

// Protected routes - CRUD operations
router.post('/', verifyToken, isStudent, tuitionController.createTuition);
router.put('/:id', verifyToken, isStudentOrAdmin, tuitionController.updateTuition);
router.delete('/:id', verifyToken, isStudentOrAdmin, tuitionController.deleteTuition);

module.exports = router;