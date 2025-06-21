const prometheus = require('prom-client');
const logger = require('./loggerManager');
const config = require('./configManager');
const eventManager = require('./eventManager');

class MetricsManager {
  constructor() {
    this.registry = null;
    this.metrics = new Map();
    this.defaultLabels = {};
    this.initialize();
  }

  // Initialize metrics manager
  initialize() {
    try {
      this.setupRegistry();
      this.setupDefaultMetrics();
      this.setupCustomMetrics();
      this.setupEventListeners();
      logger.info('Metrics manager initialized successfully');
    } catch (error) {
      logger.error('Metrics manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Registry Setup
   */

  // Setup metrics registry
  setupRegistry() {
    this.registry = new prometheus.Registry();
    
    // Set default labels
    this.defaultLabels = {
      app: config.get('app.name', 'desa-app'),
      environment: config.get('app.env', 'development')
    };
    
    this.registry.setDefaultLabels(this.defaultLabels);
  }

  // Setup default metrics
  setupDefaultMetrics() {
    prometheus.collectDefaultMetrics({
      register: this.registry,
      prefix: 'desa_'
    });
  }

  // Setup custom metrics
  setupCustomMetrics() {
    // HTTP metrics
    this.createCounter('http_requests_total', 'Total number of HTTP requests', ['method', 'path', 'status']);
    this.createHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', ['method', 'path']);
    this.createGauge('http_requests_in_progress', 'Number of HTTP requests in progress', ['method']);

    // Database metrics
    this.createHistogram('db_query_duration_seconds', 'Database query duration in seconds', ['operation', 'table']);
    this.createCounter('db_errors_total', 'Total number of database errors', ['operation', 'error']);
    this.createGauge('db_connections_active', 'Number of active database connections');

    // Cache metrics
    this.createCounter('cache_operations_total', 'Total number of cache operations', ['operation', 'status']);
    this.createHistogram('cache_operation_duration_seconds', 'Cache operation duration in seconds', ['operation']);
    this.createGauge('cache_size_bytes', 'Current cache size in bytes');

    // Business metrics
    this.createCounter('surat_requests_total', 'Total number of surat requests', ['type', 'status']);
    this.createCounter('bantuan_distributed_total', 'Total amount of bantuan distributed', ['program']);
    this.createGauge('active_users', 'Number of active users', ['role']);

    // System metrics
    this.createGauge('system_memory_usage_bytes', 'System memory usage in bytes');
    this.createGauge('system_cpu_usage_percent', 'System CPU usage percentage');
    this.createGauge('system_disk_usage_bytes', 'System disk usage in bytes');
  }

  // Setup event listeners
  setupEventListeners() {
    // HTTP events
    eventManager.on('http:request', this.handleHttpRequest.bind(this));
    eventManager.on('http:error', this.handleHttpError.bind(this));

    // Database events
    eventManager.on('db:query', this.handleDbQuery.bind(this));
    eventManager.on('db:error', this.handleDbError.bind(this));

    // Cache events
    eventManager.on('cache:operation', this.handleCacheOperation.bind(this));
    eventManager.on('cache:error', this.handleCacheError.bind(this));

    // Business events
    eventManager.on('surat:created', this.handleSuratCreated.bind(this));
    eventManager.on('bantuan:distributed', this.handleBantuanDistributed.bind(this));
    eventManager.on('user:activity', this.handleUserActivity.bind(this));
  }

  /**
   * Metric Creation
   */

  // Create counter
  createCounter(name, help, labels = []) {
    const counter = new prometheus.Counter({
      name: `desa_${name}`,
      help,
      labelNames: labels,
      registers: [this.registry]
    });
    this.metrics.set(name, counter);
    return counter;
  }

  // Create gauge
  createGauge(name, help, labels = []) {
    const gauge = new prometheus.Gauge({
      name: `desa_${name}`,
      help,
      labelNames: labels,
      registers: [this.registry]
    });
    this.metrics.set(name, gauge);
    return gauge;
  }

  // Create histogram
  createHistogram(name, help, labels = [], buckets = null) {
    const histogram = new prometheus.Histogram({
      name: `desa_${name}`,
      help,
      labelNames: labels,
      buckets: buckets || prometheus.linearBuckets(0.1, 0.1, 10),
      registers: [this.registry]
    });
    this.metrics.set(name, histogram);
    return histogram;
  }

  // Create summary
  createSummary(name, help, labels = [], percentiles = null) {
    const summary = new prometheus.Summary({
      name: `desa_${name}`,
      help,
      labelNames: labels,
      percentiles: percentiles || [0.01, 0.05, 0.5, 0.9, 0.95, 0.99],
      registers: [this.registry]
    });
    this.metrics.set(name, summary);
    return summary;
  }

  /**
   * Metric Operations
   */

  // Increment counter
  incrementCounter(name, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric instanceof prometheus.Counter) {
      metric.inc(labels);
    }
  }

  // Set gauge value
  setGauge(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric instanceof prometheus.Gauge) {
      metric.set(labels, value);
    }
  }

  // Observe histogram value
  observeHistogram(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric instanceof prometheus.Histogram) {
      metric.observe(labels, value);
    }
  }

