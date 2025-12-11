// middleware/roleMiddleware.js

/**
 * Generic role checker - can check multiple roles
 * Usage: checkRole('admin', 'tutor')
 */
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    // Check if user has one of the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires ${allowedRoles.length > 1 ? 'one of these roles' : 'role'}: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Pre-defined role checkers
 */
const isStudent = checkRole('student');
const isTutor = checkRole('tutor');
const isAdmin = checkRole('admin');

/**
 * Combined role checkers
 */
const isStudentOrAdmin = checkRole('student', 'admin');
const isTutorOrAdmin = checkRole('tutor', 'admin');

/**
 * Check if user is authenticated (any role)
 */
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
  next();
};

/**
 * Check ownership of a resource
 * Admins can access everything, others only their own resources
 * 
 * @param {string} resourceUserIdField - Field name containing user ID (default: 'userId')
 * 
 * Example usage:
 * router.get('/profile/:userId', verifyToken, checkOwnership('userId'), getProfile);
 */
const checkOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Get the resource user ID from params, body, or query
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    // Check if the user owns the resource
    if (resourceUserId && resourceUserId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this resource.'
      });
    }

    next();
  };
};

/**
 * Check if user can modify their own resource OR is admin
 * Useful for update/delete operations
 * 
 * Example:
 * router.patch('/tuitions/:tuitionId', verifyToken, checkOwnershipOrAdmin('studentId'), updateTuition);
 */
const checkOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin bypasses all checks
    if (req.user.role === 'admin') {
      return next();
    }

    // For other users, check ownership
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (resourceUserId && resourceUserId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only modify your own resources.'
      });
    }

    next();
  };
};

module.exports = {
  checkRole,
  isStudent,
  isTutor,
  isAdmin,
  isStudentOrAdmin,
  isTutorOrAdmin,
  isAuthenticated,
  checkOwnership,
  checkOwnershipOrAdmin
};