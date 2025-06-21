const Redis = require('ioredis');
const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const eventManager = require('./eventManager');

class CacheManager {
  constructor() {
    this.client = null;
    this.prefix = 'desa:';
    this.defaultTTL = 3600; // 1 hour
    this.initialize();
  }

  // Initialize cache manager
  initialize() {
    try {
      this.setupRedisClient();
      this.setupEventListeners();
      logger.info('Cache manager initialized successfully');
    } catch (error) {
      logger.error('Cache manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Redis Client Setup
   */

  // Setup Redis client
  setupRedisClient() {
    const redisConfig = config.get('redis', {
      host: 'localhost',
      port: 6379,
      password: null,
      db: 0
    });

    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });
  }

  // Setup event listeners
  setupEventListeners() {
    eventManager.on('user:updated', this.invalidateUserCache.bind(this));
    eventManager.on('penduduk:updated', this.invalidatePendudukCache.bind(this));
    eventManager.on('surat:updated', this.invalidateSuratCache.bind(this));
    eventManager.on('bantuan:updated', this.invalidateBantuanCache.bind(this));
  }

  /**
   * Cache Operations
   */

  // Set cache
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const startTime = process.hrtime();
      const fullKey = this.getFullKey(key);
      const serializedValue = this.serialize(value);

      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }

      this.trackOperation('set', startTime);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  // Get cache
  async get(key) {
    try {
      const startTime = process.hrtime();
      const fullKey = this.getFullKey(key);
      const value = await this.client.get(fullKey);

      this.trackOperation('get', startTime);
      return value ? this.deserialize(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  // Delete cache
  async delete(key) {
    try {
      const startTime = process.hrtime();
      const fullKey = this.getFullKey(key);
      await this.client.del(fullKey);

      this.trackOperation('delete', startTime);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  // Clear all cache
  async clear() {
    try {
      const startTime = process.hrtime();
      const keys = await this.client.keys(`${this.prefix}*`);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      this.trackOperation('clear', startTime);
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Advanced Cache Operations
   */

  // Remember (get from cache or compute and cache)
  async remember(key, ttl, callback) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await callback();
    await this.set(key, value, ttl);
    return value;
  }

  // Remember forever (no expiration)
  async rememberForever(key, callback) {
    return this.remember(key, 0, callback);
  }

  // Increment value
  async increment(key, amount = 1) {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.incrby(fullKey, amount);
    } catch (error) {
      logger.error('Cache increment error:', error);
      return false;
    }
  }

  // Decrement value
  async decrement(key, amount = 1) {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.decrby(fullKey, amount);
    } catch (error) {
      logger.error('Cache decrement error:', error);
      return false;
    }
  }

  /**
   * Cache Invalidation
   */

  // Invalidate user cache
  async invalidateUserCache(userId) {
    try {
      const pattern = this.getFullKey(`user:${userId}:*`);
      await this.deleteByPattern(pattern);
    } catch (error) {
      logger.error('Error invalidating user cache:', error);
    }
  }

  // Invalidate penduduk cache
  async invalidatePendudukCache(pendudukId) {
    try {
      const pattern = this.getFullKey(`penduduk:${pendudukId}:*`);
      await this.deleteByPattern(pattern);
    } catch (error) {
      logger.error('Error invalidating penduduk cache:', error);
    }
  }

  // Invalidate surat cache
  async invalidateSuratCache(suratId) {
    try {
      const pattern = this.getFullKey(`surat:${suratId}:*`);
      await this.deleteByPattern(pattern);
    } catch (error) {
      logger.error('Error invalidating surat cache:', error);
    }
  }

  // Invalidate bantuan cache
  async invalidateBantuanCache(bantuanId) {
    try {
      const pattern = this.getFullKey(`bantuan:${bantuanId}:*`);
      await this.deleteByPattern(pattern);
    } catch (error) {
      logger.error('Error invalidating bantuan cache:', error);
    }
  }

  /**
   * Cache Tags
   */

  // Add tags to cache entry
  async tag(key, tags) {
    try {
      const fullKey = this.getFullKey(key);
      const tagPromises = tags.map(tag => {
        const tagKey = this.getTagKey(tag);
        return this.client.sadd(tagKey, fullKey);
      });
      await Promise.all(tagPromises);
    } catch (error) {
      logger.error('Cache tag error:', error);
    }
  }

  // Flush cache by tags
  async flushTags(tags) {
    try {
      const tagKeys = tags.map(tag => this.getTagKey(tag));
      const keys = await this.client.sunion(...tagKeys);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
        await this.client.del(...tagKeys);
      }
    } catch (error) {
      logger.error('Cache flush tags error:', error);
    }
  }

  /**
   * Utility Methods
   */

  // Get full cache key
  getFullKey(key) {
    return `${this.prefix}${key}`;
  }

  // Get tag key
  getTagKey(tag) {
    return `${this.prefix}tag:${tag}`;
  }

  // Serialize value
  serialize(value) {
    return JSON.stringify(value);
  }

  // Deserialize value
  deserialize(value) {
    return JSON.parse(value);
  }

  // Delete by pattern
  async deleteByPattern(pattern) {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // Track cache operation metrics
  trackOperation(operation, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('cache_operation_duration_seconds', duration, {
      operation
    });

    metrics.incrementCounter('cache_operations_total', {
      operation
    });
  }

  /**
   * Health Check
   */

  // Check cache health
  async healthCheck() {
    try {
      const startTime = process.hrtime();
      await this.client.ping();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const latency = seconds + nanoseconds / 1e9;

      return {
        status: 'healthy',
        latency,
        info: await this.client.info()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Cache Statistics
   */

  // Get cache statistics
  async getStats() {
    try {
      const info = await this.client.info();
      const dbSize = await this.client.dbsize();
      const memory = await this.client.info('memory');

      return {
        size: dbSize,
        memory,
        info
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Export instance
module.exports = cacheManager;
