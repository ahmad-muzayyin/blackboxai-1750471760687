const express = require('express');
const { check } = require('express-validator');
const { 
  getAllPenduduk,
  getPendudukById,
  createPenduduk,
  updatePenduduk,
  deletePenduduk,
  getPendudukStats
} = require('../controllers/pendudukController');
const { 
  authMiddleware, 
  isAdmin, 
  isPerangkatDesa 
} = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const pendudukValidation = [
  check('nik')
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be 16 digits'),
  check('nama')
    .trim()
    .notEmpty()
    .withMessage('Nama is required'),
  check('tempatLahir')
    .trim()
    .notEmpty()
    .withMessage('Tempat lahir is required'),
  check('tanggalLahir')
    .isDate()
    .withMessage('Invalid tanggal lahir format'),
  check('jenisKelamin')
    .isIn(['L', 'P'])
    .withMessage('Jenis kelamin must be L or P'),
  check('golonganDarah')
    .isIn(['A', 'B', 'AB', 'O', '-'])
    .withMessage('Invalid golongan darah'),
  check('alamat')
    .trim()
    .notEmpty()
    .withMessage('Alamat is required'),
  check('rt')
    .trim()
    .notEmpty()
    .withMessage('RT is required'),
  check('rw')
    .trim()
    .notEmpty()
    .withMessage('RW is required'),
  check('kelurahanDesa')
    .trim()
    .notEmpty()
    .withMessage('Kelurahan/Desa is required'),
  check('kecamatan')
    .trim()
    .notEmpty()
    .withMessage('Kecamatan is required'),
  check('agama')
    .isIn(['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', 'LAINNYA'])
    .withMessage('Invalid agama'),
  check('statusPerkawinan')
    .isIn(['BELUM_KAWIN', 'KAWIN', 'CERAI_HIDUP', 'CERAI_MATI'])
    .withMessage('Invalid status perkawinan'),
  check('pekerjaan')
    .trim()
    .notEmpty()
    .withMessage('Pekerjaan is required'),
  check('kewarganegaraan')
    .isIn(['WNI', 'WNA'])
    .withMessage('Invalid kewarganegaraan'),
  check('berlakuHingga')
    .isDate()
    .withMessage('Invalid berlaku hingga format'),
  check('status')
    .optional()
    .isIn(['AKTIF', 'PINDAH', 'MENINGGAL'])
    .withMessage('Invalid status')
];

// Routes that require authentication
router.use(authMiddleware);

// Public routes (authenticated users)
router.get('/', getAllPenduduk);
router.get('/stats', getPendudukStats);
router.get('/:id', getPendudukById);

// Protected routes (admin and perangkat desa only)
router.post('/', 
  [isPerangkatDesa, ...pendudukValidation],
  createPenduduk
);

router.put('/:id',
  [isPerangkatDesa, ...pendudukValidation],
  updatePenduduk
);

router.delete('/:id',
  isAdmin,
  deletePenduduk
);

// Export router
module.exports = router;
