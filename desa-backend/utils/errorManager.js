const logger = require('./loggerManager');
const metrics = require('./metricsManager');
const i18n = require('./i18nManager');
const eventManager = require('./eventManager');

/**
 * Custom Error Classes
 */

// Base Error
class BaseError extends Error {
  constructor(message, code, status = 500, data = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.data = data;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      data: this.data,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// Validation Error
class ValidationError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'VALIDATION_ERROR', 400, data);
  }
}

// Authentication Error
class AuthenticationError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, data);
  }
}

// Authorization Error
class AuthorizationError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'AUTHORIZATION_ERROR', 403, data);
  }
}

// Not Found Error
class NotFoundError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'NOT_FOUND', 404, data);
  }
}

// Conflict Error
class ConflictError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'CONFLICT', 409, data);
  }
}

// Rate Limit Error
class RateLimitError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, data);
  }
}

// Database Error
class DatabaseError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'DATABASE_ERROR', 500, data);
  }
}

// External Service Error
class ExternalServiceError extends BaseError {
  constructor(message, data = {}) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, data);
  }
}

class ErrorManager {
  constructor() {
    this.errorHandlers = new Map();
    this.initialize();
  }

  // Initialize error manager
  initialize() {
    try {
      this.setupDefaultHandlers();
      logger.info('Error manager initialized successfully');
    } catch (error) {
      logger.error('Error manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Error Handler Setup
   */

  // Setup default error handlers
  setupDefaultHandlers() {
    // Validation errors
    this.registerHandler(ValidationError, this.handleValidationError.bind(this));

    // Authentication errors
    this.registerHandler(AuthenticationError, this.handleAuthenticationError.bind(this));

    // Authorization errors
    this.registerHandler(AuthorizationError, this.handleAuthorizationError.bind(this));

    // Not found errors
    this.registerHandler(NotFoundError, this.handleNotFoundError.bind(this));

    // Conflict errors
    this.registerHandler(ConflictError, this.handleConflictError.bind(this));

    // Rate limit errors
    this.registerHandler(RateLimitError, this.handleRateLimitError.bind(this));

    // Database errors
    this.registerHandler(DatabaseError, this.handleDatabaseError.bind(this));

    // External service errors
    this.registerHandler(ExternalServiceError, this.handleExternalServiceError.bind(this));
  }

  /**
   * Error Registration
   */

  // Register error handler
  registerHandler(ErrorClass, handler) {
    this.errorHandlers.set(ErrorClass, handler);
  }

  // Unregister error handler
  unregisterHandler(ErrorClass) {
    this.errorHandlers.delete(ErrorClass);
  }

  /**
   * Error Handling
   */

  // Handle error
  async handleError(error, req = null) {
    const startTime = process.hrtime();

    try {
      // Find appropriate handler
      const handler = this.findHandler(error);
      
      // Handle the error
      const response = await handler(error, req);
      
      // Track error metrics
      this.trackError(error);
      
      // Log error
      this.logError(error, req);
      
      // Emit error event
      this.emitErrorEvent(error);

      return response;
    } catch (handlingError) {
      logger.error('Error handling error:', handlingError);
      return this.handleFallbackError(error);
    } finally {
      this.trackErrorHandling(startTime);
    }
  }

  // Find appropriate error handler
  findHandler(error) {
    for (const [ErrorClass, handler] of this.errorHandlers) {
      if (error instanceof ErrorClass) {
        return handler;
      }
    }
    return this.handleUnknownError.bind(this);
  }

  /**
   * Specific Error Handlers
   */

  // Handle validation error
  handleValidationError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError(error.message),
        details: error.data
      }
    };
  }

  // Handle authentication error
  handleAuthenticationError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError(error.message)
      }
    };
  }

  // Handle authorization error
  handleAuthorizationError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError(error.message)
      }
    };
  }

  // Handle not found error
  handleNotFoundError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError(error.message)
      }
    };
  }

  // Handle conflict error
  handleConflictError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError(error.message)
      }
    };
  }

  // Handle rate limit error
  handleRateLimitError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError(error.message),
        retryAfter: error.data.retryAfter
      }
    };
  }

  // Handle database error
  handleDatabaseError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError('errors.database.generic')
      }
    };
  }

  // Handle external service error
  handleExternalServiceError(error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateError('errors.external_service.generic'),
        service: error.data.service
      }
    };
  }

  // Handle unknown error
  handleUnknownError(error) {
    logger.error('Unknown error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: this.translateError('errors.internal')
      }
    };
  }

  // Handle fallback error
  handleFallbackError(error) {
    logger.error('Fallback error handling:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: this.translateError('errors.internal')
      }
    };
  }

  /**
   * Error Logging
   */

  // Log error
  logError(error, req = null) {
    const errorData = {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      data: error.data
    };

    if (req) {
      errorData.request = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        ip: req.ip
      };
    }

    logger.error('Application error:', errorData);
  }

  /**
   * Error Translation
   */

  // Translate error message
  translateError(key, data = {}) {
    return i18n.translate(`errors.${key}`, {
      defaultValue: key,
      ...data
    });
  }

  /**
   * Error Events
   */

  // Emit error event
  emitErrorEvent(error) {
    eventManager.emitEvent('error:occurred', {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      timestamp: error.timestamp
    });
  }

  /**
   * Metrics Tracking
   */

  // Track error metrics
  trackError(error) {
    metrics.incrementCounter('errors_total', {
      type: error.name,
      code: error.code
    });
  }

  // Track error handling duration
  trackErrorHandling(startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('error_handling_duration_seconds', duration);
  }

  /**
   * Error Analysis
   */

  // Analyze error patterns
  async analyzeErrorPatterns(timeframe = '24h') {
    try {
      // Implementation depends on your logging and analytics setup
      return {
        totalErrors: 0,
        topErrors: [],
        errorTrends: []
      };
    } catch (error) {
      logger.error('Error analyzing error patterns:', error);
      throw error;
    }
  }
}

// Create singleton instance
const errorManager = new ErrorManager();

// Export instance and error classes
module.exports = {
  errorManager,
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError
};
