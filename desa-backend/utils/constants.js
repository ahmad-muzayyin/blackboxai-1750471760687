/**
 * Application-wide constants and configuration values
 */

const constants = {
  // Application Settings
  APP: {
    NAME: 'Desa Digital',
    VERSION: '1.0.0',
    ENVIRONMENT: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,
    API_PREFIX: '/api',
    UPLOAD_DIR: 'uploads',
    LOGS_DIR: 'logs',
    BACKUP_DIR: 'backups',
    DEFAULT_LANGUAGE: 'id',
    TIMEZONE: 'Asia/Jakarta'
  },

  // Authentication
  AUTH: {
    JWT_EXPIRES_IN: '24h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    PASSWORD_RESET_EXPIRES_IN: '1h',
    MIN_PASSWORD_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 15 * 60 * 1000, // 15 minutes
    ROLES: {
      ADMIN: 'admin_desa',
      STAFF: 'perangkat_desa',
      USER: 'warga'
    },
    PERMISSIONS: {
      READ: 'read',
      WRITE: 'write',
      UPDATE: 'update',
      DELETE: 'delete',
      APPROVE: 'approve'
    }
  },

  // Database
  DATABASE: {
    DIALECT: 'mysql',
    MAX_POOL: 5,
    MIN_POOL: 0,
    ACQUIRE: 30000,
    IDLE: 10000,
    LOGGING: false
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    SORT_ORDER: {
      ASC: 'ASC',
      DESC: 'DESC'
    }
  },

  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_MIME_TYPES: {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
    },
    IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },

  // HTTP Status Codes
  HTTP: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },

  // Data Models
  MODELS: {
    // Penduduk Constants
    PENDUDUK: {
      JENIS_KELAMIN: {
        LAKI_LAKI: 'L',
        PEREMPUAN: 'P'
      },
      GOLONGAN_DARAH: ['A', 'B', 'AB', 'O', '-'],
      AGAMA: [
        'ISLAM',
        'KRISTEN',
        'KATOLIK',
        'HINDU',
        'BUDDHA',
        'KONGHUCU',
        'LAINNYA'
      ],
      STATUS_PERKAWINAN: [
        'BELUM_KAWIN',
        'KAWIN',
        'CERAI_HIDUP',
        'CERAI_MATI'
      ],
      STATUS: [
        'AKTIF',
        'PINDAH',
        'MENINGGAL'
      ]
    },

    // Surat Request Constants
    SURAT: {
      JENIS: [
        'SURAT_KETERANGAN_DOMISILI',
        'SURAT_KETERANGAN_USAHA',
        'SURAT_KETERANGAN_TIDAK_MAMPU',
        'SURAT_PENGANTAR_KTP',
        'SURAT_PENGANTAR_KK',
        'SURAT_KETERANGAN_KELAHIRAN',
        'SURAT_KETERANGAN_KEMATIAN',
        'SURAT_KETERANGAN_PINDAH',
        'LAINNYA'
      ],
      STATUS: [
        'PENDING',
        'VERIFIED',
        'APPROVED',
        'REJECTED',
        'COMPLETED'
      ]
    },

    // Bantuan Sosial Constants
    BANTUAN_SOSIAL: {
      JENIS_PROGRAM: [
        'BLT',
        'PKH',
        'BPNT',
        'PIP',
        'KIS',
        'RUTILAHU',
        'LAINNYA'
      ],
      SUMBER_DANA: [
        'APBN',
        'APBD_PROVINSI',
        'APBD_KABUPATEN',
        'APBDesa',
        'CSR',
        'LAINNYA'
      ],
      STATUS: [
        'DRAFT',
        'AKTIF',
        'SELESAI',
        'DIBATALKAN'
      ],
      STATUS_PENERIMA: [
        'TERDAFTAR',
        'VERIFIKASI',
        'DISETUJUI',
        'DITOLAK',
        'DIBATALKAN',
        'SELESAI'
      ]
    },

    // APBDes Constants
    APBDES: {
      JENIS: [
        'PENDAPATAN',
        'BELANJA',
        'PEMBIAYAAN'
      ],
      SUMBER_DANA: [
        'PAD',
        'DANA_DESA',
        'ALOKASI_DANA_DESA',
        'BANTUAN_PROVINSI',
        'BANTUAN_KABUPATEN',
        'LAINNYA'
      ],
      STATUS: [
        'DRAFT',
        'DIAJUKAN',
        'DISETUJUI',
        'DITOLAK',
        'REVISI'
      ]
    }
  },

  // Error Messages
  ERRORS: {
    AUTH: {
      INVALID_CREDENTIALS: 'Email atau password salah',
      ACCOUNT_LOCKED: 'Akun telah dikunci, silakan coba lagi nanti',
      TOKEN_EXPIRED: 'Token telah kadaluarsa',
      TOKEN_INVALID: 'Token tidak valid',
      UNAUTHORIZED: 'Tidak memiliki akses',
      FORBIDDEN: 'Akses ditolak'
    },
    VALIDATION: {
      REQUIRED_FIELD: 'Field ini wajib diisi',
      INVALID_FORMAT: 'Format tidak valid',
      INVALID_LENGTH: 'Panjang tidak sesuai',
      INVALID_VALUE: 'Nilai tidak valid'
    },
    DATABASE: {
      CONNECTION_ERROR: 'Koneksi database error',
      QUERY_ERROR: 'Query database error',
      RECORD_NOT_FOUND: 'Data tidak ditemukan',
      DUPLICATE_ENTRY: 'Data sudah ada'
    }
  },

  // Success Messages
  SUCCESS: {
    AUTH: {
      LOGIN_SUCCESS: 'Login berhasil',
      LOGOUT_SUCCESS: 'Logout berhasil',
      PASSWORD_CHANGED: 'Password berhasil diubah'
    },
    DATA: {
      CREATE_SUCCESS: 'Data berhasil ditambahkan',
      UPDATE_SUCCESS: 'Data berhasil diperbarui',
      DELETE_SUCCESS: 'Data berhasil dihapus'
    }
  },

  // Cache Keys
  CACHE_KEYS: {
    USER_PROFILE: 'user:profile:',
    PENDUDUK_LIST: 'penduduk:list',
    SURAT_LIST: 'surat:list',
    BANTUAN_LIST: 'bantuan:list',
    APBDES_LIST: 'apbdes:list'
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  }
};

module.exports = Object.freeze(constants);
