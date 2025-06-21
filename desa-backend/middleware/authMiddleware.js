const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated.'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    next(error);
  }
};

// Middleware to check user roles
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const isAdmin = checkRole('admin_desa');

// Middleware to check if user is perangkat desa
const isPerangkatDesa = checkRole('admin_desa', 'perangkat_desa');

// Middleware to check if user owns the resource or is admin
const isOwnerOrAdmin = (paramName = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[paramName] || req.body[paramName];
    
    if (
      req.user.role === 'admin_desa' ||
      req.user.id.toString() === resourceUserId?.toString()
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. Not resource owner or admin.'
    });
  };
};

module.exports = {
  authMiddleware,
  checkRole,
  isAdmin,
  isPerangkatDesa,
  isOwnerOrAdmin
};
