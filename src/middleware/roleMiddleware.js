// Check if user has required role
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
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

module.exports = {
  checkRole,
  isStudent,
  isTutor,
  isAdmin,
  isStudentOrAdmin,
  isTutorOrAdmin
};