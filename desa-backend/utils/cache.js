const Redis = require('ioredis');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.client = null;
    this.defaultTTL = 3600; // 1 hour in seconds
    this.initialize();
  }

  // Initialize Redis connection
  initialize() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.client.on('connect', () => {
        logger.info('Redis cache connected');
      });

      this.client.on('error', (error) => {
        logger.error('Redis cache error:', error);
      });

    } catch (error) {
      logger.error('Redis cache initialization error:', error);
    }
  }

  // Generate cache key
  generateKey(prefix, identifier) {
    return `${prefix}:${identifier}`;
  }

  // Set cache with optional TTL
  async set(key, data, ttl = this.defaultTTL) {
    try {
      const serializedData = JSON.stringify(data);
      if (ttl) {
        await this.client.setex(key, ttl, serializedData);
      } else {
        await this.client.set(key, serializedData);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  // Get cache
  async get(key) {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  // Delete cache
  async delete(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  // Clear cache by pattern
  async clearPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error('Cache clear pattern error:', error);
      return false;
    }
  }

  // Set multiple cache entries
  async mset(entries, ttl = this.defaultTTL) {
    try {
      const pipeline = this.client.pipeline();
      
      entries.forEach(({ key, data }) => {
        const serializedData = JSON.stringify(data);
        if (ttl) {
          pipeline.setex(key, ttl, serializedData);
        } else {
          pipeline.set(key, serializedData);
        }
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  // Get multiple cache entries
  async mget(keys) {
    try {
      const results = await this.client.mget(keys);
      return results.map(item => item ? JSON.parse(item) : null);
    } catch (error) {
      logger.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  // Increment counter
  async increment(key, value = 1) {
    try {
      return await this.client.incrby(key, value);
    } catch (error) {
      logger.error('Cache increment error:', error);
      return null;
    }
  }

  // Decrement counter
  async decrement(key, value = 1) {
    try {
      return await this.client.decrby(key, value);
    } catch (error) {
      logger.error('Cache decrement error:', error);
      return null;
    }
  }

  // Set cache with hash
  async hset(key, field, data) {
    try {
      const serializedData = JSON.stringify(data);
      await this.client.hset(key, field, serializedData);
      return true;
    } catch (error) {
      logger.error('Cache hset error:', error);
      return false;
    }
  }

  // Get cache from hash
  async hget(key, field) {
    try {
      const data = await this.client.hget(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache hget error:', error);
      return null;
    }
  }

  // Get all hash fields
  async hgetall(key) {
    try {
      const data = await this.client.hgetall(key);
      return Object.keys(data).reduce((acc, field) => {
        acc[field] = JSON.parse(data[field]);
        return acc;
      }, {});
    } catch (error) {
      logger.error('Cache hgetall error:', error);
      return null;
    }
  }

  // Cache middleware for Express routes
  cacheRoute(prefix, ttl = this.defaultTTL) {
    return async (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      const key = this.generateKey(prefix, req.originalUrl);

      try {
        const cachedData = await this.get(key);
        if (cachedData) {
          return res.json(cachedData);
        }

        // Store original send function
        const sendResponse = res.json.bind(res);

        // Override send function
        res.json = (body) => {
          // Cache the response
          this.set(key, body, ttl);
          // Send the response
          return sendResponse(body);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // Clear cache middleware
  clearCache(pattern) {
    return async (req, res, next) => {
      try {
        await this.clearPattern(pattern);
        next();
      } catch (error) {
        logger.error('Clear cache middleware error:', error);
        next();
      }
    };
  }

  // Close Redis connection
  async close() {
    try {
      await this.client.quit();
      logger.info('Redis cache connection closed');
    } catch (error) {
      logger.error('Redis cache close error:', error);
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Export instance
module.exports = cacheManager;
