const Joi = require('joi');
const logger = require('./logger');
const ResponseFormatter = require('./responseFormatter');

class SchemaValidator {
  constructor() {
    this.defaultOptions = {
      abortEarly: false, // Return all errors
      allowUnknown: true, // Ignore unknown props
      stripUnknown: true // Remove unknown props
    };
  }

  // Validate data against schema
  validate(schema, data, options = {}) {
    try {
      const validationOptions = { ...this.defaultOptions, ...options };
      const { error, value } = schema.validate(data, validationOptions);

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.context.key,
          message: detail.message.replace(/['"]/g, '')
        }));

        return {
          isValid: false,
          errors,
          value: null
        };
      }

      return {
        isValid: true,
        errors: null,
        value
      };
    } catch (error) {
      logger.error('Schema validation error:', error);
      throw error;
    }
  }

  // Middleware for request validation
  validateRequest(schema) {
    return (req, res, next) => {
      const validationResults = {};
      const sectionsToValidate = Object.keys(schema);

      for (const section of sectionsToValidate) {
        const dataToValidate = req[section];
        const result = this.validate(schema[section], dataToValidate);

        if (!result.isValid) {
          validationResults[section] = result.errors;
        } else {
          req[section] = result.value; // Replace with sanitized values
        }
      }

      if (Object.keys(validationResults).length > 0) {
        return ResponseFormatter.validationError(res, validationResults);
      }

      next();
    };
  }

  // Common schema definitions
  static schemas = {
    // User schemas
    user: {
      create: Joi.object({
        username: Joi.string().min(3).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        role: Joi.string().valid('admin_desa', 'perangkat_desa', 'warga').required()
      }),

      update: Joi.object({
        username: Joi.string().min(3).max(50),
        email: Joi.string().email(),
        currentPassword: Joi.string().min(6),
        newPassword: Joi.string().min(6),
        role: Joi.string().valid('admin_desa', 'perangkat_desa', 'warga')
      })
    },

    // Penduduk schemas
    penduduk: {
      create: Joi.object({
        nik: Joi.string().length(16).pattern(/^[0-9]+$/).required(),
        nama: Joi.string().min(3).max(100).required(),
        tempatLahir: Joi.string().required(),
        tanggalLahir: Joi.date().max('now').required(),
        jenisKelamin: Joi.string().valid('L', 'P').required(),
        golonganDarah: Joi.string().valid('A', 'B', 'AB', 'O', '-').required(),
        alamat: Joi.string().required(),
        rt: Joi.string().required(),
        rw: Joi.string().required(),
        kelurahanDesa: Joi.string().required(),
        kecamatan: Joi.string().required(),
        agama: Joi.string().valid(
          'ISLAM',
          'KRISTEN',
          'KATOLIK',
          'HINDU',
          'BUDDHA',
          'KONGHUCU',
          'LAINNYA'
        ).required(),
        statusPerkawinan: Joi.string().valid(
          'BELUM_KAWIN',
          'KAWIN',
          'CERAI_HIDUP',
          'CERAI_MATI'
        ).required(),
        pekerjaan: Joi.string().required(),
        kewarganegaraan: Joi.string().valid('WNI', 'WNA').required(),
        berlakuHingga: Joi.date().required(),
        userId: Joi.number().integer()
      }),

      update: Joi.object({
        nama: Joi.string().min(3).max(100),
        alamat: Joi.string(),
        rt: Joi.string(),
        rw: Joi.string(),
        pekerjaan: Joi.string(),
        statusPerkawinan: Joi.string().valid(
          'BELUM_KAWIN',
          'KAWIN',
          'CERAI_HIDUP',
          'CERAI_MATI'
        ),
        status: Joi.string().valid('AKTIF', 'PINDAH', 'MENINGGAL')
      })
    },

    // Surat Request schemas
    suratRequest: {
      create: Joi.object({
        jenisSurat: Joi.string().valid(
          'SURAT_KETERANGAN_DOMISILI',
          'SURAT_KETERANGAN_USAHA',
          'SURAT_KETERANGAN_TIDAK_MAMPU',
          'SURAT_PENGANTAR_KTP',
          'SURAT_PENGANTAR_KK',
          'SURAT_KETERANGAN_KELAHIRAN',
          'SURAT_KETERANGAN_KEMATIAN',
          'SURAT_KETERANGAN_PINDAH',
          'LAINNYA'
        ).required(),
        pemohonId: Joi.number().integer().required(),
        keperluan: Joi.string().required(),
        lampiran: Joi.array().items(Joi.string())
      }),

      updateStatus: Joi.object({
        status: Joi.string().valid(
          'PENDING',
          'VERIFIED',
          'APPROVED',
          'REJECTED',
          'COMPLETED'
        ).required(),
        keterangan: Joi.string()
      })
    },

    // Bantuan Sosial schemas
    bantuanSosial: {
      create: Joi.object({
        namaProgram: Joi.string().required(),
        jenisProgram: Joi.string().valid(
          'BLT',
          'PKH',
          'BPNT',
          'PIP',
          'KIS',
          'RUTILAHU',
          'LAINNYA'
        ).required(),
        deskripsi: Joi.string().required(),
        tahunAnggaran: Joi.number().integer().min(2000).required(),
        sumberDana: Joi.string().valid(
          'APBN',
          'APBD_PROVINSI',
          'APBD_KABUPATEN',
          'APBDesa',
          'CSR',
          'LAINNYA'
        ).required(),
        nilaiManfaat: Joi.number().positive().required(),
        totalAnggaran: Joi.number().positive().required(),
        tanggalMulai: Joi.date().required(),
        tanggalSelesai: Joi.date().min(Joi.ref('tanggalMulai')).required(),
        persyaratan: Joi.array().items(Joi.string())
      }),

      addPenerima: Joi.object({
        pendudukId: Joi.number().integer().required(),
        bantuanSosialId: Joi.number().integer().required(),
        status: Joi.string().valid(
          'TERDAFTAR',
          'VERIFIKASI',
          'DISETUJUI',
          'DITOLAK',
          'DIBATALKAN',
          'SELESAI'
        ).required(),
        nilaiDiterima: Joi.number().positive(),
        keterangan: Joi.string(),
        dokumenPendukung: Joi.array().items(Joi.string())
      })
    },

    // APBDes schemas
    apbdes: {
      create: Joi.object({
        tahunAnggaran: Joi.number().integer().min(2000).required(),
        jenis: Joi.string().valid('PENDAPATAN', 'BELANJA', 'PEMBIAYAAN').required(),
        kategori: Joi.string().required(),
        subKategori: Joi.string(),
        uraian: Joi.string().required(),
        nilaiAnggaran: Joi.number().positive().required(),
        waktuPelaksanaan: Joi.string(),
        lokasiKegiatan: Joi.string(),
        sumberDana: Joi.string().valid(
          'PAD',
          'DANA_DESA',
          'ALOKASI_DANA_DESA',
          'BANTUAN_PROVINSI',
          'BANTUAN_KABUPATEN',
          'LAINNYA'
        ).required()
      }),

      updateRealisasi: Joi.object({
        nilaiRealisasi: Joi.number().positive().required(),
        dokumenPendukung: Joi.array().items(Joi.string()),
        keterangan: Joi.string()
      })
    },

    // Common schemas
    common: {
      pagination: Joi.object({
        page: Joi.number().integer().min(1),
        limit: Joi.number().integer().min(1).max(100),
        sort: Joi.string(),
        order: Joi.string().valid('ASC', 'DESC'),
        search: Joi.string()
      }),

      id: Joi.object({
        id: Joi.number().integer().required()
      }),

      date: Joi.object({
        startDate: Joi.date(),
        endDate: Joi.date().min(Joi.ref('startDate'))
      })
    }
  };
}

// Create singleton instance
const schemaValidator = new SchemaValidator();

// Export instance
module.exports = schemaValidator;
