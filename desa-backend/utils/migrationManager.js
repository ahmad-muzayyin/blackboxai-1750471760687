const path = require('path');
const fs = require('fs').promises;
const { Sequelize } = require('sequelize');
const logger = require('./logger');
const config = require('./config');
const dbHandler = require('./dbHandler');
const eventManager = require('./eventManager');

class MigrationManager {
  constructor() {
    this.sequelize = dbHandler.sequelize;
    this.queryInterface = this.sequelize.getQueryInterface();
    this.migrationsPath = path.join(__dirname, '../migrations');
    this.migrationsTable = 'SequelizeMeta';
  }

  // Initialize migration system
  async initialize() {
    try {
      // Create migrations directory if it doesn't exist
      await fs.mkdir(this.migrationsPath, { recursive: true });

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      logger.info('Migration manager initialized successfully');
    } catch (error) {
      logger.error('Migration manager initialization error:', error);
      throw error;
    }
  }

  // Create migrations table
  async createMigrationsTable() {
    try {
      await this.queryInterface.createTable(this.migrationsTable, {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          primaryKey: true
        },
        executedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    } catch (error) {
      // Table might already exist
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  // Generate migration file
  async generateMigration(name) {
    try {
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
      const filename = `${timestamp}-${name}.js`;
      const filepath = path.join(this.migrationsPath, filename);

      const template = this.getMigrationTemplate(name);

      await fs.writeFile(filepath, template);
      logger.info(`Generated migration: ${filename}`);

      return filename;
    } catch (error) {
      logger.error('Error generating migration:', error);
      throw error;
    }
  }

  // Get migration template
  getMigrationTemplate(name) {
    return `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add migration logic here
      
    } catch (error) {
      console.error('Migration up error:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Add rollback logic here
      
    } catch (error) {
      console.error('Migration down error:', error);
      throw error;
    }
  }
};
`;
  }

  // Get all migrations
  async getMigrations() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files.filter(file => file.endsWith('.js'));
    } catch (error) {
      logger.error('Error getting migrations:', error);
      throw error;
    }
  }

  // Get executed migrations
  async getExecutedMigrations() {
    try {
      const [results] = await this.sequelize.query(
        `SELECT name FROM "${this.migrationsTable}" ORDER BY name ASC`
      );
      return results.map(result => result.name);
    } catch (error) {
      logger.error('Error getting executed migrations:', error);
      throw error;
    }
  }

  // Get pending migrations
  async getPendingMigrations() {
    try {
      const allMigrations = await this.getMigrations();
      const executedMigrations = await this.getExecutedMigrations();
      return allMigrations.filter(migration => !executedMigrations.includes(migration));
    } catch (error) {
      logger.error('Error getting pending migrations:', error);
      throw error;
    }
  }

  // Run migrations
  async runMigrations(options = {}) {
    const transaction = await this.sequelize.transaction();

    try {
      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return [];
      }

      const results = [];

      for (const migrationFile of pendingMigrations) {
        const migration = require(path.join(this.migrationsPath, migrationFile));

        logger.info(`Running migration: ${migrationFile}`);
        const startTime = process.hrtime();

        await migration.up(this.queryInterface, Sequelize);
        await this.markMigrationAsExecuted(migrationFile, transaction);

        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds + nanoseconds / 1e9;

        results.push({
          name: migrationFile,
          duration: `${duration.toFixed(3)}s`
        });

        eventManager.emitEvent('migration:executed', {
          file: migrationFile,
          duration
        });
      }

      await transaction.commit();
      logger.info('Migrations completed successfully');

      return results;
    } catch (error) {
      await transaction.rollback();
      logger.error('Migration error:', error);
      throw error;
    }
  }

  // Rollback migrations
  async rollbackMigrations(steps = 1) {
    const transaction = await this.sequelize.transaction();

    try {
      const executedMigrations = await this.getExecutedMigrations();
      const migrationsToRollback = executedMigrations.slice(-steps);

      if (migrationsToRollback.length === 0) {
        logger.info('No migrations to rollback');
        return [];
      }

      const results = [];

      for (const migrationFile of migrationsToRollback.reverse()) {
        const migration = require(path.join(this.migrationsPath, migrationFile));

        logger.info(`Rolling back migration: ${migrationFile}`);
        const startTime = process.hrtime();

        await migration.down(this.queryInterface, Sequelize);
        await this.markMigrationAsReverted(migrationFile, transaction);

        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds + nanoseconds / 1e9;

        results.push({
          name: migrationFile,
          duration: `${duration.toFixed(3)}s`
        });

        eventManager.emitEvent('migration:reverted', {
          file: migrationFile,
          duration
        });
      }

      await transaction.commit();
      logger.info('Rollback completed successfully');

      return results;
    } catch (error) {
      await transaction.rollback();
      logger.error('Rollback error:', error);
      throw error;
    }
  }

  // Mark migration as executed
  async markMigrationAsExecuted(name, transaction) {
    await this.sequelize.query(
      `INSERT INTO "${this.migrationsTable}" (name) VALUES (:name)`,
      {
        replacements: { name },
        transaction
      }
    );
  }

  // Mark migration as reverted
  async markMigrationAsReverted(name, transaction) {
    await this.sequelize.query(
      `DELETE FROM "${this.migrationsTable}" WHERE name = :name`,
      {
        replacements: { name },
        transaction
      }
    );
  }

  // Reset database
  async resetDatabase() {
    if (!config.isDevelopment()) {
      throw new Error('Database reset only allowed in development environment');
    }

    try {
      logger.info('Resetting database...');

      // Drop all tables
      await this.sequelize.drop({ cascade: true });

      // Recreate migrations table
      await this.createMigrationsTable();

      // Run all migrations
      await this.runMigrations();

      logger.info('Database reset completed successfully');
    } catch (error) {
      logger.error('Database reset error:', error);
      throw error;
    }
  }

  // Get migration status
  async getMigrationStatus() {
    try {
      const allMigrations = await this.getMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      return allMigrations.map(migration => ({
        name: migration,
        status: executedMigrations.includes(migration) ? 'executed' : 'pending'
      }));
    } catch (error) {
      logger.error('Error getting migration status:', error);
      throw error;
    }
  }
}

// Create singleton instance
const migrationManager = new MigrationManager();

// Export instance
module.exports = migrationManager;
