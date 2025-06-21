const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

// Import route modules
const authRoutes = require('./authRoutes');
const pendudukRoutes = require('./pendudukRoutes');
const suratRoutes = require('./suratRoutes');
const bantuanSosialRoutes = require('./bantuanSosialRoutes');
const apbdesRoutes = require('./apbdesRoutes');
const desaProfileRoutes = require('./desaProfileRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Apply rate limiting to all API routes
router.use(rateLimiter);

// Auth routes (public)
router.use('/auth', authRoutes);

// Protected routes
router.use(authMiddleware.verifyToken);

// Desa Profile routes
router.use('/desa', desaProfileRoutes);

// Penduduk routes
router.use('/penduduk', pendudukRoutes);

// Surat routes
router.use('/surat', suratRoutes);

// Bantuan Sosial routes
router.use('/bantuan-sosial', bantuanSosialRoutes);

// APBDes routes
router.use('/apbdes', apbdesRoutes);

// Error handling for invalid routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = router;
