const express = require('express');
const router = express.Router();
const tuitionController = require('../controllers/tuitionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { isStudent, isStudentOrAdmin } = require('../middleware/roleMiddleware');

// Public routes
router.get('/', tuitionController.getAllTuitions);
router.get('/latest', tuitionController.getLatestTuitions);
router.get('/:id', tuitionController.getTuitionById);

// Protected routes - Student only
router.post('/', verifyToken, isStudent, tuitionController.createTuition);
router.get('/my/tuitions', verifyToken, isStudent, tuitionController.getMyTuitions);
router.put('/:id', verifyToken, isStudentOrAdmin, tuitionController.updateTuition);
router.delete('/:id', verifyToken, isStudentOrAdmin, tuitionController.deleteTuition);

module.exports = router;