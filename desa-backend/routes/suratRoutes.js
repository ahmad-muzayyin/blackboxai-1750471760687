const express = require('express');
const { check } = require('express-validator');
const { 
  getAllSurat,
  getSuratById,
  createSurat,
  updateSuratStatus,
  getSuratStats
} = require('../controllers/suratController');
const { 
  authMiddleware, 
  isPerangkatDesa 
} = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const createSuratValidation = [
  check('pemohonId')
    .isInt()
    .withMessage('Invalid pemohon ID'),
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
  check('keperluan')
    .trim()
    .notEmpty()
    .withMessage('Keperluan is required'),
  check('lampiran')
    .optional()
    .isArray()
    .withMessage('Lampiran must be an array')
];

const updateStatusValidation = [
  check('status')
    .isIn(['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'COMPLETED'])
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
router.get('/', getAllSurat);
router.get('/stats', getSuratStats);
router.get('/:id', getSuratById);
router.post('/', createSuratValidation, createSurat);

// Protected routes (perangkat desa only)
router.put('/:id/status',
  [isPerangkatDesa, ...updateStatusValidation],
  updateSuratStatus
);

// Additional routes for specific surat operations
router.get('/:id/preview', authMiddleware, async (req, res) => {
  // TODO: Implement preview generation
  res.status(501).json({
    success: false,
    message: 'Preview generation not implemented yet'
  });
});

router.get('/:id/download', authMiddleware, async (req, res) => {
  // TODO: Implement PDF download
  res.status(501).json({
    success: false,
    message: 'PDF download not implemented yet'
  });
});

// Route for template management (admin only)
router.post('/:jenisSurat/template', isPerangkatDesa, async (req, res) => {
  // TODO: Implement template management
  res.status(501).json({
    success: false,
    message: 'Template management not implemented yet'
  });
});

// Export router
module.exports = router;
