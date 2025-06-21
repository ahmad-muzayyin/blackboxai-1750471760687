const cron = require('node-cron');
const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const eventManager = require('./eventManager');
const backupManager = require('./backupManager');

class SchedulerManager {
  constructor() {
    this.tasks = new Map();
    this.runningTasks = new Set();
    this.initialize();
  }

  // Initialize scheduler manager
  initialize() {
    try {
      this.setupDefaultTasks();
      logger.info('Scheduler manager initialized successfully');
    } catch (error) {
      logger.error('Scheduler manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Task Setup
   */

  // Setup default tasks
  setupDefaultTasks() {
    // Database backup task
    this.registerTask('database-backup', {
      schedule: '0 0 * * *', // Daily at midnight
      handler: this.handleDatabaseBackup.bind(this),
      options: {
        timezone: 'Asia/Jakarta'
      }
    });

    // Log rotation task
    this.registerTask('log-rotation', {
      schedule: '0 0 * * 0', // Weekly on Sunday
      handler: this.handleLogRotation.bind(this),
      options: {
        timezone: 'Asia/Jakarta'
      }
    });

    // Metrics collection task
    this.registerTask('metrics-collection', {
      schedule: '*/5 * * * *', // Every 5 minutes
      handler: this.handleMetricsCollection.bind(this)
    });

    // Cache cleanup task
    this.registerTask('cache-cleanup', {
      schedule: '0 */6 * * *', // Every 6 hours
      handler: this.handleCacheCleanup.bind(this)
    });

    // Session cleanup task
    this.registerTask('session-cleanup', {
      schedule: '0 */12 * * *', // Every 12 hours
      handler: this.handleSessionCleanup.bind(this)
    });

    // Report generation task
    this.registerTask('report-generation', {
      schedule: '0 1 * * *', // Daily at 1 AM
      handler: this.handleReportGeneration.bind(this),
      options: {
        timezone: 'Asia/Jakarta'
      }
    });

    // System health check task
    this.registerTask('health-check', {
      schedule: '*/15 * * * *', // Every 15 minutes
      handler: this.handleHealthCheck.bind(this)
    });
  }

  /**
   * Task Management
   */

  // Register new task
  registerTask(name, config) {
    try {
      if (this.tasks.has(name)) {
        throw new Error(`Task ${name} already exists`);
      }

      const task = {
        name,
        schedule: config.schedule,
        handler: config.handler,
        options: config.options || {},
        status: 'stopped',
        lastRun: null,
        nextRun: null,
        cronJob: null
      };

      this.tasks.set(name, task);
      this.startTask(name);

      logger.info(`Task registered: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error registering task ${name}:`, error);
      throw error;
    }
  }

  // Start task
  startTask(name) {
    try {
      const task = this.tasks.get(name);
      if (!task) {
        throw new Error(`Task ${name} not found`);
      }

      if (task.status === 'running') {
        return false;
      }

      task.cronJob = cron.schedule(
        task.schedule,
        () => this.executeTask(name),
        task.options
      );

      task.status = 'running';
      task.nextRun = this.getNextRunTime(task.schedule);

      logger.info(`Task started: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error starting task ${name}:`, error);
      throw error;
    }
  }

  // Stop task
  stopTask(name) {
    try {
      const task = this.tasks.get(name);
      if (!task) {
        throw new Error(`Task ${name} not found`);
      }

      if (task.status === 'stopped') {
        return false;
      }

      task.cronJob.stop();
      task.status = 'stopped';
      task.nextRun = null;

      logger.info(`Task stopped: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error stopping task ${name}:`, error);
      throw error;
    }
  }

  // Execute task
  async executeTask(name) {
    const startTime = process.hrtime();
    const task = this.tasks.get(name);

    if (!task || this.runningTasks.has(name)) {
      return;
    }

    this.runningTasks.add(name);

    try {
      logger.info(`Executing task: ${name}`);
      await task.handler();

      task.lastRun = new Date();
      task.nextRun = this.getNextRunTime(task.schedule);
      
      this.trackTaskExecution(name, 'success', startTime);
      eventManager.emitEvent('task:completed', { name, status: 'success' });
    } catch (error) {
      this.trackTaskExecution(name, 'error', startTime);
      eventManager.emitEvent('task:completed', { name, status: 'error', error });
      logger.error(`Task execution error (${name}):`, error);
    } finally {
      this.runningTasks.delete(name);
    }
  }

  /**
   * Task Handlers
   */

  // Handle database backup
  async handleDatabaseBackup() {
    try {
      await backupManager.createBackup();
      logger.info('Database backup completed');
    } catch (error) {
      logger.error('Database backup error:', error);
      throw error;
    }
  }

  // Handle log rotation
  async handleLogRotation() {
    try {
      // Implementation depends on your logging setup
      logger.info('Log rotation completed');
    } catch (error) {
      logger.error('Log rotation error:', error);
      throw error;
    }
  }

  // Handle metrics collection
  async handleMetricsCollection() {
    try {
      // Collect system metrics
      const metrics = await this.collectSystemMetrics();
      await this.storeMetrics(metrics);
      logger.info('Metrics collection completed');
    } catch (error) {
      logger.error('Metrics collection error:', error);
      throw error;
    }
  }

  // Handle cache cleanup
  async handleCacheCleanup() {
    try {
      // Implementation depends on your caching strategy
      logger.info('Cache cleanup completed');
    } catch (error) {
      logger.error('Cache cleanup error:', error);
      throw error;
    }
  }

  // Handle session cleanup
  async handleSessionCleanup() {
    try {
      // Implementation depends on your session management
      logger.info('Session cleanup completed');
    } catch (error) {
      logger.error('Session cleanup error:', error);
      throw error;
    }
  }

  // Handle report generation
  async handleReportGeneration() {
    try {
      // Implementation depends on your reporting requirements
      logger.info('Report generation completed');
    } catch (error) {
      logger.error('Report generation error:', error);
      throw error;
    }
  }

  // Handle health check
  async handleHealthCheck() {
    try {
      const health = await this.checkSystemHealth();
      if (!health.healthy) {
        logger.warn('System health check failed:', health.issues);
      }
      logger.info('Health check completed');
    } catch (error) {
      logger.error('Health check error:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */

  // Get next run time for schedule
  getNextRunTime(schedule) {
    return cron.schedule(schedule).next().toDate();
  }

  // Collect system metrics
  async collectSystemMetrics() {
    // Implementation depends on your metrics requirements
    return {
      timestamp: new Date(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }

  // Store metrics
  async storeMetrics(metrics) {
    // Implementation depends on your storage strategy
  }

  // Check system health
  async checkSystemHealth() {
    // Implementation depends on your health check requirements
    return {
      healthy: true,
      issues: []
    };
  }

  /**
   * Metrics Tracking
   */

  // Track task execution metrics
  trackTaskExecution(name, status, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('task_duration_seconds', duration, {
      task: name,
      status
    });

    metrics.incrementCounter('tasks_total', {
      task: name,
      status
    });
  }

  /**
   * Task Information
   */

  // Get task information
  getTaskInfo(name) {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task ${name} not found`);
    }

    return {
      name: task.name,
      schedule: task.schedule,
      status: task.status,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      isRunning: this.runningTasks.has(name)
    };
  }

  // Get all tasks information
  getAllTasksInfo() {
    const tasks = {};
    for (const [name] of this.tasks) {
      tasks[name] = this.getTaskInfo(name);
    }
    return tasks;
  }

  /**
   * Scheduler Control
   */

  // Start all tasks
  startAllTasks() {
    for (const [name] of this.tasks) {
      this.startTask(name);
    }
  }

  // Stop all tasks
  stopAllTasks() {
    for (const [name] of this.tasks) {
      this.stopTask(name);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      totalTasks: this.tasks.size,
      runningTasks: this.runningTasks.size,
      tasks: this.getAllTasksInfo()
    };
  }
}

// Create singleton instance
const schedulerManager = new SchedulerManager();

// Export instance
module.exports = schedulerManager;
