const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

class Security {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    this.secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
  }

  // Password hashing
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw error;
    }
  }

  // Password verification
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification error:', error);
      throw error;
    }
  }

  // Generate JWT token
  generateToken(payload, expiresIn = this.jwtExpiresIn) {
    try {
      return jwt.sign(payload, this.jwtSecret, { expiresIn });
    } catch (error) {
      logger.error('Token generation error:', error);
      throw error;
    }
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  }

  // Encrypt data
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(64);
      const key = crypto.pbkdf2Sync(this.secretKey, salt, 100000, 32, 'sha512');
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(String(text), 'utf8'),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();

      return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        tag: tag.toString('base64')
      };
    } catch (error) {
      logger.error('Encryption error:', error);
      throw error;
    }
  }

  // Decrypt data
  decrypt(encryptedData) {
    try {
      const { encrypted, iv, salt, tag } = encryptedData;
      
      const key = crypto.pbkdf2Sync(
        this.secretKey,
        Buffer.from(salt, 'base64'),
        100000,
        32,
        'sha512'
      );
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        key,
        Buffer.from(iv, 'base64')
      );
      
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption error:', error);
      throw error;
    }
  }

  // Generate random string
  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure filename
  generateSecureFilename(originalFilename) {
    const ext = originalFilename.split('.').pop();
    return `${this.generateRandomString(16)}.${ext}`;
  }

  // Hash data (one-way)
  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate HMAC
  generateHMAC(data) {
    return crypto.createHmac('sha256', this.secretKey)
      .update(data)
      .digest('hex');
  }

  // Verify HMAC
  verifyHMAC(data, hmac) {
    const calculatedHMAC = this.generateHMAC(data);
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHMAC),
      Buffer.from(hmac)
    );
  }

  // Generate API key
  generateApiKey() {
    return crypto.randomBytes(32).toString('base64');
  }

  // Hash API key
  hashApiKey(apiKey) {
    return this.hashData(apiKey);
  }

  // Generate refresh token
  generateRefreshToken() {
    return this.generateRandomString(64);
  }

  // Generate password reset token
  generatePasswordResetToken() {
    return {
      token: this.generateRandomString(32),
      expires: Date.now() + 3600000 // 1 hour
    };
  }

  // Sanitize data for logging
  sanitizeData(data, fieldsToSanitize = ['password', 'token', 'apiKey']) {
    const sanitized = { ...data };
    fieldsToSanitize.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    });
    return sanitized;
  }

  // Validate password strength
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const validations = {
      length: password.length >= minLength,
      upperCase: hasUpperCase,
      lowerCase: hasLowerCase,
      numbers: hasNumbers,
      specialChars: hasSpecialChars
    };

    const isValid = Object.values(validations).every(v => v);

    return {
      isValid,
      validations,
      message: isValid ? 'Password is strong' : 'Password does not meet requirements'
    };
  }

  // Rate limiting helper
  isRateLimited(key, limit, windowMs) {
    const now = Date.now();
    const attempts = this.rateLimitStore.get(key) || [];
    
    // Clean old attempts
    const validAttempts = attempts.filter(timestamp => 
      now - timestamp < windowMs
    );
    
    if (validAttempts.length >= limit) {
      return true;
    }
    
    validAttempts.push(now);
    this.rateLimitStore.set(key, validAttempts);
    return false;
  }

  // Simple in-memory store for rate limiting
  rateLimitStore = new Map();

  // Constants
  static ENCRYPTION_CONSTANTS = {
    KEY_SIZE: 32,
    SALT_SIZE: 64,
    IV_SIZE: 16,
    ITERATIONS: 100000,
    HASH_ALGORITHM: 'sha512',
    TOKEN_EXPIRY: '24h',
    PASSWORD_RESET_EXPIRY: '1h'
  };
}

// Create singleton instance
const security = new Security();

// Export instance
module.exports = security;
