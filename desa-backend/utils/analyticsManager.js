const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const cache = require('./cacheManager');
const dbManager = require('./dbManager');

class AnalyticsManager {
  constructor() {
    this.cache = new Map();
    this.aggregationPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
    this.initialize();
  }

  // Initialize analytics manager
  initialize() {
    try {
      this.setupMetrics();
      logger.info('Analytics manager initialized successfully');
    } catch (error) {
      logger.error('Analytics manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Analytics Setup
   */

  // Setup analytics metrics
  setupMetrics() {
    // User metrics
    metrics.createCounter('user_registrations_total', 'Total number of user registrations');
    metrics.createCounter('user_logins_total', 'Total number of user logins');
    metrics.createGauge('users_active', 'Number of active users');

    // Surat metrics
    metrics.createCounter('surat_requests_total', 'Total number of surat requests');
    metrics.createGauge('surat_processing_time_avg', 'Average surat processing time');
    metrics.createHistogram('surat_completion_time', 'Surat completion time distribution');

    // Bantuan Sosial metrics
    metrics.createCounter('bantuan_distributed_total', 'Total amount of bantuan distributed');
    metrics.createGauge('bantuan_recipients_active', 'Number of active bantuan recipients');
    metrics.createHistogram('bantuan_amount_distribution', 'Distribution of bantuan amounts');

    // System metrics
    metrics.createGauge('system_response_time_avg', 'Average system response time');
    metrics.createCounter('api_requests_total', 'Total number of API requests');
    metrics.createHistogram('api_latency', 'API latency distribution');
  }

  /**
   * Event Tracking
   */

  // Track user activity
  async trackUserActivity(userId, action, metadata = {}) {
    try {
      const event = {
        userId,
        action,
        metadata,
        timestamp: new Date()
      };

      await this.storeEvent('user_activity', event);
      this.updateUserMetrics(action);
    } catch (error) {
      logger.error('Error tracking user activity:', error);
    }
  }

  // Track surat request
  async trackSuratRequest(suratId, action, metadata = {}) {
    try {
      const event = {
        suratId,
        action,
        metadata,
        timestamp: new Date()
      };

      await this.storeEvent('surat_request', event);
      this.updateSuratMetrics(action);
    } catch (error) {
      logger.error('Error tracking surat request:', error);
    }
  }

  // Track bantuan distribution
  async trackBantuanDistribution(bantuanId, amount, metadata = {}) {
    try {
      const event = {
        bantuanId,
        amount,
        metadata,
        timestamp: new Date()
      };

      await this.storeEvent('bantuan_distribution', event);
      this.updateBantuanMetrics(amount);
    } catch (error) {
      logger.error('Error tracking bantuan distribution:', error);
    }
  }

  /**
   * Analytics Aggregation
   */

  // Aggregate user analytics
  async aggregateUserAnalytics(period = 'daily') {
    try {
      const timeframe = this.getTimeframe(period);
      const query = `
        SELECT 
          DATE_TRUNC('${period}', timestamp) as period,
          action,
          COUNT(*) as count
        FROM user_activity
        WHERE timestamp >= $1
        GROUP BY period, action
        ORDER BY period DESC
      `;

      const results = await dbManager.query(query, [timeframe]);
      await this.cacheResults(`user_analytics_${period}`, results);
      return results;
    } catch (error) {
      logger.error('Error aggregating user analytics:', error);
      throw error;
    }
  }

  // Aggregate surat analytics
  async aggregateSuratAnalytics(period = 'daily') {
    try {
      const timeframe = this.getTimeframe(period);
      const query = `
        SELECT 
          DATE_TRUNC('${period}', timestamp) as period,
          status,
          COUNT(*) as count,
          AVG(processing_time) as avg_processing_time
        FROM surat_requests
        WHERE timestamp >= $1
        GROUP BY period, status
        ORDER BY period DESC
      `;

      const results = await dbManager.query(query, [timeframe]);
      await this.cacheResults(`surat_analytics_${period}`, results);
      return results;
    } catch (error) {
      logger.error('Error aggregating surat analytics:', error);
      throw error;
    }
  }

  // Aggregate bantuan analytics
  async aggregateBantuanAnalytics(period = 'daily') {
    try {
      const timeframe = this.getTimeframe(period);
      const query = `
        SELECT 
          DATE_TRUNC('${period}', timestamp) as period,
          COUNT(*) as distribution_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM bantuan_distributions
        WHERE timestamp >= $1
        GROUP BY period
        ORDER BY period DESC
      `;

      const results = await dbManager.query(query, [timeframe]);
      await this.cacheResults(`bantuan_analytics_${period}`, results);
      return results;
    } catch (error) {
      logger.error('Error aggregating bantuan analytics:', error);
      throw error;
    }
  }

  /**
   * Report Generation
   */

  // Generate user report
  async generateUserReport(options = {}) {
    try {
      const data = {
        registrations: await this.aggregateUserAnalytics('monthly'),
        activity: await this.getUserActivityBreakdown(),
        demographics: await this.getUserDemographics()
      };

      return this.formatReport('user', data, options);
    } catch (error) {
      logger.error('Error generating user report:', error);
      throw error;
    }
  }

  // Generate surat report
  async generateSuratReport(options = {}) {
    try {
      const data = {
        requests: await this.aggregateSuratAnalytics('monthly'),
        types: await this.getSuratTypeBreakdown(),
        processing: await this.getSuratProcessingStats()
      };

      return this.formatReport('surat', data, options);
    } catch (error) {
      logger.error('Error generating surat report:', error);
      throw error;
    }
  }

  // Generate bantuan report
  async generateBantuanReport(options = {}) {
    try {
      const data = {
        distributions: await this.aggregateBantuanAnalytics('monthly'),
        programs: await this.getBantuanProgramStats(),
        recipients: await this.getBantuanRecipientStats()
      };

      return this.formatReport('bantuan', data, options);
    } catch (error) {
      logger.error('Error generating bantuan report:', error);
      throw error;
    }
  }

  /**
   * Data Analysis
   */

  // Get user activity breakdown
  async getUserActivityBreakdown() {
    try {
      const cacheKey = 'user_activity_breakdown';
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_activity
        GROUP BY action
      `;

      const results = await dbManager.query(query);
      await cache.set(cacheKey, results, 3600); // Cache for 1 hour
      return results;
    } catch (error) {
      logger.error('Error getting user activity breakdown:', error);
      throw error;
    }
  }

  // Get user demographics
  async getUserDemographics() {
    try {
      const cacheKey = 'user_demographics';
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          age_group,
          gender,
          COUNT(*) as count
        FROM users
        GROUP BY age_group, gender
      `;

      const results = await dbManager.query(query);
      await cache.set(cacheKey, results, 86400); // Cache for 24 hours
      return results;
    } catch (error) {
      logger.error('Error getting user demographics:', error);
      throw error;
    }
  }

  // Get surat type breakdown
  async getSuratTypeBreakdown() {
    try {
      const cacheKey = 'surat_type_breakdown';
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          jenis_surat,
          COUNT(*) as count,
          AVG(processing_time) as avg_processing_time
        FROM surat_requests
        GROUP BY jenis_surat
      `;

      const results = await dbManager.query(query);
      await cache.set(cacheKey, results, 3600); // Cache for 1 hour
      return results;
    } catch (error) {
      logger.error('Error getting surat type breakdown:', error);
      throw error;
    }
  }

  // Get bantuan program stats
  async getBantuanProgramStats() {
    try {
      const cacheKey = 'bantuan_program_stats';
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          program_name,
          COUNT(*) as distribution_count,
          SUM(amount) as total_amount,
          COUNT(DISTINCT recipient_id) as recipient_count
        FROM bantuan_distributions
        GROUP BY program_name
      `;

      const results = await dbManager.query(query);
      await cache.set(cacheKey, results, 3600); // Cache for 1 hour
      return results;
    } catch (error) {
      logger.error('Error getting bantuan program stats:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */

  // Store event
  async storeEvent(type, event) {
    try {
      const query = `
        INSERT INTO analytics_events (type, data)
        VALUES ($1, $2)
      `;
      await dbManager.query(query, [type, JSON.stringify(event)]);
    } catch (error) {
      logger.error('Error storing event:', error);
      throw error;
    }
  }

  // Update user metrics
  updateUserMetrics(action) {
    switch (action) {
      case 'register':
        metrics.incrementCounter('user_registrations_total');
        break;
      case 'login':
        metrics.incrementCounter('user_logins_total');
        break;
    }
  }

  // Update surat metrics
  updateSuratMetrics(action) {
    metrics.incrementCounter('surat_requests_total', { action });
  }

  // Update bantuan metrics
  updateBantuanMetrics(amount) {
    metrics.incrementCounter('bantuan_distributed_total');
    metrics.observeHistogram('bantuan_amount_distribution', amount);
  }

  // Get timeframe for period
  getTimeframe(period) {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.setDate(now.getDate() - 30)); // Last 30 days
      case 'weekly':
        return new Date(now.setDate(now.getDate() - 90)); // Last 90 days
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() - 12)); // Last 12 months
      case 'yearly':
        return new Date(now.setFullYear(now.getFullYear() - 5)); // Last 5 years
      default:
        throw new Error(`Invalid period: ${period}`);
    }
  }

  // Cache results
  async cacheResults(key, results) {
    await cache.set(key, results, 3600); // Cache for 1 hour
  }

  // Format report
  formatReport(type, data, options = {}) {
    const { format = 'json' } = options;

    switch (format) {
      case 'json':
        return data;
      case 'csv':
        return this.convertToCSV(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Convert data to CSV
  convertToCSV(data) {
    // Implementation depends on data structure
    return '';
  }
}

// Create singleton instance
const analyticsManager = new AnalyticsManager();

// Export instance
module.exports = analyticsManager;
