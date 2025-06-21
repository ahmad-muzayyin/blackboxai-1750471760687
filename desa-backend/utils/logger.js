const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define file locations
const logDir = 'logs';
const errorLog = path.join(logDir, 'error.log');
const combinedLog = path.join(logDir, 'combined.log');
const exceptionsLog = path.join(logDir, 'exceptions.log');
const rejectionsLog = path.join(logDir, 'rejections.log');

// Define transports
const transports = [
  // Write all errors to error.log
  new winston.transports.File({
    filename: errorLog,
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  // Write all logs to combined.log
  new winston.transports.File({
    filename: combinedLog,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// If we're not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: format
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: exceptionsLog })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: rejectionsLog })
  ]
});

// Create a stream object for Morgan middleware
logger.stream = {
  write: (message) => logger.http(message.trim())
};

// Helper functions for structured logging
logger.logAPIRequest = (req, startTime) => {
  const duration = Date.now() - startTime;
  logger.info({
    type: 'API_REQUEST',
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.body,
    duration: `${duration}ms`,
    ip: req.ip,
    userId: req.user?.id
  });
};

logger.logAPIResponse = (req, res, startTime) => {
  const duration = Date.now() - startTime;
  logger.info({
    type: 'API_RESPONSE',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user?.id
  });
};

logger.logError = (error, req = null) => {
  logger.error({
    type: 'ERROR',
    message: error.message,
    stack: error.stack,
    path: req?.path,
    method: req?.method,
    userId: req?.user?.id,
    timestamp: new Date().toISOString()
  });
};

logger.logDatabaseQuery = (query, duration) => {
  logger.debug({
    type: 'DATABASE_QUERY',
    query: query,
    duration: `${duration}ms`
  });
};

logger.logAuth = (type, userId, success, details = {}) => {
  logger.info({
    type: 'AUTH',
    subType: type, // 'LOGIN', 'LOGOUT', 'REGISTER', etc.
    userId,
    success,
    ...details,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;
