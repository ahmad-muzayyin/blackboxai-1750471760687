const Joi = require('joi');
const moment = require('moment');
const { ValidationError } = require('./errors');
const constants = require('./constants');

class Validator {
  // Common validation rules
  static rules = {
    // String rules
    string: {
      name: Joi.string().min(2).max(100).trim(),
      email: Joi.string().email().lowercase().trim(),
      password: Joi.string().min(6).max(100),
      phone: Joi.string().pattern(/^[0-9+\-() ]{10,15}$/),
      nik: Joi.string().length(16).pattern(/^[0-9]+$/),
      date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
      time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/),
      uuid: Joi.string().guid({ version: 'uuidv4' })
    },

    // Number rules
    number: {
      id: Joi.number().integer().positive(),
      age: Joi.number().integer().min(0).max(150),
      year: Joi.number().integer().min(1900).max(moment().year() + 10),
      amount: Joi.number().positive().precision(2),
      percentage: Joi.number().min(0).max(100).precision(2)
    },

    // Array rules
    array: {
      ids: Joi.array().items(Joi.number().integer().positive()),
      strings: Joi.array().items(Joi.string()),
      unique: (schema) => Joi.array().items(schema).unique()
    },

    // Object rules
    object: {
      pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        sort: Joi.string(),
        order: Joi.string().valid('ASC', 'DESC').default('DESC')
      }),
      dateRange: Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate'))
      })
    }
  };

  // Custom validation functions
  static custom = {
    // Check if date is valid and not in future
    isPastDate: (value, helpers) => {
      if (!moment(value).isValid()) {
        return helpers.error('date.invalid');
      }
      if (moment(value).isAfter(moment())) {
        return helpers.error('date.future');
      }
      return value;
    },

    // Check if value is in enum
    isInEnum: (value, helpers, enumValues) => {
      if (!enumValues.includes(value)) {
        return helpers.error('enum.invalid');
      }
      return value;
    },

    // Check if array has unique values
    hasUniqueValues: (value, helpers) => {
      const unique = [...new Set(value)];
      if (unique.length !== value.length) {
        return helpers.error('array.unique');
      }
      return value;
    }
  };

  // Model-specific validation schemas
  static schemas = {
    // User validation schemas
    user: {
      create: Joi.object({
        username: this.rules.string.name.required(),
        email: this.rules.string.email.required(),
        password: this.rules.string.password.required(),
        role: Joi.string()
          .valid(...Object.values(constants.AUTH.ROLES))
          .required()
      }),

      update: Joi.object({
        username: this.rules.string.name,
        email: this.rules.string.email,
        currentPassword: this.rules.string.password,
        newPassword: this.rules.string.password,
        role: Joi.string().valid(...Object.values(constants.AUTH.ROLES))
      })
    },

    // Penduduk validation schemas
    penduduk: {
      create: Joi.object({
        nik: this.rules.string.nik.required(),
        nama: this.rules.string.name.required(),
        tempatLahir: Joi.string().required(),
        tanggalLahir: Joi.date().iso().required().custom(this.custom.isPastDate),
        jenisKelamin: Joi.string()
          .valid(...Object.values(constants.MODELS.PENDUDUK.JENIS_KELAMIN))
          .required(),
        agama: Joi.string()
          .valid(...constants.MODELS.PENDUDUK.AGAMA)
          .required(),
        statusPerkawinan: Joi.string()
          .valid(...constants.MODELS.PENDUDUK.STATUS_PERKAWINAN)
          .required(),
        pekerjaan: Joi.string().required(),
        alamat: Joi.string().required(),
        rt: Joi.string().required(),
        rw: Joi.string().required()
      }),

      update: Joi.object({
        nama: this.rules.string.name,
        pekerjaan: Joi.string(),
        alamat: Joi.string(),
        rt: Joi.string(),
        rw: Joi.string(),
        statusPerkawinan: Joi.string()
          .valid(...constants.MODELS.PENDUDUK.STATUS_PERKAWINAN)
      })
    },

    // Surat validation schemas
    surat: {
      create: Joi.object({
        jenisSurat: Joi.string()
          .valid(...constants.MODELS.SURAT.JENIS)
          .required(),
        pemohonId: this.rules.number.id.required(),
        keperluan: Joi.string().required(),
        lampiran: this.rules.array.strings
      }),

      updateStatus: Joi.object({
        status: Joi.string()
          .valid(...constants.MODELS.SURAT.STATUS)
          .required(),
        keterangan: Joi.string()
      })
    },

    // Bantuan Sosial validation schemas
    bantuanSosial: {
      create: Joi.object({
        namaProgram: Joi.string().required(),
        jenisProgram: Joi.string()
          .valid(...constants.MODELS.BANTUAN_SOSIAL.JENIS_PROGRAM)
          .required(),
        deskripsi: Joi.string().required(),
        tahunAnggaran: this.rules.number.year.required(),
        nilaiManfaat: this.rules.number.amount.required(),
        tanggalMulai: Joi.date().iso().required(),
        tanggalSelesai: Joi.date().iso().min(Joi.ref('tanggalMulai')).required()
      }),

      addPenerima: Joi.object({
        pendudukId: this.rules.number.id.required(),
        status: Joi.string()
          .valid(...constants.MODELS.BANTUAN_SOSIAL.STATUS_PENERIMA)
          .required(),
        keterangan: Joi.string()
      })
    }
  };

  // Validate data against schema
  static validate(data, schema) {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.context.key,
        message: detail.message.replace(/['"]/g, '')
      }));

      throw new ValidationError('Validation failed', errors);
    }

    return value;
  }

  // Validate request query parameters
  static validateQuery(query, allowedFields = []) {
    const schema = Joi.object({
      ...this.rules.object.pagination,
      search: Joi.string(),
      filter: Joi.object().pattern(
        Joi.string().valid(...allowedFields),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
      )
    });

    return this.validate(query, schema);
  }

  // Validate ID parameter
  static validateId(id) {
    return this.validate({ id }, Joi.object({
      id: this.rules.number.id.required()
    }));
  }

  // Validate date range
  static validateDateRange(startDate, endDate) {
    return this.validate(
      { startDate, endDate },
      this.rules.object.dateRange
    );
  }
}

module.exports = Validator;
