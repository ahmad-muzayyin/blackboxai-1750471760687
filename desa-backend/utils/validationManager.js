const Joi = require('joi');
const logger = require('./loggerManager');
const i18n = require('./i18nManager');
const metrics = require('./metricsManager');
const { ValidationError } = require('./errorManager');

class ValidationManager {
  constructor() {
    this.schemas = new Map();
    this.customRules = new Map();
    this.initialize();
  }

  // Initialize validation manager
  initialize() {
    try {
      this.setupCustomRules();
      this.setupDefaultSchemas();
      logger.info('Validation manager initialized successfully');
    } catch (error) {
      logger.error('Validation manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Schema Setup
   */

  // Setup default schemas
  setupDefaultSchemas() {
    // User schemas
    this.registerSchema('user.create', {
      username: Joi.string().min(3).max(30).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      role: Joi.string().valid('admin', 'staff', 'user').default('user'),
      profile: Joi.object({
        fullName: Joi.string().max(100),
        phone: Joi.string().pattern(/^[0-9+()-\s]+$/),
        address: Joi.string().max(200)
      })
    });

    // Penduduk schemas
    this.registerSchema('penduduk.create', {
      nik: Joi.string().length(16).pattern(/^[0-9]+$/).required(),
      nama: Joi.string().max(100).required(),
      tempatLahir: Joi.string().max(50).required(),
      tanggalLahir: Joi.date().iso().required(),
      jenisKelamin: Joi.string().valid('L', 'P').required(),
      alamat: Joi.string().max(200).required(),
      rt: Joi.string().max(3).required(),
      rw: Joi.string().max(3).required(),
      agama: Joi.string().required(),
      statusPerkawinan: Joi.string().required(),
      pekerjaan: Joi.string().required(),
      kewarganegaraan: Joi.string().default('WNI')
    });

    // Surat schemas
    this.registerSchema('surat.create', {
      jenisSurat: Joi.string().required(),
      pemohon: Joi.object({
        nik: Joi.string().length(16).pattern(/^[0-9]+$/).required(),
        nama: Joi.string().required()
      }),
      keperluan: Joi.string().required(),
      lampiran: Joi.array().items(
        Joi.object({
          nama: Joi.string().required(),
          file: Joi.string().required()
        })
      )
    });

    // Bantuan Sosial schemas
    this.registerSchema('bantuanSosial.create', {
      namaProgram: Joi.string().required(),
      jenisBantuan: Joi.string().required(),
      tanggalMulai: Joi.date().iso().required(),
      tanggalSelesai: Joi.date().iso().greater(Joi.ref('tanggalMulai')),
      nilaiManfaat: Joi.number().positive().required(),
      kriteria: Joi.array().items(Joi.string()),
      penerima: Joi.array().items(
        Joi.object({
          nik: Joi.string().length(16).pattern(/^[0-9]+$/).required(),
          nama: Joi.string().required()
        })
      )
    });

    // APBDes schemas
    this.registerSchema('apbdes.create', {
      tahun: Joi.number().integer().min(2000).required(),
      jenis: Joi.string().valid('pendapatan', 'belanja', 'pembiayaan').required(),
      kategori: Joi.string().required(),
      subKategori: Joi.string().required(),
      uraian: Joi.string().required(),
      nilaiAnggaran: Joi.number().positive().required(),
      sumberDana: Joi.string().required()
    });
  }

  // Setup custom validation rules
  setupCustomRules() {
    // NIK validation
    this.addCustomRule('nik', (value, helpers) => {
      if (!/^[0-9]{16}$/.test(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    });

    // Phone number validation
    this.addCustomRule('phone', (value, helpers) => {
      if (!/^[0-9+()-\s]{8,15}$/.test(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    });

    // Currency validation
    this.addCustomRule('currency', (value, helpers) => {
      if (typeof value !== 'number' || value < 0) {
        return helpers.error('any.invalid');
      }
      return Math.round(value * 100) / 100;
    });
  }

  /**
   * Schema Management
   */

  // Register schema
  registerSchema(name, schema) {
    try {
      const joiSchema = Joi.object(schema);
      this.schemas.set(name, joiSchema);
      logger.debug(`Schema registered: ${name}`);
    } catch (error) {
      logger.error(`Error registering schema ${name}:`, error);
      throw error;
    }
  }

  // Get schema
  getSchema(name) {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new Error(`Schema not found: ${name}`);
    }
    return schema;
  }

  // Add custom validation rule
  addCustomRule(name, validator) {
    try {
      this.customRules.set(name, validator);
      logger.debug(`Custom rule added: ${name}`);
    } catch (error) {
      logger.error(`Error adding custom rule ${name}:`, error);
      throw error;
    }
  }

  /**
   * Validation Methods
   */

  // Validate data against schema
  async validate(schemaName, data, options = {}) {
    const startTime = process.hrtime();

    try {
      const schema = this.getSchema(schemaName);
      const validationOptions = {
        abortEarly: false,
        stripUnknown: true,
        ...options
      };

      const result = await schema.validateAsync(data, validationOptions);
      this.trackValidation('success', schemaName, startTime);
      return result;
    } catch (error) {
      this.trackValidation('error', schemaName, startTime);
      throw this.formatValidationError(error);
    }
  }

  // Validate partial data (for updates)
  async validatePartial(schemaName, data, options = {}) {
    const schema = this.getSchema(schemaName);
    return this.validate(schemaName, data, {
      ...options,
      skipMissing: true
    });
  }

  // Validate array of items
  async validateMany(schemaName, items, options = {}) {
    const results = await Promise.all(
      items.map(item => this.validate(schemaName, item, options))
    );
    return results;
  }

  /**
   * Specific Validations
   */

  // Validate user data
  async validateUser(data, type = 'create') {
    return this.validate(`user.${type}`, data);
  }

  // Validate penduduk data
  async validatePenduduk(data, type = 'create') {
    return this.validate(`penduduk.${type}`, data);
  }

  // Validate surat data
  async validateSurat(data, type = 'create') {
    return this.validate(`surat.${type}`, data);
  }

  // Validate bantuan sosial data
  async validateBantuanSosial(data, type = 'create') {
    return this.validate(`bantuanSosial.${type}`, data);
  }

  // Validate APBDes data
  async validateAPBDes(data, type = 'create') {
    return this.validate(`apbdes.${type}`, data);
  }

  /**
   * Error Handling
   */

  // Format validation error
  formatValidationError(error) {
    if (error.isJoi) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: this.translateError(detail.type, detail.context),
        type: detail.type
      }));

      return new ValidationError('Validation failed', { details });
    }
    return error;
  }

  // Translate validation error
  translateError(type, context) {
    const key = `validation.${type}`;
    return i18n.translate(key, {
      defaultValue: context.message,
      ...context
    });
  }

  /**
   * Utility Methods
   */

  // Check if value exists
  async checkExists(model, field, value) {
    try {
      const count = await model.count({ where: { [field]: value } });
      return count > 0;
    } catch (error) {
      logger.error('Error checking existence:', error);
      throw error;
    }
  }

  // Check if value is unique
  async checkUnique(model, field, value, excludeId = null) {
    try {
      const where = { [field]: value };
      if (excludeId) {
        where.id = { [Op.ne]: excludeId };
      }
      const count = await model.count({ where });
      return count === 0;
    } catch (error) {
      logger.error('Error checking uniqueness:', error);
      throw error;
    }
  }

  /**
   * Metrics Tracking
   */

  // Track validation metrics
  trackValidation(status, schema, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('validation_duration_seconds', duration, {
      schema,
      status
    });

    metrics.incrementCounter('validations_total', {
      schema,
      status
    });
  }

  /**
   * Status Information
   */

  // Get validation manager status
  getStatus() {
    return {
      schemas: Array.from(this.schemas.keys()),
      customRules: Array.from(this.customRules.keys())
    };
  }
}

// Create singleton instance
const validationManager = new ValidationManager();

// Export instance
module.exports = validationManager;
