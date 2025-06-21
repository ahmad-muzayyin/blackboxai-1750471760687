const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Penduduk } = require('../models');

// Increase test timeout
jest.setTimeout(30000);

// Mock logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  stream: {
    write: jest.fn()
  }
}));

// Global test utilities
global.createTestUser = async (userData = {}) => {
  const defaultUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    role: 'warga',
    isActive: true
  };

  return await User.create({ ...defaultUser, ...userData });
};

global.createTestPenduduk = async (pendudukData = {}) => {
  const defaultPenduduk = {
    nik: '1234567890123456',
    nama: 'Test User',
    tempatLahir: 'Test City',
    tanggalLahir: '1990-01-01',
    jenisKelamin: 'L',
    golonganDarah: 'A',
    alamat: 'Test Address',
    rt: '001',
    rw: '002',
    kelurahanDesa: 'Test Village',
    kecamatan: 'Test District',
    agama: 'ISLAM',
    statusPerkawinan: 'BELUM_KAWIN',
    pekerjaan: 'Test Job',
    kewarganegaraan: 'WNI',
    berlakuHingga: '2025-01-01',
    status: 'AKTIF'
  };

  return await Penduduk.create({ ...defaultPenduduk, ...pendudukData });
};

global.generateTestToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

// Common test data
global.testData = {
  validUser: {
    username: 'validuser',
    email: 'valid@example.com',
    password: 'password123',
    role: 'warga'
  },
  validPenduduk: {
    nik: '1234567890123456',
    nama: 'Valid User',
    tempatLahir: 'Valid City',
    tanggalLahir: '1990-01-01',
    jenisKelamin: 'L',
    alamat: 'Valid Address',
    rt: '001',
    rw: '002',
    kelurahanDesa: 'Valid Village',
    kecamatan: 'Valid District',
    agama: 'ISLAM',
    statusPerkawinan: 'BELUM_KAWIN',
    pekerjaan: 'Valid Job'
  }
};

// Clear database before each test
beforeEach(async () => {
  await Promise.all([
    User.destroy({ where: {}, force: true }),
    Penduduk.destroy({ where: {}, force: true })
  ]);
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...', error);
  throw error;
});

// Add custom jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Mock date for consistent testing
const mockDate = new Date('2023-01-01T00:00:00.000Z');
global.Date = class extends Date {
  constructor(...args) {
    if (args.length) {
      return super(...args);
    }
    return mockDate;
  }
};

// Helper function to wait for a specified time
global.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
