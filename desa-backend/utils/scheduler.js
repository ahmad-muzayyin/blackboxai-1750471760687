const cron = require('node-cron');
const logger = require('./logger');
const metrics = require('./metrics');
const config = require('./config');
const queueManager = require('./queueManager');
const eventManager = require('./eventManager');
const dbHandler = require('./dbHandler');

class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.initialize();
  }

  // Initialize scheduler
  initialize() {
    try {
      // Register scheduled tasks
      this.registerTasks();
      logger.info('Scheduler initialized successfully');
    } catch (error) {
      logger.error('Scheduler initialization error:', error);
      throw error;
    }
  }

  // Register all scheduled tasks
  registerTasks() {
    // Database backup task (daily at midnight)
    this.schedule('backup', '0 0 * * *', async () => {
      await queueManager.addJob('backup', 'create-backup', {
        timestamp: new Date(),
        type: 'daily'
      });
    });

    // Clean old logs task (weekly on Sunday at 1 AM)
    this.schedule('clean-logs', '0 1 * * 0', async () => {
      const retentionDays = config.get('logging.retentionDays') || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await queueManager.addJob('maintenance', 'clean-logs', {
        cutoffDate,
        retentionDays
      });
    });

    // Generate reports task (monthly on 1st at 2 AM)
    this.schedule('generate-reports', '0 2 1 * *', async () => {
      await queueManager.addJob('report', 'generate-report', {
        type: 'monthly',
        date: new Date()
      });
    });

    // Update statistics task (every hour)
    this.schedule('update-stats', '0 * * * *', async () => {
      await this.updateStatistics();
    });

    // Check expired documents task (daily at 3 AM)
    this.schedule('check-expired-docs', '0 3 * * *', async () => {
      await this.checkExpiredDocuments();
    });

    // Clean temporary files task (daily at 4 AM)
    this.schedule('clean-temp-files', '0 4 * * *', async () => {
      await queueManager.addJob('maintenance', 'clean-temp-files', {
        directory: config.get('upload.tempDir'),
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    });

    // Sync cache task (every 15 minutes)
    this.schedule('sync-cache', '*/15 * * * *', async () => {
      await this.syncCache();
    });

    // Monitor system health task (every 5 minutes)
    this.schedule('health-check', '*/5 * * * *', async () => {
      await this.checkSystemHealth();
    });
  }

  // Schedule a task
  schedule(name, cronExpression, callback) {
    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Create the task
      const task = cron.schedule(cronExpression, async () => {
        try {
          const startTime = process.hrtime();
          
          logger.info(`Starting scheduled task: ${name}`);
          await callback();
          
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const duration = seconds + nanoseconds / 1e9;
          
          metrics.trackScheduledTask(name, 'success', duration);
          logger.info(`Completed scheduled task: ${name}`);
          
          eventManager.emitEvent('task:completed', { name, duration });
        } catch (error) {
          logger.error(`Error in scheduled task ${name}:`, error);
          metrics.trackScheduledTask(name, 'error');
          eventManager.emitEvent('task:failed', { name, error });
        }
      });

      // Store the task
      this.tasks.set(name, task);
      logger.info(`Scheduled task registered: ${name} (${cronExpression})`);

    } catch (error) {
      logger.error(`Error scheduling task ${name}:`, error);
      throw error;
    }
  }

  // Update application statistics
  async updateStatistics() {
    try {
      const stats = await dbHandler.getStats();
      await queueManager.addJob('stats', 'update-stats', stats);
    } catch (error) {
      logger.error('Error updating statistics:', error);
      throw error;
    }
  }

  // Check for expired documents
  async checkExpiredDocuments() {
    try {
      const currentDate = new Date();
      
      // Check expired surat requests
      const expiredSurat = await dbHandler.rawQuery(`
        SELECT id FROM surat_requests 
        WHERE status = 'PENDING' 
        AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      if (expiredSurat.length > 0) {
        await queueManager.addJob('notification', 'send-notification', {
          type: 'EXPIRED_SURAT',
          data: { count: expiredSurat.length }
        });
      }

      // Check expired bantuan sosial
      const expiredBantuan = await dbHandler.rawQuery(`
        SELECT id FROM bantuan_sosial 
        WHERE status = 'AKTIF' 
        AND tanggal_selesai < NOW()
      `);

      if (expiredBantuan.length > 0) {
        await queueManager.addJob('notification', 'send-notification', {
          type: 'EXPIRED_BANTUAN',
          data: { count: expiredBantuan.length }
        });
      }
    } catch (error) {
      logger.error('Error checking expired documents:', error);
      throw error;
    }
  }

  // Sync cache with database
  async syncCache() {
    try {
      await queueManager.addJob('maintenance', 'sync-cache', {
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error syncing cache:', error);
      throw error;
    }
  }

  // Check system health
  async checkSystemHealth() {
    try {
      const health = {
        timestamp: new Date(),
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        queues: await this.checkQueuesHealth()
      };

      metrics.trackHealthCheck(health);
      eventManager.emitEvent('health:checked', health);

      if (!health.database || !health.redis) {
        logger.error('System health check failed:', health);
      }
    } catch (error) {
      logger.error('Error checking system health:', error);
      throw error;
    }
  }

  // Check database health
  async checkDatabaseHealth() {
    try {
      await dbHandler.testConnection();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  // Check Redis health
  async checkRedisHealth() {
    try {
      const redis = queueManager.getQueue('email').client;
      await redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Check queues health
  async checkQueuesHealth() {
    try {
      const queuesStatus = await queueManager.getAllQueuesStatus();
      return queuesStatus.every(status => 
        status.jobs.failed < (status.jobs.completed * 0.1) // Less than 10% failure rate
      );
    } catch (error) {
      logger.error('Queues health check failed:', error);
      return false;
    }
  }

  // Get task
  getTask(name) {
    return this.tasks.get(name);
  }

  // Get all tasks
  getAllTasks() {
    return Array.from(this.tasks.entries()).map(([name, task]) => ({
      name,
      running: task.running
    }));
  }

  // Start task
  startTask(name) {
    const task = this.tasks.get(name);
    if (task) {
      task.start();
      logger.info(`Task started: ${name}`);
    }
  }

  // Stop task
  stopTask(name) {
    const task = this.tasks.get(name);
    if (task) {
      task.stop();
      logger.info(`Task stopped: ${name}`);
    }
  }

  // Start all tasks
  startAllTasks() {
    this.tasks.forEach((task, name) => {
      task.start();
      logger.info(`Task started: ${name}`);
    });
  }

  // Stop all tasks
  stopAllTasks() {
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`Task stopped: ${name}`);
    });
  }

  // Destroy scheduler
  destroy() {
    this.stopAllTasks();
    this.tasks.clear();
    logger.info('Scheduler destroyed');
  }
}

// Create singleton instance
const scheduler = new Scheduler();

// Export instance
module.exports = scheduler;
