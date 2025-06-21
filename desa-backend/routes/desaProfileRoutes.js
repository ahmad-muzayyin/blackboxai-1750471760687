const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const desaProfileController = require('../controllers/desaProfileController');
const roleMiddleware = require('../middleware/roleMiddleware');

// Validation middleware
const profileValidation = [
  body('namaDesa')
    .trim()
    .notEmpty()
    .withMessage('Nama desa is required'),
  body('kodeDesa')
    .trim()
    .notEmpty()
    .withMessage('Kode desa is required'),
  body('kecamatan')
    .trim()
    .notEmpty()
    .withMessage('Kecamatan is required'),
  body('kabupaten')
    .trim()
    .notEmpty()
    .withMessage('Kabupaten is required'),
  body('provinsi')
    .trim()
    .notEmpty()
    .withMessage('Provinsi is required'),
  body('kodePos')
    .optional()
    .isLength({ min: 5, max: 10 })
    .isNumeric()
    .withMessage('Invalid kode pos'),
  body('alamat')
    .trim()
    .notEmpty()
    .withMessage('Alamat is required'),
  body('telepon')
    .optional()
    .matches(/^[0-9+()-\s]+$/)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Invalid website URL'),
  body('visi')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Visi cannot be empty when provided'),
  body('misi')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Misi cannot be empty when provided'),
  body('luasWilayah')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Luas wilayah must be a positive number'),
  body('jumlahDusun')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Jumlah dusun must be a positive integer'),
  body('jumlahRW')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Jumlah RW must be a positive integer'),
  body('jumlahRT')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Jumlah RT must be a positive integer')
];

const logoValidation = [
  body('logoUrl')
    .isURL()
    .withMessage('Invalid logo URL')
];

// Public route to get desa profile
router.get('/profile', desaProfileController.getDesaProfile);

// Public route to get desa statistics
router.get('/statistics', desaProfileController.getDesaStatistics);

// Protected routes (admin only)
router.put('/profile',
  roleMiddleware(['admin_desa']),
  profileValidation,
  desaProfileController.updateDesaProfile
);

router.put('/profile/logo',
  roleMiddleware(['admin_desa']),
  logoValidation,
  desaProfileController.updateLogo
);

module.exports = router;
