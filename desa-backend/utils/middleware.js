const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ValidationError } = require('express-validation');

const logger = require('./logger');
const config = require('./config');
const metrics = require('./metrics');
const i18n = require('./i18n');
const rateLimiter = require('./rateLimiter');
const responseFormatter = require('./responseFormatter');
const { ErrorUtils } = require('./errors');

class MiddlewareManager {
  // Security middleware
  static security() {
    return [
      // Helmet for security headers
      helmet({
        contentSecurityPolicy: config.isProduction(),
        crossOriginEmbedderPolicy: config.isProduction()
      }),

      // CORS configuration
      cors({
        origin: config.get('app.corsOrigins'),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
        credentials: true,
        maxAge: 600 // 10 minutes
      }),

      // Basic security checks
      (req, res, next) => {
        // Remove powered by header
        res.removeHeader('X-Powered-By');
        
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        
        // XSS protection
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        next();
      }
    ];
  }

  // Performance middleware
  static performance() {
    return [
      // Compression
      compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
        level: 6 // Default compression level
      }),

      // Request timeout
      (req, res, next) => {
        req.setTimeout(30000, () => {
          res.status(408).json({
            success: false,
            message: 'Request timeout'
          });
        });
        next();
      }
    ];
  }

  // Logging middleware
  static logging() {
    return [
      // Morgan HTTP request logging
      morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim())
        },
        skip: (req) => req.path === '/health' || req.path === '/metrics'
      }),

      // Request context logging
      (req, res, next) => {
        req.requestId = require('crypto').randomBytes(16).toString('hex');
        req.startTime = Date.now();
        
        res.on('finish', () => {
          const duration = Date.now() - req.startTime;
          logger.info({
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`
          });
        });
        
        next();
      }
    ];
  }

  // Metrics middleware
  static metrics() {
    return [
      metrics.trackHttpRequest(),
      
      // Response time tracking
      (req, res, next) => {
        const start = process.hrtime();
        
        res.on('finish', () => {
          const duration = process.hrtime(start);
          const durationMs = (duration[0] * 1e3 + duration[1] * 1e-6).toFixed(3);
          
          metrics.trackRequestProcessing(req.path, durationMs);
        });
        
        next();
      }
    ];
  }

  // Rate limiting middleware
  static rateLimiting() {
    return [
      // Global rate limiter
      rateLimiter.createLimiter({
        windowMs: config.get('security.rateLimitWindow'),
        max: config.get('security.rateLimitMax')
      }),

      // API specific rate limiters
      rateLimiter.apiLimiter,
      
      // Auth endpoints rate limiter
      (req, res, next) => {
        if (req.path.startsWith('/api/auth')) {
          return rateLimiter.authLimiter(req, res, next);
        }
        next();
      }
    ];
  }

  // Request parsing middleware
  static parsing() {
    return [
      // Body parsing
      (req, res, next) => {
        if (req.is('application/json')) {
          let data = '';
          
          req.on('data', chunk => {
            data += chunk;
            // Check body size
            if (data.length > 1e6) { // 1MB
              data = '';
              res.status(413).json({
                success: false,
                message: 'Payload too large'
              });
              req.connection.destroy();
            }
          });
          
          req.on('end', () => {
            if (data) {
              try {
                req.body = JSON.parse(data);
              } catch (e) {
                return res.status(400).json({
                  success: false,
                  message: 'Invalid JSON'
                });
              }
            }
            next();
          });
        } else {
          next();
        }
      }
    ];
  }

  // Error handling middleware
  static errorHandling() {
    return [
      // Validation error handler
      (err, req, res, next) => {
        if (err instanceof ValidationError) {
          return responseFormatter.validationError(res, err.details);
        }
        next(err);
      },

      // General error handler
      (err, req, res, next) => {
        ErrorUtils.logError(err, logger);

        // Check if error is operational
        if (ErrorUtils.isOperationalError(err)) {
          return responseFormatter.error(
            res,
            err.message,
            err.statusCode,
            err.errors
          );
        }

        // For programming errors, send generic message in production
        const message = config.isProduction()
          ? 'Internal Server Error'
          : err.message;

        return responseFormatter.error(res, message, 500);
      }
    ];
  }

  // Response formatting middleware
  static responseFormatting() {
    return [
      // Add standard response methods
      (req, res, next) => {
        res.success = (data, message) => 
          responseFormatter.success(res, data, message);
        
        res.error = (message, statusCode, errors) => 
          responseFormatter.error(res, message, statusCode, errors);
        
        next();
      }
    ];
  }

  // Localization middleware
  static localization() {
    return [
      i18n.middleware(),
      
      // Add translation helper to response locals
      (req, res, next) => {
        res.locals.t = i18n.translate.bind(i18n);
        next();
      }
    ];
  }

  // Get all middleware
  static getMiddleware() {
    return [
      ...this.security(),
      ...this.performance(),
      ...this.logging(),
      ...this.metrics(),
      ...this.rateLimiting(),
      ...this.parsing(),
      ...this.localization(),
      ...this.responseFormatting()
    ];
  }
}

module.exports = MiddlewareManager;
