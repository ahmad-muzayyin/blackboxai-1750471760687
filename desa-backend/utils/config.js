const path = require('path');
const dotenv = require('dotenv');
const logger = require('./logger');

// Load environment variables from .env file
dotenv.config();

class Config {
  constructor() {
    this.config = {
      // Application
      app: {
        name: process.env.APP_NAME || 'Desa Digital',
        env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT, 10) || 5000,
        host: process.env.HOST || 'localhost',
        apiUrl: process.env.API_URL || 'http://localhost:5000',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
        apiPrefix: '/api',
        timezone: process.env.TZ || 'Asia/Jakarta'
      },

      // Database
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        name: process.env.DB_NAME || 'desa_digital',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        dialect: 'mysql',
        logging: process.env.DB_LOGGING === 'true',
        pool: {
          max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
          min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
          acquire: 30000,
          idle: 10000
        }
      },

      // Redis
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB, 10) || 0,
        keyPrefix: process.env.REDIS_PREFIX || 'desa:',
        ttl: parseInt(process.env.REDIS_TTL, 10) || 3600
      },

      // JWT
      jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256'
      },

      // Email
      email: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        from: process.env.SMTP_FROM || 'noreply@desadigital.com'
      },

      // SMS Gateway
      sms: {
        enabled: process.env.SMS_ENABLED === 'true',
        url: process.env.SMS_GATEWAY_URL,
        apiKey: process.env.SMS_GATEWAY_API_KEY,
        sender: process.env.SMS_SENDER || 'DESA-DIGITAL'
      },

      // File Upload
      upload: {
        dir: path.join(__dirname, '../uploads'),
        maxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 5 * 1024 * 1024, // 5MB
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
      },

      // Logging
      logging: {
        dir: path.join(__dirname, '../logs'),
        level: process.env.LOG_LEVEL || 'info',
        maxSize: '10m',
        maxFiles: '7d'
      },

      // Security
      security: {
        bcryptRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000, // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
        corsEnabled: process.env.CORS_ENABLED !== 'false',
        helmetEnabled: process.env.HELMET_ENABLED !== 'false',
        compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false'
      },

      // Backup
      backup: {
        enabled: process.env.BACKUP_ENABLED === 'true',
        dir: path.join(__dirname, '../backups'),
        schedule: process.env.BACKUP_SCHEDULE || '0 0 * * *', // Daily at midnight
        retention: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30
      },

      // Metrics
      metrics: {
        enabled: process.env.METRICS_ENABLED === 'true',
        route: '/metrics',
        collectDefault: true
      },

      // Cache
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
        checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD, 10) || 600
      },

      // Pagination
      pagination: {
        defaultPage: 1,
        defaultLimit: 10,
        maxLimit: 100
      }
    };

    // Validate required configuration
    this.validateConfig();
  }

  // Get configuration value
  get(key) {
    return key.split('.').reduce((config, part) => config && config[part], this.config);
  }

  // Set configuration value
  set(key, value) {
    const parts = key.split('.');
    const last = parts.pop();
    const config = parts.reduce((config, part) => config[part], this.config);
    config[last] = value;
  }

  // Validate required configuration
  validateConfig() {
    const requiredVars = [
      'database.host',
      'database.name',
      'database.user',
      'database.password',
      'jwt.secret'
    ];

    const missingVars = requiredVars.filter(key => !this.get(key));

    if (missingVars.length > 0) {
      const error = `Missing required configuration variables: ${missingVars.join(', ')}`;
      logger.error(error);
      throw new Error(error);
    }
  }

  // Get all configuration
  getAll() {
    return this.config;
  }

  // Get environment-specific configuration
  getEnvConfig() {
    return this.config[this.config.app.env];
  }

  // Check if running in production
  isProduction() {
    return this.config.app.env === 'production';
  }

  // Check if running in development
  isDevelopment() {
    return this.config.app.env === 'development';
  }

  // Check if running in test
  isTest() {
    return this.config.app.env === 'test';
  }
}

// Create singleton instance
const config = new Config();

// Export instance
module.exports = config;
