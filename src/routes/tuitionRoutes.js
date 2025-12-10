const express = require('express');
const router = express.Router();
const tuitionController = require('../controllers/tuitionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isStudent, isStudentOrAdmin } = require('../middleware/roleMiddleware');

// ===================================================================
// IMPORTANT: Specific routes MUST come BEFORE dynamic routes (/:id)
// ===================================================================

// Public routes - Specific paths FIRST
router.get('/latest', tuitionController.getLatestTuitions);

// Protected routes - Student's own tuitions
router.get('/my/tuitions', verifyToken, isStudent, tuitionController.getMyTuitions);

// Public routes - General listing and details
router.get('/', tuitionController.getAllTuitions);
router.get('/:id', tuitionController.getTuitionById); // ✅ Dynamic route LAST

// Protected routes - CRUD operations
router.post('/', verifyToken, isStudent, tuitionController.createTuition);
router.put('/:id', verifyToken, isStudentOrAdmin, tuitionController.updateTuition);
router.delete('/:id', verifyToken, isStudentOrAdmin, tuitionController.deleteTuition);

module.exports = router;