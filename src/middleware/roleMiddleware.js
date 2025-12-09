// Check if user has required role
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

// Check if user is student
const isStudent = checkRole('student');

// Check if user is tutor
const isTutor = checkRole('tutor');

// Check if user is admin
const isAdmin = checkRole('admin');

// Check if user is student or admin
const isStudentOrAdmin = checkRole('student', 'admin');

// Check if user is tutor or admin
const isTutorOrAdmin = checkRole('tutor', 'admin');

// Check if user can access any authenticated route
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
  next();
};

// Check ownership (for resources that belong to specific users)
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

module.exports = {
  checkRole,
  isStudent,
  isTutor,
  isAdmin,
  isStudentOrAdmin,
  isTutorOrAdmin,
  isAuthenticated,
  checkOwnership
};