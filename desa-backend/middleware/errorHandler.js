const logger = require('../utils/logger');

// Custom error class for API errors
class APIError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware to handle 404 errors
const notFound = (req, res, next) => {
  const error = new APIError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error
  logger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });

  // Handling different types of errors
  let error = { ...err };
  error.message = err.message;

  // Mongoose/MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new APIError(
      `Duplicate field value: ${field}. Please use another value.`,
      400
    );
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message
    }));
    error = new APIError('Validation Error', 400, errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new APIError('Invalid token. Please log in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new APIError('Your token has expired. Please log in again.', 401);
  }

  // Development error response (with stack trace)
  if (process.env.NODE_ENV === 'development') {
    return res.status(error.statusCode).json({
      success: false,
      status: error.status,
      message: error.message,
      errors: error.errors,
      stack: err.stack,
      error: err
    });
  }

  // Production error response (without stack trace)
  return res.status(error.statusCode).json({
    success: false,
    status: error.status,
    message: error.message,
    errors: error.errors
  });
};

// Async error handler wrapper
const catchAsync = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  APIError,
  notFound,
  errorHandler,
  catchAsync
};
