const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const cache = require('./cache');
const logger = require('./logger');
const ResponseFormatter = require('./responseFormatter');

class RateLimiter {
  constructor() {
    this.defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    };
  }

  // Create Redis store for rate limiting
  createRedisStore() {
    return new RedisStore({
      client: cache.client,
      prefix: 'rate-limit:',
      // Optional expiry behavior
      expiry: this.defaultOptions.windowMs / 1000, // seconds
    });
  }

  // Create basic rate limiter
  createLimiter(options = {}) {
    const config = {
      ...this.defaultOptions,
      ...options,
      store: this.createRedisStore(),
      handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        return ResponseFormatter.tooManyRequests(res, options.message || this.defaultOptions.message);
      }
    };

    return rateLimit(config);
  }

  // API rate limiter
  apiLimiter = this.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many API requests from this IP, please try again later.'
  });

  // Authentication rate limiter (more strict)
  authLimiter = this.createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 login attempts per hour
    message: 'Too many login attempts from this IP, please try again later.'
  });

  // File upload rate limiter
  uploadLimiter = this.createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 uploads per hour
    message: 'Too many file uploads from this IP, please try again later.'
  });

  // Create endpoint-specific rate limiter
  createEndpointLimiter(options = {}) {
    return this.createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // Limit each IP to 10 requests per minute
      message: 'Too many requests to this endpoint, please try again later.',
      ...options
    });
  }

  // Dynamic rate limiter based on user role
  createRoleLimiter(roleRates) {
    return (req, res, next) => {
      const userRole = req.user ? req.user.role : 'anonymous';
      const rateConfig = roleRates[userRole] || roleRates.default;

      const limiter = this.createLimiter({
        windowMs: rateConfig.windowMs,
        max: rateConfig.max,
        message: `Rate limit exceeded for role: ${userRole}`
      });

      return limiter(req, res, next);
    };
  }

  // Sliding window rate limiter
  createSlidingWindowLimiter(options = {}) {
    const {
      windowMs = 60 * 1000, // 1 minute
      max = 30, // 30 requests per minute
      windowSize = 60, // Window divided into 60 segments
      message = 'Rate limit exceeded for sliding window'
    } = options;

    const segmentMs = Math.floor(windowMs / windowSize);

    return async (req, res, next) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      const key = `sliding-window:${req.ip}`;

      try {
        // Get the current window data
        const windowData = await cache.get(key) || [];

        // Remove timestamps outside the current window
        const validData = windowData.filter(timestamp => timestamp > windowStart);

        // Check if the rate limit is exceeded
        if (validData.length >= max) {
          logger.warn(`Sliding window rate limit exceeded for IP: ${req.ip}`);
          return ResponseFormatter.tooManyRequests(res, message);
        }

        // Add current timestamp and save
        validData.push(now);
        await cache.set(key, validData, Math.ceil(windowMs / 1000));

        next();
      } catch (error) {
        logger.error('Sliding window rate limit error:', error);
        next();
      }
    };
  }

  // Token bucket rate limiter
  createTokenBucketLimiter(options = {}) {
    const {
      bucketSize = 10, // Maximum tokens
      refillRate = 1, // Tokens per second
      refillInterval = 1000, // 1 second
      message = 'Rate limit exceeded for token bucket'
    } = options;

    return async (req, res, next) => {
      const key = `token-bucket:${req.ip}`;

      try {
        // Get or initialize bucket
        let bucket = await cache.get(key) || {
          tokens: bucketSize,
          lastRefill: Date.now()
        };

        // Calculate tokens to add based on time passed
        const now = Date.now();
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(timePassed / refillInterval) * refillRate;

        // Refill bucket
        bucket.tokens = Math.min(bucketSize, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        // Check if we have tokens available
        if (bucket.tokens < 1) {
          logger.warn(`Token bucket rate limit exceeded for IP: ${req.ip}`);
          return ResponseFormatter.tooManyRequests(res, message);
        }

        // Consume token
        bucket.tokens--;
        await cache.set(key, bucket, 3600); // Store for 1 hour

        next();
      } catch (error) {
        logger.error('Token bucket rate limit error:', error);
        next();
      }
    };
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Export instance
module.exports = rateLimiter;
