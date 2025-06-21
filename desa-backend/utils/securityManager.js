const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const cache = require('./cacheManager');
const eventManager = require('./eventManager');

class SecurityManager {
  constructor() {
    this.saltRounds = 10;
    this.tokenBlacklist = new Set();
    this.initialize();
  }

  // Initialize security manager
  initialize() {
    try {
      this.setupSecurityConfig();
      logger.info('Security manager initialized successfully');
    } catch (error) {
      logger.error('Security manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Security Configuration
   */

  // Setup security configuration
  setupSecurityConfig() {
    const securityConfig = config.get('security', {});
    this.saltRounds = securityConfig.saltRounds || 10;
    this.jwtSecret = securityConfig.jwt?.secret || crypto.randomBytes(32).toString('hex');
    this.jwtExpiration = securityConfig.jwt?.expiration || '1d';
  }

  /**
   * Password Management
   */

  // Hash password
  async hashPassword(password) {
    try {
      const startTime = process.hrtime();
      const hash = await bcrypt.hash(password, this.saltRounds);
      this.trackOperation('hash', startTime);
      return hash;
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw error;
    }
  }

  // Compare password
  async comparePassword(password, hash) {
    try {
      const startTime = process.hrtime();
      const match = await bcrypt.compare(password, hash);
      this.trackOperation('compare', startTime);
      return match;
    } catch (error) {
      logger.error('Password comparison error:', error);
      throw error;
    }
  }

  // Generate password
  generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * JWT Management
   */

  // Generate JWT token
  generateToken(payload, options = {}) {
    try {
      const startTime = process.hrtime();
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiration,
        ...options
      });
      this.trackOperation('generateToken', startTime);
      return token;
    } catch (error) {
      logger.error('Token generation error:', error);
      throw error;
    }
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      const startTime = process.hrtime();
      
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been blacklisted');
      }

      const decoded = jwt.verify(token, this.jwtSecret);
      this.trackOperation('verifyToken', startTime);
      return decoded;
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  }

  // Blacklist token
  blacklistToken(token) {
    this.tokenBlacklist.add(token);
    // Optionally persist to database or cache
  }

  // Check if token is blacklisted
  isTokenBlacklisted(token) {
    return this.tokenBlacklist.has(token);
  }

  /**
   * Request Security
   */

  // Get rate limiter middleware
  getRateLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later'
    };

    return rateLimit({
      ...defaultOptions,
      ...options,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded:', {
          ip: req.ip,
          path: req.path
        });
        
        metrics.incrementCounter('rate_limit_exceeded_total', {
          path: req.path
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: options.message || defaultOptions.message
        });
      }
    });
  }

  // Get security middleware
  getSecurityMiddleware() {
    return [
      helmet(),
      this.getCorsMiddleware(),
      this.getContentSecurityPolicy()
    ];
  }

  // Get CORS middleware
  getCorsMiddleware() {
    const corsConfig = config.get('security.cors', {});
    return cors({
      origin: corsConfig.origin || '*',
      methods: corsConfig.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: corsConfig.allowedHeaders || ['Content-Type', 'Authorization'],
      exposedHeaders: corsConfig.exposedHeaders || ['Content-Range', 'X-Content-Range'],
      credentials: corsConfig.credentials || true,
      maxAge: corsConfig.maxAge || 86400 // 24 hours
    });
  }

  // Get Content Security Policy
  getContentSecurityPolicy() {
    return helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    });
  }

  /**
   * Input Validation
   */

  // Sanitize input
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .trim();
  }

  // Validate email
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*]/.test(password);

    const validations = {
      length: password.length >= minLength,
      upperCase: hasUpperCase,
      lowerCase: hasLowerCase,
      numbers: hasNumbers,
      specialChars: hasSpecialChars
    };

    return {
      isValid: Object.values(validations).every(v => v),
      validations
    };
  }

  /**
   * Encryption
   */

  // Encrypt data
  encrypt(data, key = this.jwtSecret) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        content: encrypted,
        tag: authTag.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption error:', error);
      throw error;
    }
  }

  // Decrypt data
  decrypt(encrypted, key = this.jwtSecret) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key),
        Buffer.from(encrypted.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
      
      let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Decryption error:', error);
      throw error;
    }
  }

  /**
   * Security Scanning
   */

  // Scan for vulnerabilities
  async scanForVulnerabilities(data) {
    try {
      // Implementation depends on your security requirements
      // This is just an example
      const vulnerabilities = [];

      // Check for SQL injection patterns
      if (this.containsSQLInjection(data)) {
        vulnerabilities.push({
          type: 'SQL_INJECTION',
          severity: 'HIGH',
          data: data
        });
      }

      // Check for XSS patterns
      if (this.containsXSS(data)) {
        vulnerabilities.push({
          type: 'XSS',
          severity: 'HIGH',
          data: data
        });
      }

      return vulnerabilities;
    } catch (error) {
      logger.error('Security scan error:', error);
      throw error;
    }
  }

  // Check for SQL injection patterns
  containsSQLInjection(data) {
    const sqlPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
      /exec(\s|\+)+(s|x)p\w+/ix
    ];

    return sqlPatterns.some(pattern => {
      if (typeof data === 'string') {
        return pattern.test(data);
      }
      return false;
    });
  }

  // Check for XSS patterns
  containsXSS(data) {
    const xssPatterns = [
      /<script\b[^>]*>(.*?)<\/script>/i,
      /javascript:[^\n]*/i,
      /onerror\s*=\s*[^\n]*/i,
      /<img[^>]+src[^>]*>/i
    ];

    return xssPatterns.some(pattern => {
      if (typeof data === 'string') {
        return pattern.test(data);
      }
      return false;
    });
  }

  /**
   * Metrics Tracking
   */

  // Track security operation metrics
  trackOperation(operation, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('security_operation_duration_seconds', duration, {
      operation
    });

    metrics.incrementCounter('security_operations_total', {
      operation
    });
  }

  /**
   * Security Events
   */

  // Log security event
  logSecurityEvent(event, data = {}) {
    logger.warn('Security event:', { event, ...data });
    eventManager.emitEvent('security:event', { event, data });
  }

  /**
   * Status Information
   */

  // Get security status
  getStatus() {
    return {
      tokenBlacklistSize: this.tokenBlacklist.size,
      saltRounds: this.saltRounds,
      jwtExpiration: this.jwtExpiration
    };
  }
}

// Create singleton instance
const securityManager = new SecurityManager();

// Export instance
module.exports = securityManager;
