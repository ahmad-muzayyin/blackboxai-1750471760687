const { Sequelize } = require('sequelize');
const logger = require('./logger');
const metrics = require('./metrics');
const { DatabaseError } = require('./errors');
const config = require('./config');

class DatabaseHandler {
  constructor() {
    this.sequelize = null;
    this.initialize();
  }

  // Initialize database connection
  initialize() {
    try {
      this.sequelize = new Sequelize(
        config.get('database.name'),
        config.get('database.user'),
        config.get('database.password'),
        {
          host: config.get('database.host'),
          port: config.get('database.port'),
          dialect: config.get('database.dialect'),
          logging: (msg) => logger.debug(msg),
          pool: config.get('database.pool'),
          timezone: config.get('app.timezone')
        }
      );
    } catch (error) {
      logger.error('Database initialization error:', error);
      throw new DatabaseError('Failed to initialize database connection');
    }
  }

  // Test database connection
  async testConnection() {
    try {
      await this.sequelize.authenticate();
      logger.info('Database connection established successfully');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw new DatabaseError('Unable to connect to the database');
    }
  }

  // Execute in transaction
  async transaction(callback) {
    const transaction = await this.sequelize.transaction();
    const startTime = process.hrtime();

    try {
      const result = await callback(transaction);
      await transaction.commit();

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('transaction', 'commit', duration);

      return result;
    } catch (error) {
      await transaction.rollback();
      logger.error('Transaction error:', error);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('transaction', 'rollback', duration);

      throw new DatabaseError('Transaction failed: ' + error.message);
    }
  }

  // Bulk create with validation
  async bulkCreate(model, data, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await model.bulkCreate(data, {
        validate: true,
        returning: true,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('bulkCreate', model.name, duration);

      return result;
    } catch (error) {
      logger.error('Bulk create error:', error);
      throw new DatabaseError('Failed to bulk create records');
    }
  }

  // Bulk update with validation
  async bulkUpdate(model, data, where, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await model.update(data, {
        where,
        returning: true,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('bulkUpdate', model.name, duration);

      return result;
    } catch (error) {
      logger.error('Bulk update error:', error);
      throw new DatabaseError('Failed to bulk update records');
    }
  }

  // Bulk delete
  async bulkDelete(model, where, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await model.destroy({
        where,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('bulkDelete', model.name, duration);

      return result;
    } catch (error) {
      logger.error('Bulk delete error:', error);
      throw new DatabaseError('Failed to bulk delete records');
    }
  }

  // Upsert record
  async upsert(model, data, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await model.upsert(data, {
        returning: true,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('upsert', model.name, duration);

      return result;
    } catch (error) {
      logger.error('Upsert error:', error);
      throw new DatabaseError('Failed to upsert record');
    }
  }

  // Find or create record
  async findOrCreate(model, where, defaults = {}, options = {}) {
    const startTime = process.hrtime();
    try {
      const [record, created] = await model.findOrCreate({
        where,
        defaults,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('findOrCreate', model.name, duration);

      return [record, created];
    } catch (error) {
      logger.error('Find or create error:', error);
      throw new DatabaseError('Failed to find or create record');
    }
  }

  // Execute raw query
  async rawQuery(sql, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await this.sequelize.query(sql, {
        type: Sequelize.QueryTypes.SELECT,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('rawQuery', 'custom', duration);

      return result;
    } catch (error) {
      logger.error('Raw query error:', error);
      throw new DatabaseError('Failed to execute raw query');
    }
  }

  // Count records with conditions
  async count(model, where = {}, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await model.count({
        where,
        ...options
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('count', model.name, duration);

      return result;
    } catch (error) {
      logger.error('Count error:', error);
      throw new DatabaseError('Failed to count records');
    }
  }

  // Check if record exists
  async exists(model, where = {}) {
    const startTime = process.hrtime();
    try {
      const count = await model.count({ where });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackDbQuery('exists', model.name, duration);

      return count > 0;
    } catch (error) {
      logger.error('Exists check error:', error);
      throw new DatabaseError('Failed to check record existence');
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = {
        tables: {},
        totalRecords: 0
      };

      const models = this.sequelize.models;
      for (const [modelName, model] of Object.entries(models)) {
        const count = await model.count();
        stats.tables[modelName] = count;
        stats.totalRecords += count;
      }

      return stats;
    } catch (error) {
      logger.error('Get stats error:', error);
      throw new DatabaseError('Failed to get database statistics');
    }
  }

  // Close database connection
  async close() {
    try {
      await this.sequelize.close();
      logger.info('Database connection closed successfully');
    } catch (error) {
      logger.error('Database close error:', error);
      throw new DatabaseError('Failed to close database connection');
    }
  }
}

// Create singleton instance
const dbHandler = new DatabaseHandler();

// Export instance
module.exports = dbHandler;
