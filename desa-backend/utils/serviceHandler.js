const logger = require('./logger');
const cache = require('./cache');
const metrics = require('./metrics');
const eventManager = require('./eventManager');
const dbHandler = require('./dbHandler');
const { NotFoundError, DatabaseError } = require('./errors');

class ServiceHandler {
  /**
   * Generic CRUD operations with caching, metrics, and event emission
   */

  // Create record
  static async create(model, data, options = {}) {
    const {
      cacheKey,
      eventName,
      validate = true,
      include,
      transaction
    } = options;

    const startTime = process.hrtime();

    try {
      // Create record
      const record = await model.create(data, {
        validate,
        include,
        transaction
      });

      // Clear cache if cacheKey provided
      if (cacheKey) {
        await cache.delete(cacheKey);
      }

      // Emit event if eventName provided
      if (eventName) {
        eventManager.emitEvent(eventName, record);
      }

      // Track metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('create', model.name, duration);

      return record;
    } catch (error) {
      logger.error('Create record error:', error);
      throw new DatabaseError(`Failed to create ${model.name}`);
    }
  }

  // Find record by ID
  static async findById(model, id, options = {}) {
    const {
      cacheKey,
      include,
      attributes,
      transaction
    } = options;

    try {
      // Check cache first
      if (cacheKey) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          metrics.trackCacheHit('findById');
          return cached;
        }
        metrics.trackCacheMiss('findById');
      }

      // Find record
      const record = await model.findByPk(id, {
        include,
        attributes,
        transaction
      });

      if (!record) {
        throw new NotFoundError(`${model.name} not found`);
      }

      // Cache result if cacheKey provided
      if (cacheKey) {
        await cache.set(cacheKey, record);
      }

      return record;
    } catch (error) {
      logger.error('Find by ID error:', error);
      throw error;
    }
  }

  // Find all records
  static async findAll(model, options = {}) {
    const {
      cacheKey,
      where,
      include,
      attributes,
      order,
      limit,
      offset,
      transaction
    } = options;

    try {
      // Check cache first
      if (cacheKey) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          metrics.trackCacheHit('findAll');
          return cached;
        }
        metrics.trackCacheMiss('findAll');
      }

      // Find records
      const records = await model.findAll({
        where,
        include,
        attributes,
        order,
        limit,
        offset,
        transaction
      });

      // Cache result if cacheKey provided
      if (cacheKey) {
        await cache.set(cacheKey, records);
      }

      return records;
    } catch (error) {
      logger.error('Find all error:', error);
      throw new DatabaseError(`Failed to fetch ${model.name} records`);
    }
  }

  // Update record
  static async update(model, id, data, options = {}) {
    const {
      cacheKey,
      eventName,
      validate = true,
      include,
      transaction
    } = options;

    const startTime = process.hrtime();

    try {
      // Find record
      const record = await this.findById(model, id, { transaction });

      // Update record
      await record.update(data, {
        validate,
        transaction
      });

      // Reload record with includes if specified
      if (include) {
        await record.reload({
          include,
          transaction
        });
      }

      // Clear cache if cacheKey provided
      if (cacheKey) {
        await cache.delete(cacheKey);
      }

      // Emit event if eventName provided
      if (eventName) {
        eventManager.emitEvent(eventName, record);
      }

      // Track metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('update', model.name, duration);

      return record;
    } catch (error) {
      logger.error('Update record error:', error);
      throw error;
    }
  }

  // Delete record
  static async delete(model, id, options = {}) {
    const {
      cacheKey,
      eventName,
      force = false,
      transaction
    } = options;

    try {
      // Find record
      const record = await this.findById(model, id, { transaction });

      // Delete record
      await record.destroy({
        force,
        transaction
      });

      // Clear cache if cacheKey provided
      if (cacheKey) {
        await cache.delete(cacheKey);
      }

      // Emit event if eventName provided
      if (eventName) {
        eventManager.emitEvent(eventName, { id, ...record.toJSON() });
      }

      return true;
    } catch (error) {
      logger.error('Delete record error:', error);
      throw error;
    }
  }

  /**
   * Transaction wrapper
   */
  static async withTransaction(callback) {
    return dbHandler.transaction(callback);
  }

  /**
   * Bulk operations
   */

  // Bulk create
  static async bulkCreate(model, data, options = {}) {
    const {
      cacheKey,
      eventName,
      validate = true,
      transaction
    } = options;

    try {
      const records = await dbHandler.bulkCreate(model, data, {
        validate,
        transaction
      });

      if (cacheKey) {
        await cache.delete(cacheKey);
      }

      if (eventName) {
        eventManager.emitEvent(eventName, records);
      }

      return records;
    } catch (error) {
      logger.error('Bulk create error:', error);
      throw error;
    }
  }

  // Bulk update
  static async bulkUpdate(model, data, where, options = {}) {
    const {
      cacheKey,
      eventName,
      transaction
    } = options;

    try {
      const result = await dbHandler.bulkUpdate(model, data, where, { transaction });

      if (cacheKey) {
        await cache.delete(cacheKey);
      }

      if (eventName) {
        eventManager.emitEvent(eventName, { where, data, result });
      }

      return result;
    } catch (error) {
      logger.error('Bulk update error:', error);
      throw error;
    }
  }

  /**
   * Cache operations
   */

  // Clear cache by pattern
  static async clearCache(pattern) {
    try {
      await cache.clearPattern(pattern);
      return true;
    } catch (error) {
      logger.error('Clear cache error:', error);
      return false;
    }
  }

  /**
   * Utility methods
   */

  // Check if record exists
  static async exists(model, where) {
    try {
      return await dbHandler.exists(model, where);
    } catch (error) {
      logger.error('Check exists error:', error);
      throw error;
    }
  }

  // Count records
  static async count(model, where = {}) {
    try {
      return await dbHandler.count(model, where);
    } catch (error) {
      logger.error('Count error:', error);
      throw error;
    }
  }
}

module.exports = ServiceHandler;
