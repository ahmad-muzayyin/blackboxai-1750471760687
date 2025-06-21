const winston = require('winston');
const path = require('path');
const moment = require('moment');
const logger = require('./logger');
const config = require('./config');
const dbHandler = require('./dbHandler');
const eventManager = require('./eventManager');

class AuditLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs/audit');
    this.initialize();
  }

  // Initialize audit logger
  initialize() {
    try {
      // Create Winston logger instance for audit logs
      this.logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          // Write to audit log file
          new winston.transports.File({
            filename: path.join(this.logDir, 'audit.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
          }),
          // Also write to database if enabled
          ...(config.get('audit.saveToDatabase') ? [] : [])
        ]
      });

      // Add console transport in development
      if (config.isDevelopment()) {
        this.logger.add(new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }));
      }

      this.setupEventListeners();
      logger.info('Audit logger initialized successfully');
    } catch (error) {
      logger.error('Audit logger initialization error:', error);
      throw error;
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Authentication events
    eventManager.on('user:login', (data) => this.logAuthEvent('LOGIN', data));
    eventManager.on('user:logout', (data) => this.logAuthEvent('LOGOUT', data));
    eventManager.on('user:password_change', (data) => this.logAuthEvent('PASSWORD_CHANGE', data));

    // Data modification events
    eventManager.on('data:created', (data) => this.logDataEvent('CREATE', data));
    eventManager.on('data:updated', (data) => this.logDataEvent('UPDATE', data));
    eventManager.on('data:deleted', (data) => this.logDataEvent('DELETE', data));

    // Access control events
    eventManager.on('access:granted', (data) => this.logAccessEvent('GRANTED', data));
    eventManager.on('access:denied', (data) => this.logAccessEvent('DENIED', data));

    // System events
    eventManager.on('system:config_change', (data) => this.logSystemEvent('CONFIG_CHANGE', data));
    eventManager.on('system:backup', (data) => this.logSystemEvent('BACKUP', data));
    eventManager.on('system:restore', (data) => this.logSystemEvent('RESTORE', data));
  }

  /**
   * Audit Logging Methods
   */

  // Log authentication event
  async logAuthEvent(action, data) {
    try {
      const auditLog = {
        category: 'AUTHENTICATION',
        action,
        userId: data.userId,
        username: data.username,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status,
        details: {
          method: data.method,
          timestamp: new Date(),
          ...data.details
        }
      };

      await this.saveAuditLog(auditLog);
    } catch (error) {
      logger.error('Error logging auth event:', error);
    }
  }

  // Log data modification event
  async logDataEvent(action, data) {
    try {
      const auditLog = {
        category: 'DATA_MODIFICATION',
        action,
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        changes: data.changes,
        details: {
          timestamp: new Date(),
          previousState: data.previousState,
          newState: data.newState,
          ...data.details
        }
      };

      await this.saveAuditLog(auditLog);
    } catch (error) {
      logger.error('Error logging data event:', error);
    }
  }

  // Log access control event
  async logAccessEvent(action, data) {
    try {
      const auditLog = {
        category: 'ACCESS_CONTROL',
        action,
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        permission: data.permission,
        details: {
          timestamp: new Date(),
          reason: data.reason,
          ...data.details
        }
      };

      await this.saveAuditLog(auditLog);
    } catch (error) {
      logger.error('Error logging access event:', error);
    }
  }

  // Log system event
  async logSystemEvent(action, data) {
    try {
      const auditLog = {
        category: 'SYSTEM',
        action,
        userId: data.userId,
        details: {
          timestamp: new Date(),
          component: data.component,
          changes: data.changes,
          ...data.details
        }
      };

      await this.saveAuditLog(auditLog);
    } catch (error) {
      logger.error('Error logging system event:', error);
    }
  }

  /**
   * Audit Log Management
   */

  // Save audit log
  async saveAuditLog(logData) {
    try {
      // Write to Winston logger
      this.logger.info(logData);

      // Save to database if enabled
      if (config.get('audit.saveToDatabase')) {
        await dbHandler.models.AuditLog.create(logData);
      }
    } catch (error) {
      logger.error('Error saving audit log:', error);
      throw error;
    }
  }

  // Query audit logs
  async queryAuditLogs(query = {}) {
    try {
      const {
        startDate,
        endDate,
        category,
        action,
        userId,
        resourceType,
        resourceId,
        page = 1,
        limit = 50,
        sort = 'createdAt',
        order = 'DESC'
      } = query;

      const where = {};

      // Add date range
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[dbHandler.Sequelize.Op.gte] = startDate;
        if (endDate) where.createdAt[dbHandler.Sequelize.Op.lte] = endDate;
      }

      // Add other filters
      if (category) where.category = category;
      if (action) where.action = action;
      if (userId) where.userId = userId;
      if (resourceType) where.resourceType = resourceType;
      if (resourceId) where.resourceId = resourceId;

      const logs = await dbHandler.models.AuditLog.findAndCountAll({
        where,
        order: [[sort, order]],
        limit,
        offset: (page - 1) * limit
      });

      return {
        logs: logs.rows,
        total: logs.count,
        page,
        totalPages: Math.ceil(logs.count / limit)
      };
    } catch (error) {
      logger.error('Error querying audit logs:', error);
      throw error;
    }
  }

  // Get audit log statistics
  async getAuditStats(timeframe = 'daily') {
    try {
      const dateCondition = this.getTimeframeCondition(timeframe);

      const stats = await dbHandler.models.AuditLog.findAll({
        where: dateCondition,
        attributes: [
          'category',
          'action',
          [dbHandler.sequelize.fn('COUNT', '*'), 'count'],
          [dbHandler.sequelize.fn('DATE', dbHandler.sequelize.col('createdAt')), 'date']
        ],
        group: ['category', 'action', 'date'],
        raw: true
      });

      return this.formatAuditStats(stats, timeframe);
    } catch (error) {
      logger.error('Error getting audit stats:', error);
      throw error;
    }
  }

  // Clean old audit logs
  async cleanOldLogs(days = 90) {
    try {
      const cutoffDate = moment().subtract(days, 'days').toDate();

      // Clean database logs
      if (config.get('audit.saveToDatabase')) {
        await dbHandler.models.AuditLog.destroy({
          where: {
            createdAt: {
              [dbHandler.Sequelize.Op.lt]: cutoffDate
            }
          }
        });
      }

      // Archive file logs
      // TODO: Implement log file archiving

      logger.info(`Cleaned audit logs older than ${days} days`);
    } catch (error) {
      logger.error('Error cleaning audit logs:', error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */

  // Get timeframe condition for queries
  getTimeframeCondition(timeframe) {
    const now = moment();
    let startDate;

    switch (timeframe) {
      case 'hourly':
        startDate = moment().subtract(24, 'hours');
        break;
      case 'daily':
        startDate = moment().subtract(30, 'days');
        break;
      case 'weekly':
        startDate = moment().subtract(12, 'weeks');
        break;
      case 'monthly':
        startDate = moment().subtract(12, 'months');
        break;
      default:
        startDate = moment().subtract(30, 'days');
    }

    return {
      createdAt: {
        [dbHandler.Sequelize.Op.between]: [startDate.toDate(), now.toDate()]
      }
    };
  }

  // Format audit statistics
  formatAuditStats(stats, timeframe) {
    const formatted = {
      timeframe,
      total: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
      byCategory: {},
      byAction: {},
      byDate: {}
    };

    stats.forEach(stat => {
      // Group by category
      if (!formatted.byCategory[stat.category]) {
        formatted.byCategory[stat.category] = 0;
      }
      formatted.byCategory[stat.category] += parseInt(stat.count);

      // Group by action
      if (!formatted.byAction[stat.action]) {
        formatted.byAction[stat.action] = 0;
      }
      formatted.byAction[stat.action] += parseInt(stat.count);

      // Group by date
      const date = moment(stat.date).format('YYYY-MM-DD');
      if (!formatted.byDate[date]) {
        formatted.byDate[date] = {};
      }
      if (!formatted.byDate[date][stat.category]) {
        formatted.byDate[date][stat.category] = {};
      }
      formatted.byDate[date][stat.category][stat.action] = parseInt(stat.count);
    });

    return formatted;
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

// Export instance
module.exports = auditLogger;
