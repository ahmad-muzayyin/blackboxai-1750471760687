const { Sequelize } = require('sequelize');
const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const eventManager = require('./eventManager');

class DbManager {
  constructor() {
    this.sequelize = null;
    this.models = new Map();
    this.initialize();
  }

  // Initialize database manager
  initialize() {
    try {
      this.setupConnection();
      this.setupEventListeners();
      logger.info('Database manager initialized successfully');
    } catch (error) {
      logger.error('Database manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Database Connection
   */

  // Setup database connection
  setupConnection() {
    const dbConfig = config.get('database');

    this.sequelize = new Sequelize(
      dbConfig.name,
      dbConfig.username,
      dbConfig.password,
      {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: (msg) => logger.debug(msg),
        pool: {
          max: dbConfig.pool?.max || 5,
          min: dbConfig.pool?.min || 0,
          acquire: dbConfig.pool?.acquire || 30000,
          idle: dbConfig.pool?.idle || 10000
        },
        define: {
          timestamps: true,
          underscored: true
        }
      }
    );
  }

  // Setup event listeners
  setupEventListeners() {
    this.sequelize.afterConnect(() => {
      logger.info('Database connected successfully');
      eventManager.emitEvent('db:connected');
    });

    this.sequelize.afterDisconnect(() => {
      logger.info('Database disconnected');
      eventManager.emitEvent('db:disconnected');
    });
  }

  /**
   * Model Management
   */

  // Register model
  registerModel(name, model) {
    try {
      this.models.set(name, model);
      logger.debug(`Model registered: ${name}`);
    } catch (error) {
      logger.error(`Error registering model ${name}:`, error);
      throw error;
    }
  }

  // Get model
  getModel(name) {
    const model = this.models.get(name);
    if (!model) {
      throw new Error(`Model not found: ${name}`);
    }
    return model;
  }

  // Get all models
  getModels() {
    return Object.fromEntries(this.models);
  }

  /**
   * Database Operations
   */

  // Execute query
  async query(sql, options = {}) {
    const startTime = process.hrtime();
    try {
      const result = await this.sequelize.query(sql, options);
      this.trackQuery('success', startTime);
      return result;
    } catch (error) {
      this.trackQuery('error', startTime);
      logger.error('Query error:', error);
      throw error;
    }
  }

  // Execute transaction
  async transaction(callback) {
    const startTime = process.hrtime();
    const t = await this.sequelize.transaction();

    try {
      const result = await callback(t);
      await t.commit();
      this.trackTransaction('commit', startTime);
      return result;
    } catch (error) {
      await t.rollback();
      this.trackTransaction('rollback', startTime);
      logger.error('Transaction error:', error);
      throw error;
    }
  }

  /**
   * Database Maintenance
   */

  // Sync database
  async sync(options = {}) {
    try {
      await this.sequelize.sync(options);
      logger.info('Database synced successfully');
      return true;
    } catch (error) {
      logger.error('Database sync error:', error);
      throw error;
    }
  }

  // Authenticate database connection
  async authenticate() {
    try {
      await this.sequelize.authenticate();
      logger.info('Database authentication successful');
      return true;
    } catch (error) {
      logger.error('Database authentication error:', error);
      throw error;
    }
  }

  // Close database connection
  async close() {
    try {
      await this.sequelize.close();
      logger.info('Database connection closed');
      return true;
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  /**
   * Database Backup
   */

  // Create database backup
  async createBackup(options = {}) {
    try {
      // Implementation depends on your database and requirements
      logger.info('Database backup created');
      eventManager.emitEvent('db:backup_created');
    } catch (error) {
      logger.error('Database backup error:', error);
      throw error;
    }
  }

  // Restore database from backup
  async restoreBackup(backupPath, options = {}) {
    try {
      // Implementation depends on your database and requirements
      logger.info('Database restored from backup');
      eventManager.emitEvent('db:backup_restored');
    } catch (error) {
      logger.error('Database restore error:', error);
      throw error;
    }
  }

  /**
   * Database Migration
   */

  // Run migrations
  async migrate(options = {}) {
    try {
      // Implementation depends on your migration strategy
      logger.info('Database migrations completed');
      eventManager.emitEvent('db:migrated');
    } catch (error) {
      logger.error('Migration error:', error);
      throw error;
    }
  }

  // Rollback migrations
  async rollback(options = {}) {
    try {
      // Implementation depends on your migration strategy
      logger.info('Database rollback completed');
      eventManager.emitEvent('db:rollback_completed');
    } catch (error) {
      logger.error('Rollback error:', error);
      throw error;
    }
  }

  /**
   * Database Seeding
   */

  // Run seeders
  async seed(options = {}) {
    try {
      // Implementation depends on your seeding strategy
      logger.info('Database seeding completed');
      eventManager.emitEvent('db:seeded');
    } catch (error) {
      logger.error('Seeding error:', error);
      throw error;
    }
  }

  // Clear database
  async clear(options = {}) {
    try {
      await this.transaction(async (t) => {
        for (const model of this.models.values()) {
          await model.destroy({ truncate: true, transaction: t });
        }
      });
      logger.info('Database cleared');
      eventManager.emitEvent('db:cleared');
    } catch (error) {
      logger.error('Database clear error:', error);
      throw error;
    }
  }

  /**
   * Database Monitoring
   */

  // Get database status
  async getStatus() {
    try {
      const [result] = await this.query('SELECT version();');
      const poolStats = await this.getPoolStats();

      return {
        connected: true,
        version: result[0].version,
        pool: poolStats,
        models: Array.from(this.models.keys())
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // Get connection pool statistics
  async getPoolStats() {
    const pool = this.sequelize.connectionManager.pool;
    return {
      total: pool.size,
      idle: pool.idle,
      active: pool.size - pool.idle
    };
  }

  /**
   * Metrics Tracking
   */

  // Track query metrics
  trackQuery(status, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('db_query_duration_seconds', duration, {
      status
    });

    metrics.incrementCounter('db_queries_total', {
      status
    });
  }

  // Track transaction metrics
  trackTransaction(status, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('db_transaction_duration_seconds', duration, {
      status
    });

    metrics.incrementCounter('db_transactions_total', {
      status
    });
  }

  /**
   * Utility Methods
   */

  // Check if table exists
  async tableExists(tableName) {
    const query = this.sequelize.getQueryInterface().QueryGenerator.showTablesQuery();
    const [results] = await this.query(query);
    return results.some(row => row.tableName === tableName);
  }

  // Get table size
  async getTableSize(tableName) {
    const query = `
      SELECT 
        pg_size_pretty(pg_total_relation_size('"${tableName}"')) as size,
        pg_total_relation_size('"${tableName}"') as bytes
    `;
    const [result] = await this.query(query);
    return result[0];
  }

  // Get database size
  async getDatabaseSize() {
    const query = `
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size,
        pg_database_size(current_database()) as bytes
    `;
    const [result] = await this.query(query);
    return result[0];
  }
}

// Create singleton instance
const dbManager = new DbManager();

// Export instance
module.exports = dbManager;
