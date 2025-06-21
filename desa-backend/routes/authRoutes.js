const express = require('express');
const { check } = require('express-validator');
const { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  logout 
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const registerValidation = [
  check('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  check('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  check('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  check('role')
    .optional()
    .isIn(['admin_desa', 'perangkat_desa', 'warga'])
    .withMessage('Invalid role specified'),
  check('nik')
    .optional()
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be 16 digits')
];

const loginValidation = [
  check('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  check('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  check('username')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  check('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  check('currentPassword')
    .optional()
    .notEmpty()
    .withMessage('Current password is required when changing password'),
  check('newPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', [authMiddleware, ...updateProfileValidation], updateProfile);
router.post('/logout', authMiddleware, logout);

module.exports = router;
