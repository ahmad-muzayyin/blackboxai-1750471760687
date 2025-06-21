/**
 * Custom error classes for application-specific error handling
 */

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized to access this resource') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

class FileUploadError extends AppError {
  constructor(message = 'File upload failed') {
    super(message, 400, 'FILE_UPLOAD_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

// Error factory for creating specific error instances
class ErrorFactory {
  static create(type, message, details = {}) {
    switch (type) {
      case 'VALIDATION':
        return new ValidationError(message, details.errors);
      case 'AUTHENTICATION':
        return new AuthenticationError(message);
      case 'AUTHORIZATION':
        return new AuthorizationError(message);
      case 'NOT_FOUND':
        return new NotFoundError(message);
      case 'CONFLICT':
        return new ConflictError(message);
      case 'DATABASE':
        return new DatabaseError(message);
      case 'FILE_UPLOAD':
        return new FileUploadError(message);
      case 'RATE_LIMIT':
        return new RateLimitError(message);
      case 'SERVICE_UNAVAILABLE':
        return new ServiceUnavailableError(message);
      default:
        return new AppError(message);
    }
  }
}

// Error messages for common scenarios
const ErrorMessages = {
  VALIDATION: {
    REQUIRED_FIELD: 'Field is required',
    INVALID_FORMAT: 'Invalid format',
    INVALID_LENGTH: 'Invalid length',
    INVALID_VALUE: 'Invalid value'
  },
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Invalid token',
    TOKEN_MISSING: 'No token provided',
    UNAUTHORIZED: 'Unauthorized access',
    ACCOUNT_LOCKED: 'Account is locked'
  },
  USER: {
    NOT_FOUND: 'User not found',
    ALREADY_EXISTS: 'User already exists',
    INVALID_ROLE: 'Invalid user role'
  },
  PENDUDUK: {
    NOT_FOUND: 'Penduduk not found',
    NIK_EXISTS: 'NIK already registered',
    INVALID_NIK: 'Invalid NIK format'
  },
  SURAT: {
    NOT_FOUND: 'Surat not found',
    INVALID_STATUS: 'Invalid surat status',
    ALREADY_PROCESSED: 'Surat already processed'
  },
  BANTUAN: {
    NOT_FOUND: 'Bantuan not found',
    INVALID_PROGRAM: 'Invalid program type',
    ALREADY_REGISTERED: 'Already registered for this program'
  },
  APBDES: {
    NOT_FOUND: 'APBDes not found',
    INVALID_YEAR: 'Invalid year',
    ALREADY_EXISTS: 'Entry already exists for this year'
  },
  FILE: {
    UPLOAD_FAILED: 'File upload failed',
    INVALID_TYPE: 'Invalid file type',
    SIZE_EXCEEDED: 'File size exceeded',
    NOT_FOUND: 'File not found'
  },
  DATABASE: {
    CONNECTION_ERROR: 'Database connection error',
    QUERY_ERROR: 'Database query error',
    TRANSACTION_ERROR: 'Transaction failed'
  }
};

// Error handler utility functions
const ErrorUtils = {
  // Format error for response
  formatError: (error) => {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.errorCode,
        status: error.statusCode,
        ...(error.errors && { details: error.errors })
      }
    };
  },

  // Check if error is operational
  isOperationalError: (error) => {
    return error.isOperational;
  },

  // Log error details
  logError: (error, logger) => {
    if (error.isOperational) {
      logger.warn('Operational error:', {
        message: error.message,
        code: error.errorCode,
        stack: error.stack
      });
    } else {
      logger.error('Programming error:', {
        message: error.message,
        code: error.errorCode,
        stack: error.stack
      });
    }
  }
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  FileUploadError,
  RateLimitError,
  ServiceUnavailableError,
  ErrorFactory,
  ErrorMessages,
  ErrorUtils
};
