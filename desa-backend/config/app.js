require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
    apiPrefix: '/api'
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // CORS configuration
  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 86400
  },

  // File upload configuration
  upload: {
    maxSize: process.env.UPLOAD_MAX_SIZE || 5242880, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    directory: process.env.UPLOAD_DIR || 'uploads/'
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100 // limit each IP to 100 requests per windowMs
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: '10m',
    maxFiles: '7d'
  },

  // Email configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'noreply@desadigital.id'
  },

  // Backup configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 0 * * *', // Daily at midnight
    directory: process.env.BACKUP_DIR || 'backups/',
    retention: process.env.BACKUP_RETENTION || 7 // days
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
    passwordMinLength: 6,
    passwordMaxLength: 100,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Metrics configuration
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    interval: process.env.METRICS_INTERVAL || 60000 // 1 minute
  },

  // Cache configuration
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    type: process.env.CACHE_TYPE || 'memory', // memory or redis
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD
    }
  },

  // PDF generation configuration
  pdf: {
    tempDir: process.env.PDF_TEMP_DIR || 'temp/',
    fontDir: process.env.PDF_FONT_DIR || 'assets/fonts/',
    headerTemplate: process.env.PDF_HEADER_TEMPLATE || 'templates/header.html',
    footerTemplate: process.env.PDF_FOOTER_TEMPLATE || 'templates/footer.html'
  },

  // Analytics configuration
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    retention: process.env.ANALYTICS_RETENTION || 90 // days
  },

  // Feature flags
  features: {
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    enableSMS: process.env.ENABLE_SMS === 'true',
    enableBackup: process.env.ENABLE_BACKUP === 'true',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableCache: process.env.ENABLE_CACHE === 'true'
  }
};
