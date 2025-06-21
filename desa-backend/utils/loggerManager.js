const winston = require('winston');
const path = require('path');
const config = require('./configManager');

class LoggerManager {
  constructor() {
    this.loggers = new Map();
    this.defaultLogger = null;
    this.initialize();
  }

  // Initialize logger manager
  initialize() {
    try {
      this.setupDefaultLogger();
      this.setupCustomLoggers();
      console.log('Logger manager initialized successfully');
    } catch (error) {
      console.error('Logger manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Logger Setup
   */

  // Setup default logger
  setupDefaultLogger() {
    const logConfig = {
      level: config.get('logging.level', 'info'),
      format: this.getLogFormat(),
      transports: this.getDefaultTransports()
    };

    this.defaultLogger = winston.createLogger(logConfig);
    this.loggers.set('default', this.defaultLogger);
  }

  // Setup custom loggers
  setupCustomLoggers() {
    // Access logger
    this.createLogger('access', {
      format: this.getLogFormat('access'),
      transports: [
        new winston.transports.File({
          filename: path.join('logs', 'access.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Error logger
    this.createLogger('error', {
      level: 'error',
      format: this.getLogFormat('error'),
      transports: [
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Security logger
    this.createLogger('security', {
      format: this.getLogFormat('security'),
      transports: [
        new winston.transports.File({
          filename: path.join('logs', 'security.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Performance logger
    this.createLogger('performance', {
      format: this.getLogFormat('performance'),
      transports: [
        new winston.transports.File({
          filename: path.join('logs', 'performance.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Logger Configuration
   */

  // Get default transports
  getDefaultTransports() {
    const transports = [];

    // Console transport
    if (config.get('logging.console.enabled', true)) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      );
    }

    // File transport
    if (config.get('logging.file.enabled', true)) {
      transports.push(
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );
    }

    return transports;
  }

  // Get log format
  getLogFormat(type = 'default') {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label']
      }),
      this.getCustomFormat(type)
    );
  }

  // Get custom format based on type
  getCustomFormat(type) {
    switch (type) {
      case 'access':
        return winston.format.printf(this.formatAccessLog);
      case 'error':
        return winston.format.printf(this.formatErrorLog);
      case 'security':
        return winston.format.printf(this.formatSecurityLog);
      case 'performance':
        return winston.format.printf(this.formatPerformanceLog);
      default:
        return winston.format.json();
    }
  }

  /**
   * Log Formatters
   */

  // Format access log
  formatAccessLog(info) {
    const { timestamp, message, metadata } = info;
    return JSON.stringify({
      timestamp,
      type: 'access',
      method: metadata.method,
      path: metadata.path,
      status: metadata.status,
      duration: metadata.duration,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      userId: metadata.userId
    });
  }

  // Format error log
  formatErrorLog(info) {
    const { timestamp, level, message, metadata } = info;
    return JSON.stringify({
      timestamp,
      type: 'error',
      level,
      message,
      stack: metadata.stack,
      code: metadata.code,
      context: metadata.context
    });
  }

  // Format security log
  formatSecurityLog(info) {
    const { timestamp, message, metadata } = info;
    return JSON.stringify({
      timestamp,
      type: 'security',
      event: message,
      userId: metadata.userId,
      action: metadata.action,
      resource: metadata.resource,
      ip: metadata.ip,
      userAgent: metadata.userAgent
    });
  }

  // Format performance log
  formatPerformanceLog(info) {
    const { timestamp, message, metadata } = info;
    return JSON.stringify({
      timestamp,
      type: 'performance',
      operation: message,
      duration: metadata.duration,
      context: metadata.context
    });
  }

  /**
   * Logging Methods
   */

  // Create new logger
  createLogger(name, options) {
    if (this.loggers.has(name)) {
      throw new Error(`Logger ${name} already exists`);
    }

    const logger = winston.createLogger(options);
    this.loggers.set(name, logger);
    return logger;
  }

  // Get logger by name
  getLogger(name = 'default') {
    return this.loggers.get(name) || this.defaultLogger;
  }

  // Log methods
  log(level, message, meta = {}) {
    const startTime = process.hrtime();
    this.defaultLogger.log(level, message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Specialized Logging
   */

  // Log HTTP request
  logRequest(req, res, duration) {
    this.getLogger('access').info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id
    });
  }

  // Log security event
  logSecurity(event, data = {}) {
    this.getLogger('security').info(event, data);
  }

  // Log performance metric
  logPerformance(operation, duration, context = {}) {
    this.getLogger('performance').info(operation, {
      duration,
      context
    });
  }

  /**
   * Log Management
   */

  // Clear logs
  async clearLogs(type = null) {
    try {
      if (type) {
        const logger = this.getLogger(type);
        await this.clearLoggerFiles(logger);
      } else {
        for (const logger of this.loggers.values()) {
          await this.clearLoggerFiles(logger);
        }
      }
      return true;
    } catch (error) {
      this.error('Error clearing logs:', error);
      return false;
    }
  }

  // Clear logger files
  async clearLoggerFiles(logger) {
    for (const transport of logger.transports) {
      if (transport instanceof winston.transports.File) {
        await new Promise((resolve, reject) => {
          transport.on('finish', resolve);
          transport.on('error', reject);
          transport.clear();
        });
      }
    }
  }

  /**
   * Utility Methods
   */

  // Get log levels
  getLogLevels() {
    return {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  // Check if level is enabled
  isLevelEnabled(level) {
    const currentLevel = config.get('logging.level', 'info');
    const levels = this.getLogLevels();
    return levels[level] <= levels[currentLevel];
  }
}

// Create singleton instance
const loggerManager = new LoggerManager();

// Export instance
module.exports = loggerManager;
