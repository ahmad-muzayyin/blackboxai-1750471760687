const { performance, PerformanceObserver } = require('perf_hooks');
const os = require('os');
const v8 = require('v8');
const logger = require('./logger');
const metrics = require('./metrics');
const eventManager = require('./eventManager');
const config = require('./config');

class PerformanceMonitor {
  constructor() {
    this.measurements = new Map();
    this.thresholds = {
      cpu: 80, // 80% CPU usage
      memory: 85, // 85% memory usage
      responseTime: 1000, // 1 second
      heapUsage: 85 // 85% heap usage
    };
    this.initialize();
  }

  // Initialize performance monitor
  initialize() {
    try {
      this.setupPerformanceObserver();
      this.startSystemMonitoring();
      logger.info('Performance monitor initialized successfully');
    } catch (error) {
      logger.error('Performance monitor initialization error:', error);
      throw error;
    }
  }

  /**
   * Performance Measurement
   */

  // Start measuring performance
  startMeasure(name, labels = {}) {
    try {
      const mark = `${name}-${Date.now()}`;
      performance.mark(mark);
      this.measurements.set(mark, {
        name,
        labels,
        startTime: performance.now()
      });
      return mark;
    } catch (error) {
      logger.error('Error starting performance measure:', error);
      throw error;
    }
  }

  // End measuring performance
  endMeasure(mark) {
    try {
      const measurement = this.measurements.get(mark);
      if (!measurement) {
        throw new Error(`No measurement found for mark: ${mark}`);
      }

      const endTime = performance.now();
      const duration = endTime - measurement.startTime;

      // Track metrics
      metrics.trackPerformance(measurement.name, duration, measurement.labels);

      // Emit event if duration exceeds threshold
      if (duration > this.thresholds.responseTime) {
        eventManager.emitEvent('performance:threshold_exceeded', {
          type: 'response_time',
          name: measurement.name,
          duration,
          threshold: this.thresholds.responseTime,
          labels: measurement.labels
        });
      }

      this.measurements.delete(mark);
      return duration;
    } catch (error) {
      logger.error('Error ending performance measure:', error);
      throw error;
    }
  }

  // Setup performance observer
  setupPerformanceObserver() {
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        logger.debug('Performance entry:', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          entryType: entry.entryType
        });
      });
    });

    obs.observe({ entryTypes: ['measure', 'mark'] });
  }

  /**
   * System Monitoring
   */

  // Start system monitoring
  startSystemMonitoring() {
    const interval = config.get('performance.monitoringInterval') || 60000; // Default: 1 minute

    setInterval(() => {
      this.checkSystemMetrics();
    }, interval);
  }

  // Check system metrics
  async checkSystemMetrics() {
    try {
      const metrics = await this.getSystemMetrics();

      // Check CPU usage
      if (metrics.cpu.usage > this.thresholds.cpu) {
        this.handleThresholdExceeded('cpu', metrics.cpu.usage);
      }

      // Check memory usage
      if (metrics.memory.usagePercent > this.thresholds.memory) {
        this.handleThresholdExceeded('memory', metrics.memory.usagePercent);
      }

      // Check heap usage
      if (metrics.heap.usagePercent > this.thresholds.heapUsage) {
        this.handleThresholdExceeded('heap', metrics.heap.usagePercent);
      }

      // Track metrics
      this.trackSystemMetrics(metrics);
    } catch (error) {
      logger.error('Error checking system metrics:', error);
    }
  }

  // Get system metrics
  async getSystemMetrics() {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const heapUsage = this.getHeapUsage();
    const eventLoopLag = await this.getEventLoopLag();

    return {
      timestamp: new Date(),
      cpu: cpuUsage,
      memory: memoryUsage,
      heap: heapUsage,
      eventLoop: eventLoopLag
    };
  }

  // Get CPU usage
  async getCPUUsage() {
    const cpus = os.cpus();
    const totalCPU = cpus.reduce((acc, cpu) => {
      acc.total += Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      acc.idle += cpu.times.idle;
      return acc;
    }, { total: 0, idle: 0 });

    const usage = ((1 - totalCPU.idle / totalCPU.total) * 100).toFixed(2);

    return {
      usage: parseFloat(usage),
      cores: cpus.length,
      model: cpus[0].model,
      speed: cpus[0].speed
    };
  }

  // Get memory usage
  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = ((used / total) * 100).toFixed(2);

    return {
      total,
      free,
      used,
      usagePercent: parseFloat(usagePercent)
    };
  }

  // Get heap usage
  getHeapUsage() {
    const stats = v8.getHeapStatistics();
    const used = stats.used_heap_size;
    const total = stats.heap_size_limit;
    const usagePercent = ((used / total) * 100).toFixed(2);

    return {
      used,
      total,
      usagePercent: parseFloat(usagePercent),
      physical: stats.total_physical_size,
      available: stats.total_available_size
    };
  }

  // Get event loop lag
  async getEventLoopLag() {
    const start = Date.now();
    
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve({
          lag,
          isHealthy: lag < 100 // Consider unhealthy if lag > 100ms
        });
      });
    });
  }

  /**
   * Profiling
   */

  // Start CPU profiling
  async startCPUProfiling(duration = 30000) {
    try {
      const profiler = require('v8-profiler-next');
      const title = `cpu-profile-${Date.now()}`;

      profiler.startProfiling(title, true);

      return new Promise((resolve) => {
        setTimeout(() => {
          const profile = profiler.stopProfiling(title);
          profile.export((error, result) => {
            if (error) throw error;
            profile.delete();
            resolve(result);
          });
        }, duration);
      });
    } catch (error) {
      logger.error('Error starting CPU profiling:', error);
      throw error;
    }
  }

  // Start heap profiling
  async takeHeapSnapshot() {
    try {
      const profiler = require('v8-profiler-next');
      const snapshot = profiler.takeSnapshot();
      
      return new Promise((resolve) => {
        snapshot.export((error, result) => {
          if (error) throw error;
          snapshot.delete();
          resolve(result);
        });
      });
    } catch (error) {
      logger.error('Error taking heap snapshot:', error);
      throw error;
    }
  }

  /**
   * Event Handlers
   */

  // Handle threshold exceeded
  handleThresholdExceeded(type, value) {
    const event = {
      type,
      value,
      threshold: this.thresholds[type],
      timestamp: new Date()
    };

    logger.warn(`Performance threshold exceeded: ${type}`, event);
    eventManager.emitEvent('performance:threshold_exceeded', event);
  }

  // Track system metrics
  trackSystemMetrics(metrics) {
    try {
      // Track CPU usage
      this.trackMetric('cpu_usage', metrics.cpu.usage);

      // Track memory usage
      this.trackMetric('memory_usage', metrics.memory.usagePercent);
      this.trackMetric('memory_used', metrics.memory.used);

      // Track heap usage
      this.trackMetric('heap_usage', metrics.heap.usagePercent);
      this.trackMetric('heap_used', metrics.heap.used);

      // Track event loop lag
      this.trackMetric('event_loop_lag', metrics.eventLoop.lag);
    } catch (error) {
      logger.error('Error tracking system metrics:', error);
    }
  }

  // Track individual metric
  trackMetric(name, value, labels = {}) {
    metrics.trackGauge(`system_${name}`, value, labels);
  }

  /**
   * Utility Methods
   */

  // Format bytes to human readable format
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${Math.round(bytes / Math.pow(1024, i), 2)} ${sizes[i]}`;
  }

  // Format duration to human readable format
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export instance
module.exports = performanceMonitor;
