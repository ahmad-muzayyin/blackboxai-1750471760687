const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined', { stream: logger.stream }));

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    logger.logAPIResponse(req, res, startTime);
  });
  next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/penduduk', require('./routes/pendudukRoutes'));
app.use('/api/surat', require('./routes/suratRoutes'));
app.use('/api/bantuan-sosial', require('./routes/bantuanSosialRoutes'));
app.use('/api/apbdes', require('./routes/apbdesRoutes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.status(200).json({
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        base: '/api/auth',
        routes: [
          { path: '/register', method: 'POST', description: 'Register new user' },
          { path: '/login', method: 'POST', description: 'User login' },
          { path: '/profile', method: 'GET', description: 'Get user profile' },
          { path: '/profile', method: 'PUT', description: 'Update user profile' }
        ]
      },
      penduduk: {
        base: '/api/penduduk',
        routes: [
          { path: '/', method: 'GET', description: 'Get all penduduk' },
          { path: '/:id', method: 'GET', description: 'Get penduduk by ID' },
          { path: '/', method: 'POST', description: 'Create new penduduk' },
          { path: '/:id', method: 'PUT', description: 'Update penduduk' },
          { path: '/:id', method: 'DELETE', description: 'Delete penduduk' },
          { path: '/stats', method: 'GET', description: 'Get penduduk statistics' }
        ]
      },
      surat: {
        base: '/api/surat',
        routes: [
          { path: '/', method: 'GET', description: 'Get all surat requests' },
          { path: '/:id', method: 'GET', description: 'Get surat by ID' },
          { path: '/', method: 'POST', description: 'Create new surat request' },
          { path: '/:id/status', method: 'PUT', description: 'Update surat status' },
          { path: '/stats', method: 'GET', description: 'Get surat statistics' }
        ]
      },
      bantuanSosial: {
        base: '/api/bantuan-sosial',
        routes: [
          { path: '/', method: 'GET', description: 'Get all bantuan sosial programs' },
          { path: '/:id', method: 'GET', description: 'Get program by ID' },
          { path: '/', method: 'POST', description: 'Create new program' },
          { path: '/:id', method: 'PUT', description: 'Update program' },
          { path: '/:id/penerima', method: 'POST', description: 'Add penerima to program' },
          { path: '/stats', method: 'GET', description: 'Get program statistics' }
        ]
      },
      apbdes: {
        base: '/api/apbdes',
        routes: [
          { path: '/', method: 'GET', description: 'Get all APBDes entries' },
          { path: '/summary/:tahunAnggaran', method: 'GET', description: 'Get yearly summary' },
          { path: '/', method: 'POST', description: 'Create new entry' },
          { path: '/:id', method: 'PUT', description: 'Update entry' },
          { path: '/:id/realisasi', method: 'PUT', description: 'Update realization' },
          { path: '/stats', method: 'GET', description: 'Get budget statistics' }
        ]
      }
    }
  });
});

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// 404 Handler
app.use(notFound);

// Error Handler
app.use(errorHandler);

// Export app
module.exports = app;
