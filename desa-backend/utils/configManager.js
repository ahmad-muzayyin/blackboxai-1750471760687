const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const logger = require('./loggerManager');
const eventManager = require('./eventManager');

class ConfigManager {
  constructor() {
    this.config = new Map();
    this.envConfig = {};
    this.configPath = path.join(__dirname, '../config');
    this.initialize();
  }

  // Initialize config manager
  initialize() {
    try {
      this.loadEnvConfig();
      this.loadConfigFiles();
      this.validateRequiredConfig();
      logger.info('Config manager initialized successfully');
    } catch (error) {
      logger.error('Config manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Configuration Loading
   */

  // Load environment configuration
  loadEnvConfig() {
    const envPath = path.join(__dirname, '../.env');
    const result = dotenv.config({ path: envPath });

    if (result.error) {
      logger.warn('No .env file found, using environment variables');
    }

    this.envConfig = process.env;
    this.processEnvConfig();
  }

  // Process environment configuration
  processEnvConfig() {
    // Application
    this.set('app.env', this.envConfig.NODE_ENV || 'development');
    this.set('app.port', parseInt(this.envConfig.PORT) || 3000);
    this.set('app.host', this.envConfig.HOST || 'localhost');
    this.set('app.apiPrefix', this.envConfig.API_PREFIX || '/api/v1');
    this.set('app.url', this.envConfig.APP_URL || 'http://localhost:3000');

    // Database
    this.set('database', {
      host: this.envConfig.DB_HOST || 'localhost',
      port: parseInt(this.envConfig.DB_PORT) || 5432,
      name: this.envConfig.DB_NAME || 'desa_db',
      username: this.envConfig.DB_USERNAME || 'postgres',
      password: this.envConfig.DB_PASSWORD || '',
      dialect: this.envConfig.DB_DIALECT || 'postgres',
      logging: this.envConfig.DB_LOGGING === 'true'
    });

    // Redis
    this.set('redis', {
      host: this.envConfig.REDIS_HOST || 'localhost',
      port: parseInt(this.envConfig.REDIS_PORT) || 6379,
      password: this.envConfig.REDIS_PASSWORD || null,
      db: parseInt(this.envConfig.REDIS_DB) || 0
    });

    // JWT
    this.set('security.jwt', {
      secret: this.envConfig.JWT_SECRET || 'your-secret-key',
      expiresIn: this.envConfig.JWT_EXPIRES_IN || '1d',
      refreshExpiresIn: this.envConfig.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    // Email
    this.set('email', {
      host: this.envConfig.MAIL_HOST,
      port: parseInt(this.envConfig.MAIL_PORT) || 587,
      secure: this.envConfig.MAIL_SECURE === 'true',
      user: this.envConfig.MAIL_USER,
      password: this.envConfig.MAIL_PASSWORD,
      from: this.envConfig.MAIL_FROM || 'noreply@desa.id'
    });

    // SMS
    this.set('sms', {
      enabled: this.envConfig.SMS_ENABLED === 'true',
      provider: this.envConfig.SMS_PROVIDER || 'twilio',
      accountSid: this.envConfig.TWILIO_ACCOUNT_SID,
      authToken: this.envConfig.TWILIO_AUTH_TOKEN,
      from: this.envConfig.TWILIO_FROM_NUMBER
    });

    // File Upload
    this.set('upload', {
      provider: this.envConfig.UPLOAD_PROVIDER || 'local',
      maxSize: parseInt(this.envConfig.UPLOAD_MAX_SIZE) || 5242880, // 5MB
      allowedTypes: (this.envConfig.UPLOAD_ALLOWED_TYPES || 'image/*,application/pdf').split(','),
      path: this.envConfig.UPLOAD_PATH || 'uploads'
    });
  }

  // Load configuration files
  loadConfigFiles() {
    try {
      const files = fs.readdirSync(this.configPath);
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.json')) {
          const configName = path.basename(file, path.extname(file));
          const configPath = path.join(this.configPath, file);
          const config = require(configPath);
          
          this.set(configName, config);
        }
      }
    } catch (error) {
      logger.error('Error loading config files:', error);
      throw error;
    }
  }

  /**
   * Configuration Validation
   */

  // Validate required configuration
  validateRequiredConfig() {
    const required = [
      'app.env',
      'app.port',
      'database.host',
      'database.name',
      'security.jwt.secret'
    ];

    const missing = required.filter(key => !this.get(key));

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Configuration Access
   */

  // Get configuration value
  get(key, defaultValue = null) {
    const value = this.getNestedValue(this.config, key);
    return value !== undefined ? value : defaultValue;
  }

  // Set configuration value
  set(key, value) {
    this.setNestedValue(this.config, key, value);
    eventManager.emitEvent('config:updated', { key, value });
  }

  // Check if configuration exists
  has(key) {
    return this.getNestedValue(this.config, key) !== undefined;
  }

  /**
   * Environment Helpers
   */

  // Check if environment is production
  isProduction() {
    return this.get('app.env') === 'production';
  }

  // Check if environment is development
  isDevelopment() {
    return this.get('app.env') === 'development';
  }

  // Check if environment is testing
  isTesting() {
    return this.get('app.env') === 'testing';
  }

  /**
   * Feature Flags
   */

  // Check if feature is enabled
  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`, false);
  }

  // Enable feature
  enableFeature(feature) {
    this.set(`features.${feature}`, true);
    eventManager.emitEvent('feature:enabled', { feature });
  }

  // Disable feature
  disableFeature(feature) {
    this.set(`features.${feature}`, false);
    eventManager.emitEvent('feature:disabled', { feature });
  }

  /**
   * Configuration Updates
   */

  // Update configuration
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  // Reset configuration
  reset() {
    this.config.clear();
    this.initialize();
  }

  /**
   * Configuration Export/Import
   */

  // Export configuration
  export(format = 'json') {
    const config = this.toObject();

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(config, null, 2);
      case 'env':
        return this.toEnvFormat(config);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Import configuration
  import(data, format = 'json') {
    try {
      let config;

      switch (format.toLowerCase()) {
        case 'json':
          config = JSON.parse(data);
          break;
        case 'env':
          config = this.fromEnvFormat(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      this.update(config);
    } catch (error) {
      logger.error('Error importing configuration:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */

  // Get nested value from object
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current instanceof Map ? current.get(key) : current?.[key];
    }, obj);
  }

  // Set nested value in object
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (current instanceof Map) {
        if (!current.has(key)) {
          current.set(key, new Map());
        }
        return current.get(key);
      }
      return current;
    }, obj);

    if (target instanceof Map) {
      target.set(lastKey, value);
    }
  }

  // Convert configuration to object
  toObject() {
    const result = {};
    
    for (const [key, value] of this.config) {
      if (value instanceof Map) {
        result[key] = this.mapToObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // Convert Map to object recursively
  mapToObject(map) {
    const obj = {};
    
    for (const [key, value] of map) {
      obj[key] = value instanceof Map ? this.mapToObject(value) : value;
    }

    return obj;
  }

  // Convert configuration to env format
  toEnvFormat(config, prefix = '') {
    let result = '';
    
    Object.entries(config).forEach(([key, value]) => {
      const envKey = prefix ? `${prefix}_${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        result += this.toEnvFormat(value, envKey.toUpperCase());
      } else {
        result += `${envKey.toUpperCase()}=${value}\n`;
      }
    });

    return result;
  }

  // Convert env format to configuration object
  fromEnvFormat(data) {
    const config = {};
    
    data.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        const keys = key.toLowerCase().split('_');
        let current = config;
        
        keys.forEach((k, i) => {
          if (i === keys.length - 1) {
            current[k] = value;
          } else {
            current[k] = current[k] || {};
            current = current[k];
          }
        });
      }
    });

    return config;
  }
}

// Create singleton instance
const configManager = new ConfigManager();

// Export instance
module.exports = configManager;
