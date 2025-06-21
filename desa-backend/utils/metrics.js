const client = require('prom-client');
const logger = require('./logger');

class MetricsManager {
  constructor() {
    // Enable collection of default metrics
    this.register = new client.Registry();
    client.collectDefaultMetrics({ register: this.register });

    // Initialize custom metrics
    this.initializeMetrics();
  }

  // Initialize custom metrics
  initializeMetrics() {
    try {
      // HTTP request metrics
      this.httpRequestDuration = new client.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.5, 1, 2, 5]
      });

      // API endpoint usage counter
      this.apiEndpointCounter = new client.Counter({
        name: 'api_endpoints_total',
        help: 'Total number of API endpoint hits',
        labelNames: ['method', 'endpoint']
      });

      // Authentication metrics
      this.authenticationAttempts = new client.Counter({
        name: 'authentication_attempts_total',
        help: 'Total number of authentication attempts',
        labelNames: ['status']
      });

      // Database query metrics
      this.dbQueryDuration = new client.Histogram({
        name: 'db_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['operation', 'table'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1]
      });

      // Cache metrics
      this.cacheHits = new client.Counter({
        name: 'cache_hits_total',
        help: 'Total number of cache hits',
        labelNames: ['cache_type']
      });

      this.cacheMisses = new client.Counter({
        name: 'cache_misses_total',
        help: 'Total number of cache misses',
        labelNames: ['cache_type']
      });

      // File upload metrics
      this.fileUploadSize = new client.Histogram({
        name: 'file_upload_size_bytes',
        help: 'Size of uploaded files in bytes',
        labelNames: ['file_type'],
        buckets: [1000, 10000, 100000, 1000000, 5000000]
      });

      // Error metrics
      this.errorCounter = new client.Counter({
        name: 'application_errors_total',
        help: 'Total number of application errors',
        labelNames: ['error_type']
      });

      // Active users gauge
      this.activeUsers = new client.Gauge({
        name: 'active_users_total',
        help: 'Total number of active users'
      });

      // Request processing metrics
      this.requestProcessingTime = new client.Summary({
        name: 'request_processing_time_seconds',
        help: 'Time spent processing requests',
        labelNames: ['endpoint'],
        percentiles: [0.5, 0.9, 0.99]
      });

      // Register custom metrics
      this.register.registerMetric(this.httpRequestDuration);
      this.register.registerMetric(this.apiEndpointCounter);
      this.register.registerMetric(this.authenticationAttempts);
      this.register.registerMetric(this.dbQueryDuration);
      this.register.registerMetric(this.cacheHits);
      this.register.registerMetric(this.cacheMisses);
      this.register.registerMetric(this.fileUploadSize);
      this.register.registerMetric(this.errorCounter);
      this.register.registerMetric(this.activeUsers);
      this.register.registerMetric(this.requestProcessingTime);

    } catch (error) {
      logger.error('Error initializing metrics:', error);
    }
  }

  // Middleware for tracking HTTP requests
  trackHttpRequest() {
    return (req, res, next) => {
      const start = process.hrtime();

      res.on('finish', () => {
        const duration = process.hrtime(start);
        const durationSeconds = duration[0] + duration[1] / 1e9;

        this.httpRequestDuration.observe(
          {
            method: req.method,
            route: req.route?.path || req.path,
            status_code: res.statusCode
          },
          durationSeconds
        );

        this.apiEndpointCounter.inc({
          method: req.method,
          endpoint: req.route?.path || req.path
        });
      });

      next();
    };
  }

  // Track database query
  trackDbQuery(operation, table, duration) {
    this.dbQueryDuration.observe({ operation, table }, duration);
  }

  // Track cache operations
  trackCacheHit(cacheType) {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  trackCacheMiss(cacheType) {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  // Track file upload
  trackFileUpload(fileType, sizeInBytes) {
    this.fileUploadSize.observe({ file_type: fileType }, sizeInBytes);
  }

  // Track authentication attempts
  trackAuthentication(success) {
    this.authenticationAttempts.inc({ status: success ? 'success' : 'failure' });
  }

  // Track errors
  trackError(errorType) {
    this.errorCounter.inc({ error_type: errorType });
  }

  // Update active users
  updateActiveUsers(count) {
    this.activeUsers.set(count);
  }

  // Track request processing time
  trackRequestProcessing(endpoint, duration) {
    this.requestProcessingTime.observe({ endpoint }, duration);
  }

  // Get metrics in Prometheus format
  async getMetrics() {
    try {
      return await this.register.metrics();
    } catch (error) {
      logger.error('Error getting metrics:', error);
      throw error;
    }
  }

  // Reset all metrics
  async resetMetrics() {
    try {
      await this.register.resetMetrics();
      logger.info('Metrics reset successfully');
    } catch (error) {
      logger.error('Error resetting metrics:', error);
      throw error;
    }
  }

  // Get specific metric
  async getMetric(name) {
    try {
      return await this.register.getSingleMetric(name);
    } catch (error) {
      logger.error(`Error getting metric ${name}:`, error);
      throw error;
    }
  }

  // Remove specific metric
  removeMetric(name) {
    try {
      this.register.removeSingleMetric(name);
      logger.info(`Metric ${name} removed successfully`);
    } catch (error) {
      logger.error(`Error removing metric ${name}:`, error);
      throw error;
    }
  }

  // Clear all metrics
  clearMetrics() {
    try {
      this.register.clear();
      logger.info('All metrics cleared successfully');
    } catch (error) {
      logger.error('Error clearing metrics:', error);
      throw error;
    }
  }
}

// Create singleton instance
const metricsManager = new MetricsManager();

// Export instance
module.exports = metricsManager;