  // Observe summary value
  observeSummary(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric instanceof prometheus.Summary) {
      metric.observe(labels, value);
    }
  }

  /**
   * Event Handlers
   */

  // Handle HTTP request
  handleHttpRequest(data) {
    this.incrementCounter('http_requests_total', {
      method: data.method,
      path: data.path,
      status: data.status
    });

    this.observeHistogram('http_request_duration_seconds', data.duration, {
      method: data.method,
      path: data.path
    });
  }

  // Handle HTTP error
  handleHttpError(data) {
    this.incrementCounter('http_errors_total', {
      method: data.method,
      path: data.path,
      error: data.error
    });
  }

  // Handle database query
  handleDbQuery(data) {
    this.observeHistogram('db_query_duration_seconds', data.duration, {
      operation: data.operation,
      table: data.table
    });
  }

  // Handle database error
  handleDbError(data) {
    this.incrementCounter('db_errors_total', {
      operation: data.operation,
      error: data.error
    });
  }

  // Handle cache operation
  handleCacheOperation(data) {
    this.incrementCounter('cache_operations_total', {
      operation: data.operation,
      status: data.status
    });

    this.observeHistogram('cache_operation_duration_seconds', data.duration, {
      operation: data.operation
    });
  }

  // Handle cache error
  handleCacheError(data) {
    this.incrementCounter('cache_errors_total', {
      operation: data.operation,
      error: data.error
    });
  }

  // Handle surat created
  handleSuratCreated(data) {
    this.incrementCounter('surat_requests_total', {
      type: data.type,
      status: 'created'
    });
  }

  // Handle bantuan distributed
  handleBantuanDistributed(data) {
    this.incrementCounter('bantuan_distributed_total', {
      program: data.program
    });
  }

  // Handle user activity
  handleUserActivity(data) {
    this.setGauge('active_users', data.count, {
      role: data.role
    });
  }

  /**
   * System Metrics
   */

  // Update system metrics
  async updateSystemMetrics() {
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.setGauge('system_memory_usage_bytes', memoryUsage.heapUsed);

      // CPU usage
      const cpuUsage = process.cpuUsage();
      this.setGauge('system_cpu_usage_percent', cpuUsage.user / 1000000);

      // Disk usage (implementation depends on your environment)
      // this.setGauge('system_disk_usage_bytes', diskUsage);
    } catch (error) {
      logger.error('Error updating system metrics:', error);
    }
  }

  /**
   * Metric Collection
   */

  // Get all metrics
  async getMetrics() {
    try {
      return await this.registry.metrics();
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      throw error;
    }
  }

  // Get specific metric
  getMetric(name) {
    return this.metrics.get(name);
  }

  // Clear all metrics
  clearMetrics() {
    this.registry.clear();
  }

  /**
   * Utility Methods
   */

  // Calculate rate
  calculateRate(count, duration) {
    return count / duration;
  }

  // Format bytes
  formatBytes(bytes) {
    return bytes / 1024 / 1024; // Convert to MB
  }

  // Format duration
  formatDuration(seconds) {
    return Math.round(seconds * 1000) / 1000;
  }
}

// Create singleton instance
const metricsManager = new MetricsManager();

// Export instance
module.exports = metricsManager;
