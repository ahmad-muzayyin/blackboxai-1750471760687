const express = require('express');
const { check } = require('express-validator');
const { 
  getAllAPBDes,
  getAPBDesSummary,
  createAPBDes,
  updateAPBDes,
  updateRealisasi,
  getAPBDesStats
} = require('../controllers/apbdesController');
const { 
  authMiddleware, 
  isAdmin, 
  isPerangkatDesa 
} = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const apbdesValidation = [
  check('tahunAnggaran')
    .isInt({ min: 2000, max: 9999 })
    .withMessage('Invalid tahun anggaran'),
  check('jenis')
    .isIn(['PENDAPATAN', 'BELANJA', 'PEMBIAYAAN'])
    .withMessage('Invalid jenis'),
  check('kategori')
    .trim()
    .notEmpty()
    .withMessage('Kategori is required'),
  check('subKategori')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Sub kategori cannot be empty if provided'),
  check('uraian')
    .trim()
    .notEmpty()
    .withMessage('Uraian is required'),
  check('nilaiAnggaran')
    .isFloat({ min: 0 })
    .withMessage('Nilai anggaran must be a positive number'),
  check('nilaiRealisasi')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Nilai realisasi must be a positive number'),
  check('waktuPelaksanaan')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Waktu pelaksanaan cannot be empty if provided'),
  check('lokasiKegiatan')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Lokasi kegiatan cannot be empty if provided'),
  check('sumberDana')
    .isIn(['PAD', 'DANA_DESA', 'ALOKASI_DANA_DESA', 'BANTUAN_PROVINSI', 'BANTUAN_KABUPATEN', 'LAINNYA'])
    .withMessage('Invalid sumber dana'),
  check('status')
    .optional()
    .isIn(['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'REVISI'])
    .withMessage('Invalid status'),
  check('dokumenPendukung')
    .optional()
    .isArray()
    .withMessage('Dokumen pendukung must be an array')
];

const realisasiValidation = [
  check('nilaiRealisasi')
    .isFloat({ min: 0 })
    .withMessage('Nilai realisasi must be a positive number')
];

// All routes require authentication
router.use(authMiddleware);

// Public routes (authenticated users)
router.get('/', getAllAPBDes);
router.get('/stats', getAPBDesStats);
router.get('/summary/:tahunAnggaran', getAPBDesSummary);

// Protected routes (admin and perangkat desa only)
router.post('/',
  [isPerangkatDesa, ...apbdesValidation],
  createAPBDes
);

router.put('/:id',
  [isPerangkatDesa, ...apbdesValidation],
  updateAPBDes
);

router.put('/:id/realisasi',
  [isPerangkatDesa, ...realisasiValidation],
  updateRealisasi
);

// Additional routes for specific operations
router.get('/export/:tahunAnggaran', isPerangkatDesa, async (req, res) => {
  // TODO: Implement export functionality
  res.status(501).json({
    success: false,
    message: 'Export functionality not implemented yet'
  });
});

router.get('/report/:tahunAnggaran', isPerangkatDesa, async (req, res) => {
  // TODO: Implement detailed report generation
  res.status(501).json({
    success: false,
    message: 'Report generation not implemented yet'
  });
});

router.post('/:id/approve', isAdmin, async (req, res) => {
  // TODO: Implement approval process
  res.status(501).json({
    success: false,
    message: 'Approval process not implemented yet'
  });
});

router.post('/import', isAdmin, async (req, res) => {
  // TODO: Implement bulk import from Excel
  res.status(501).json({
    success: false,
    message: 'Import functionality not implemented yet'
  });
});

// Analysis and visualization routes
router.get('/analysis/trend', async (req, res) => {
  // TODO: Implement trend analysis
  res.status(501).json({
    success: false,
    message: 'Trend analysis not implemented yet'
  });
});

router.get('/analysis/comparison', async (req, res) => {
  // TODO: Implement year-over-year comparison
  res.status(501).json({
    success: false,
    message: 'Comparison analysis not implemented yet'
  });
});

router.get('/visualization/charts', async (req, res) => {
  // TODO: Implement chart data generation
  res.status(501).json({
    success: false,
    message: 'Chart data generation not implemented yet'
  });
});

// Export router
module.exports = router;
