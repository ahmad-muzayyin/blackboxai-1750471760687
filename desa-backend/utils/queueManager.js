const Queue = require('bull');
const path = require('path');
const logger = require('./logger');
const config = require('./config');
const metrics = require('./metrics');
const eventManager = require('./eventManager');

class QueueManager {
  constructor() {
    this.queues = new Map();
    this.defaultOptions = {
      redis: {
        host: config.get('redis.host'),
        port: config.get('redis.port'),
        password: config.get('redis.password'),
        db: config.get('redis.db')
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    };

    this.initialize();
  }

  // Initialize queues
  initialize() {
    // Email queue
    this.createQueue('email', {
      processors: {
        'send-email': path.join(__dirname, '../jobs/emailProcessor.js')
      }
    });

    // Notification queue
    this.createQueue('notification', {
      processors: {
        'send-notification': path.join(__dirname, '../jobs/notificationProcessor.js')
      }
    });

    // Document processing queue
    this.createQueue('document', {
      processors: {
        'generate-pdf': path.join(__dirname, '../jobs/pdfProcessor.js'),
        'process-excel': path.join(__dirname, '../jobs/excelProcessor.js')
      }
    });

    // Backup queue
    this.createQueue('backup', {
      processors: {
        'create-backup': path.join(__dirname, '../jobs/backupProcessor.js')
      }
    });

    // Report generation queue
    this.createQueue('report', {
      processors: {
        'generate-report': path.join(__dirname, '../jobs/reportProcessor.js')
      }
    });

    logger.info('Queue manager initialized successfully');
  }

  // Create a new queue
  createQueue(name, options = {}) {
    try {
      const queue = new Queue(name, this.defaultOptions);

      // Register processors
      if (options.processors) {
        Object.entries(options.processors).forEach(([jobName, processorPath]) => {
          queue.process(jobName, processorPath);
        });
      }

      // Add event listeners
      this.addQueueEventListeners(queue);

      this.queues.set(name, queue);
      logger.info(`Queue '${name}' created successfully`);

      return queue;
    } catch (error) {
      logger.error(`Error creating queue '${name}':`, error);
      throw error;
    }
  }

  // Add event listeners to queue
  addQueueEventListeners(queue) {
    // Job completion
    queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed:`, { jobName: job.name, result });
      metrics.trackJobCompletion(queue.name, job.name, 'completed');
      eventManager.emitEvent('job:completed', { queue: queue.name, job });
    });

    // Job failure
    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed:`, { jobName: job.name, error });
      metrics.trackJobCompletion(queue.name, job.name, 'failed');
      eventManager.emitEvent('job:failed', { queue: queue.name, job, error });
    });

    // Queue errors
    queue.on('error', (error) => {
      logger.error(`Queue error in '${queue.name}':`, error);
      metrics.trackQueueError(queue.name);
    });

    // Stalled jobs
    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled:`, { jobName: job.name });
      metrics.trackJobCompletion(queue.name, job.name, 'stalled');
    });
  }

  // Add a job to a queue
  async addJob(queueName, jobName, data, options = {}) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue '${queueName}' not found`);
      }

      const job = await queue.add(jobName, data, {
        ...this.defaultOptions.defaultJobOptions,
        ...options
      });

      logger.info(`Job added to queue '${queueName}':`, {
        jobId: job.id,
        jobName,
        data
      });

      return job;
    } catch (error) {
      logger.error(`Error adding job to queue '${queueName}':`, error);
      throw error;
    }
  }

  // Get a queue by name
  getQueue(name) {
    return this.queues.get(name);
  }

  // Get all queues
  getAllQueues() {
    return Array.from(this.queues.values());
  }

  // Get queue status
  async getQueueStatus(name) {
    try {
      const queue = this.queues.get(name);
      if (!queue) {
        throw new Error(`Queue '${name}' not found`);
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);

      return {
        name,
        jobs: {
          waiting,
          active,
          completed,
          failed,
          delayed
        }
      };
    } catch (error) {
      logger.error(`Error getting queue status for '${name}':`, error);
      throw error;
    }
  }

  // Get all queues status
  async getAllQueuesStatus() {
    try {
      const statuses = await Promise.all(
        Array.from(this.queues.keys()).map(name => this.getQueueStatus(name))
      );

      return statuses;
    } catch (error) {
      logger.error('Error getting all queues status:', error);
      throw error;
    }
  }

  // Clean a queue
  async cleanQueue(name, grace = 24 * 3600 * 1000) { // 24 hours
    try {
      const queue = this.queues.get(name);
      if (!queue) {
        throw new Error(`Queue '${name}' not found`);
      }

      await queue.clean(grace, 'completed');
      await queue.clean(grace, 'failed');

      logger.info(`Queue '${name}' cleaned successfully`);
    } catch (error) {
      logger.error(`Error cleaning queue '${name}':`, error);
      throw error;
    }
  }

  // Clean all queues
  async cleanAllQueues(grace = 24 * 3600 * 1000) {
    try {
      await Promise.all(
        Array.from(this.queues.keys()).map(name => this.cleanQueue(name, grace))
      );

      logger.info('All queues cleaned successfully');
    } catch (error) {
      logger.error('Error cleaning all queues:', error);
      throw error;
    }
  }

  // Pause a queue
  async pauseQueue(name) {
    try {
      const queue = this.queues.get(name);
      if (!queue) {
        throw new Error(`Queue '${name}' not found`);
      }

      await queue.pause();
      logger.info(`Queue '${name}' paused successfully`);
    } catch (error) {
      logger.error(`Error pausing queue '${name}':`, error);
      throw error;
    }
  }

  // Resume a queue
  async resumeQueue(name) {
    try {
      const queue = this.queues.get(name);
      if (!queue) {
        throw new Error(`Queue '${name}' not found`);
      }

      await queue.resume();
      logger.info(`Queue '${name}' resumed successfully`);
    } catch (error) {
      logger.error(`Error resuming queue '${name}':`, error);
      throw error;
    }
  }

  // Close all queues
  async closeAll() {
    try {
      await Promise.all(
        Array.from(this.queues.values()).map(queue => queue.close())
      );

      logger.info('All queues closed successfully');
    } catch (error) {
      logger.error('Error closing queues:', error);
      throw error;
    }
  }
}

// Create singleton instance
const queueManager = new QueueManager();

// Export instance
module.exports = queueManager;
