const express = require('express');
const { check } = require('express-validator');
const { 
  getAllBantuanSosial,
  getBantuanSosialById,
  createBantuanSosial,
  updateBantuanSosial,
  addPenerima,
  updatePenerimaStatus,
  getBantuanSosialStats
} = require('../controllers/bantuanSosialController');
const { 
  authMiddleware, 
  isAdmin, 
  isPerangkatDesa 
} = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const bantuanSosialValidation = [
  check('namaProgram')
    .trim()
    .notEmpty()
    .withMessage('Nama program is required'),
  check('jenisProgram')
    .isIn(['BLT', 'PKH', 'BPNT', 'PIP', 'KIS', 'RUTILAHU', 'LAINNYA'])
    .withMessage('Invalid jenis program'),
  check('deskripsi')
    .trim()
    .notEmpty()
    .withMessage('Deskripsi is required'),
  check('tahunAnggaran')
    .isInt({ min: 2000, max: 9999 })
    .withMessage('Invalid tahun anggaran'),
  check('sumberDana')
    .isIn(['APBN', 'APBD_PROVINSI', 'APBD_KABUPATEN', 'APBDesa', 'CSR', 'LAINNYA'])
    .withMessage('Invalid sumber dana'),
  check('nilaiManfaat')
    .isFloat({ min: 0 })
    .withMessage('Nilai manfaat must be a positive number'),
  check('totalAnggaran')
    .isFloat({ min: 0 })
    .withMessage('Total anggaran must be a positive number'),
  check('tanggalMulai')
    .isDate()
    .withMessage('Invalid tanggal mulai format'),
  check('tanggalSelesai')
    .isDate()
    .withMessage('Invalid tanggal selesai format'),
  check('persyaratan')
    .optional()
    .isArray()
    .withMessage('Persyaratan must be an array'),
  check('status')
    .optional()
    .isIn(['DRAFT', 'AKTIF', 'SELESAI', 'DIBATALKAN'])
    .withMessage('Invalid status')
];

const penerimaValidation = [
  check('pendudukId')
    .isInt()
    .withMessage('Invalid penduduk ID'),
  check('nilaiDiterima')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Nilai diterima must be a positive number')
];

const updatePenerimaStatusValidation = [
  check('status')
    .isIn(['TERDAFTAR', 'VERIFIKASI', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'SELESAI'])
    .withMessage('Invalid status'),
  check('keterangan')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Keterangan cannot be empty if provided')
];

// All routes require authentication
router.use(authMiddleware);

// Public routes (authenticated users)
router.get('/', getAllBantuanSosial);
router.get('/stats', getBantuanSosialStats);
router.get('/:id', getBantuanSosialById);

// Protected routes (admin and perangkat desa only)
router.post('/',
  [isPerangkatDesa, ...bantuanSosialValidation],
  createBantuanSosial
);

router.put('/:id',
  [isPerangkatDesa, ...bantuanSosialValidation],
  updateBantuanSosial
);

// Penerima management routes
router.post('/:bantuanSosialId/penerima',
  [isPerangkatDesa, ...penerimaValidation],
  addPenerima
);

router.put('/:bantuanSosialId/penerima/:penerimaId/status',
  [isPerangkatDesa, ...updatePenerimaStatusValidation],
  updatePenerimaStatus
);

// Additional routes for specific operations
router.get('/:id/export', isPerangkatDesa, async (req, res) => {
  // TODO: Implement export functionality
  res.status(501).json({
    success: false,
    message: 'Export functionality not implemented yet'
  });
});

router.post('/:id/verify-all', isAdmin, async (req, res) => {
  // TODO: Implement bulk verification
  res.status(501).json({
    success: false,
    message: 'Bulk verification not implemented yet'
  });
});

router.post('/:id/distribute', isAdmin, async (req, res) => {
  // TODO: Implement distribution tracking
  res.status(501).json({
    success: false,
    message: 'Distribution tracking not implemented yet'
  });
});

// Export router
module.exports = router;
