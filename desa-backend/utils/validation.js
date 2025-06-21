const { check, validationResult } = require('express-validator');
const moment = require('moment');

// Common validation rules
const commonRules = {
  // String validation
  requiredString: (field) => check(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required`),

  minLength: (field, min) => check(field)
    .isLength({ min })
    .withMessage(`${field} must be at least ${min} characters long`),

  maxLength: (field, max) => check(field)
    .isLength({ max })
    .withMessage(`${field} must not exceed ${max} characters`),

  // Number validation
  requiredNumber: (field) => check(field)
    .notEmpty()
    .isNumeric()
    .withMessage(`${field} must be a number`),

  minNumber: (field, min) => check(field)
    .isFloat({ min })
    .withMessage(`${field} must be at least ${min}`),

  maxNumber: (field, max) => check(field)
    .isFloat({ max })
    .withMessage(`${field} must not exceed ${max}`),

  // Date validation
  requiredDate: (field) => check(field)
    .notEmpty()
    .isDate()
    .withMessage(`${field} must be a valid date`),

  dateNotInFuture: (field) => check(field)
    .custom(value => {
      if (moment(value).isAfter(moment())) {
        throw new Error(`${field} cannot be in the future`);
      }
      return true;
    }),

  dateNotInPast: (field) => check(field)
    .custom(value => {
      if (moment(value).isBefore(moment())) {
        throw new Error(`${field} cannot be in the past`);
      }
      return true;
    }),

  // Email validation
  email: check('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  // Password validation
  password: check('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/)
    .withMessage('Password must contain at least one number, one lowercase and one uppercase letter'),

  // NIK validation
  nik: check('nik')
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be exactly 16 digits'),

  // Phone number validation
  phone: check('telepon')
    .matches(/^[0-9+\-() ]{10,15}$/)
    .withMessage('Please provide a valid phone number')
};

// Specific validation rules for different entities
const validationRules = {
  // User validation rules
  user: {
    create: [
      commonRules.requiredString('username'),
      commonRules.minLength('username', 3),
      commonRules.email,
      commonRules.password,
      check('role')
        .isIn(['admin_desa', 'perangkat_desa', 'warga'])
        .withMessage('Invalid role specified')
    ],
    update: [
      check('username').optional().trim().isLength({ min: 3 }),
      check('email').optional().trim().isEmail(),
      check('currentPassword').optional().notEmpty(),
      check('newPassword').optional().isLength({ min: 6 })
    ]
  },

  // Penduduk validation rules
  penduduk: {
    create: [
      commonRules.nik,
      commonRules.requiredString('nama'),
      commonRules.requiredString('tempatLahir'),
      commonRules.requiredDate('tanggalLahir'),
      check('jenisKelamin')
        .isIn(['L', 'P'])
        .withMessage('Jenis kelamin must be L or P'),
      check('golonganDarah')
        .isIn(['A', 'B', 'AB', 'O', '-'])
        .withMessage('Invalid golongan darah'),
      commonRules.requiredString('alamat'),
      commonRules.requiredString('rt'),
      commonRules.requiredString('rw'),
      commonRules.requiredString('kelurahanDesa'),
      commonRules.requiredString('kecamatan'),
      check('agama')
        .isIn(['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', 'LAINNYA'])
        .withMessage('Invalid agama'),
      check('statusPerkawinan')
        .isIn(['BELUM_KAWIN', 'KAWIN', 'CERAI_HIDUP', 'CERAI_MATI'])
        .withMessage('Invalid status perkawinan'),
      commonRules.requiredString('pekerjaan'),
      check('kewarganegaraan')
        .isIn(['WNI', 'WNA'])
        .withMessage('Invalid kewarganegaraan')
    ]
  },

  // Surat request validation rules
  suratRequest: {
    create: [
      commonRules.requiredNumber('pemohonId'),
      check('jenisSurat')
        .isIn([
          'SURAT_KETERANGAN_DOMISILI',
          'SURAT_KETERANGAN_USAHA',
          'SURAT_KETERANGAN_TIDAK_MAMPU',
          'SURAT_PENGANTAR_KTP',
          'SURAT_PENGANTAR_KK',
          'SURAT_KETERANGAN_KELAHIRAN',
          'SURAT_KETERANGAN_KEMATIAN',
          'SURAT_KETERANGAN_PINDAH',
          'LAINNYA'
        ])
        .withMessage('Invalid jenis surat'),
      commonRules.requiredString('keperluan')
    ]
  },

  // Bantuan sosial validation rules
  bantuanSosial: {
    create: [
      commonRules.requiredString('namaProgram'),
      check('jenisProgram')
        .isIn(['BLT', 'PKH', 'BPNT', 'PIP', 'KIS', 'RUTILAHU', 'LAINNYA'])
        .withMessage('Invalid jenis program'),
      commonRules.requiredString('deskripsi'),
      check('tahunAnggaran')
        .isInt({ min: 2000, max: 9999 })
        .withMessage('Invalid tahun anggaran'),
      check('sumberDana')
        .isIn(['APBN', 'APBD_PROVINSI', 'APBD_KABUPATEN', 'APBDesa', 'CSR', 'LAINNYA'])
        .withMessage('Invalid sumber dana'),
      commonRules.requiredNumber('nilaiManfaat'),
      commonRules.requiredNumber('totalAnggaran'),
      commonRules.requiredDate('tanggalMulai'),
      commonRules.requiredDate('tanggalSelesai')
    ]
  },

  // APBDes validation rules
  apbdes: {
    create: [
      check('tahunAnggaran')
        .isInt({ min: 2000, max: 9999 })
        .withMessage('Invalid tahun anggaran'),
      check('jenis')
        .isIn(['PENDAPATAN', 'BELANJA', 'PEMBIAYAAN'])
        .withMessage('Invalid jenis'),
      commonRules.requiredString('kategori'),
      commonRules.requiredString('uraian'),
      commonRules.requiredNumber('nilaiAnggaran'),
      check('sumberDana')
        .isIn(['PAD', 'DANA_DESA', 'ALOKASI_DANA_DESA', 'BANTUAN_PROVINSI', 'BANTUAN_KABUPATEN', 'LAINNYA'])
        .withMessage('Invalid sumber dana')
    ]
  }
};

// Validation result handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  commonRules,
  validationRules,
  validate
};
