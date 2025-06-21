const nodemailer = require('nodemailer');
const twilio = require('twilio');
const logger = require('./loggerManager');
const config = require('./configManager');
const i18n = require('./i18nManager');
const cache = require('./cacheManager');
const metrics = require('./metricsManager');
const eventManager = require('./eventManager');
const { ValidationError } = require('./errorManager');

class NotificationManager {
  constructor() {
    this.emailTransporter = null;
    this.smsClient = null;
    this.notificationQueue = [];
    this.initialize();
  }

  // Initialize notification manager
  initialize() {
    try {
      this.setupEmailTransporter();
      this.setupSMSClient();
      this.setupTemplates();
      logger.info('Notification manager initialized successfully');
    } catch (error) {
      logger.error('Notification manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Setup Methods
   */

  // Setup email transporter
  setupEmailTransporter() {
    const emailConfig = config.get('email');

    this.emailTransporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password
      }
    });
  }

  // Setup SMS client
  setupSMSClient() {
    const smsConfig = config.get('sms');

    if (smsConfig.enabled) {
      this.smsClient = twilio(
        smsConfig.accountSid,
        smsConfig.authToken
      );
    }
  }

  // Setup notification templates
  setupTemplates() {
    this.templates = {
      // User related notifications
      userWelcome: {
        email: {
          subject: 'Selamat Datang di Sistem Desa',
          template: 'welcome'
        }
      },
      passwordReset: {
        email: {
          subject: 'Reset Password',
          template: 'password-reset'
        }
      },

      // Surat related notifications
      suratSubmitted: {
        email: {
          subject: 'Pengajuan Surat Diterima',
          template: 'surat-submitted'
        },
        sms: {
          template: 'surat-submitted'
        }
      },
      suratApproved: {
        email: {
          subject: 'Surat Disetujui',
          template: 'surat-approved'
        },
        sms: {
          template: 'surat-approved'
        }
      },
      suratRejected: {
        email: {
          subject: 'Surat Ditolak',
          template: 'surat-rejected'
        },
        sms: {
          template: 'surat-rejected'
        }
      },

      // Bantuan Sosial related notifications
      bantuanApproved: {
        email: {
          subject: 'Bantuan Sosial Disetujui',
          template: 'bantuan-approved'
        },
        sms: {
          template: 'bantuan-approved'
        }
      },
      bantuanDistributed: {
        email: {
          subject: 'Bantuan Sosial Telah Disalurkan',
          template: 'bantuan-distributed'
        },
        sms: {
          template: 'bantuan-distributed'
        }
      }
    };
  }

  /**
   * Email Notifications
   */

  // Send email
  async sendEmail(to, subject, content, options = {}) {
    try {
      const startTime = process.hrtime();

      const mailOptions = {
        from: config.get('email.from'),
        to,
        subject,
        ...this.getEmailContent(content),
        ...options
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      
      this.trackNotification('email', 'success', startTime);
      return info;
    } catch (error) {
      this.trackNotification('email', 'error');
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  // Send template email
  async sendTemplateEmail(to, templateName, data = {}, options = {}) {
    try {
      const template = this.getTemplate(templateName, 'email');
      if (!template) {
        throw new ValidationError(`Email template ${templateName} not found`);
      }

      const content = await this.renderTemplate(template.template, data, 'email');
      return await this.sendEmail(to, template.subject, content, options);
    } catch (error) {
      logger.error(`Error sending template email ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * SMS Notifications
   */

  // Send SMS
  async sendSMS(to, message, options = {}) {
    try {
      if (!this.smsClient) {
        throw new Error('SMS client not configured');
      }

      const startTime = process.hrtime();

      const smsOptions = {
        to,
        from: config.get('sms.from'),
        body: message,
        ...options
      };

      const response = await this.smsClient.messages.create(smsOptions);
      
      this.trackNotification('sms', 'success', startTime);
      return response;
    } catch (error) {
      this.trackNotification('sms', 'error');
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }

  // Send template SMS
  async sendTemplateSMS(to, templateName, data = {}, options = {}) {
    try {
      const template = this.getTemplate(templateName, 'sms');
      if (!template) {
        throw new ValidationError(`SMS template ${templateName} not found`);
      }

      const message = await this.renderTemplate(template.template, data, 'sms');
      return await this.sendSMS(to, message, options);
    } catch (error) {
      logger.error(`Error sending template SMS ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * In-App Notifications
   */

  // Send in-app notification
  async sendInAppNotification(userId, notification) {
    try {
      const startTime = process.hrtime();

      // Store notification in database
      const stored = await this.storeNotification(userId, notification);

      // Emit websocket event
      eventManager.emitEvent('notification:created', {
        userId,
        notification: stored
      });

      this.trackNotification('in-app', 'success', startTime);
      return stored;
    } catch (error) {
      this.trackNotification('in-app', 'error');
      logger.error('Error sending in-app notification:', error);
      throw error;
    }
  }

  // Store notification
  async storeNotification(userId, notification) {
    // Implementation depends on your database schema
    // This is just an example
    const stored = {
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: false,
      createdAt: new Date()
    };

    // Store in database
    // await NotificationModel.create(stored);

    return stored;
  }

  /**
   * Bulk Notifications
   */

  // Send bulk emails
  async sendBulkEmails(recipients, subject, content, options = {}) {
    const results = await Promise.allSettled(
      recipients.map(recipient =>
        this.sendEmail(recipient, subject, content, options)
      )
    );

    return this.processBulkResults(results);
  }

  // Send bulk SMS
  async sendBulkSMS(recipients, message, options = {}) {
    const results = await Promise.allSettled(
      recipients.map(recipient =>
        this.sendSMS(recipient, message, options)
      )
    );

    return this.processBulkResults(results);
  }

  /**
   * Template Management
   */

  // Get template
  getTemplate(name, type) {
    const template = this.templates[name];
    return template ? template[type] : null;
  }

  // Render template
  async renderTemplate(templateName, data, type) {
    try {
      const cacheKey = `template:${type}:${templateName}`;
      const template = await cache.remember(cacheKey, 3600, async () => {
        // Load template from file system or database
        // This is just an example
        return `Template content for ${templateName}`;
      });

      return this.replaceTemplateVariables(template, data);
    } catch (error) {
      logger.error(`Error rendering template ${templateName}:`, error);
      throw error;
    }
  }

  // Replace template variables
  replaceTemplateVariables(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Utility Methods
   */

  // Get email content
  getEmailContent(content) {
    if (typeof content === 'string') {
      return { text: content };
    }

    if (content.html) {
      return {
        html: content.html,
        text: content.text || this.stripHtml(content.html)
      };
    }

    return { text: content.text };
  }

  // Strip HTML
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  // Process bulk results
  processBulkResults(results) {
    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: results.length,
      errors: results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason)
    };
  }

  // Track notification metrics
  trackNotification(type, status, startTime = null) {
    if (startTime) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      metrics.observeHistogram('notification_duration_seconds', duration, {
        type,
        status
      });
    }

    metrics.incrementCounter('notifications_total', {
      type,
      status
    });
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

// Export instance
module.exports = notificationManager;
