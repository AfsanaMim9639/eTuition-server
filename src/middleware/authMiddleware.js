// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT Token
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Auth Header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No Bearer token in header');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.error('❌ Token extraction failed');
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    console.log('🔑 Token received:', token.substring(0, 20) + '...');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', { userId: decoded.userId, role: decoded.role });
    
    // Check if user exists
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.error('❌ User not found for token:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'User not found. Token may be invalid.'
      });
    }

    console.log('👤 User found:', { id: user._id, email: user.email, role: user.role });

    // Attach user info to request (including status for feature checks)
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      status: user.status
    };
    
    console.log('✅ Auth successful - User attached to request');
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// Optional: Verify token without requiring it (for optional auth routes)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        status: user.status
      };
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = { verifyToken, optionalAuth };