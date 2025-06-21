const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker/locale/id_ID');
const config = require('./config');
const models = require('../models');
const constants = require('./constants');

class TestUtils {
  /**
   * Authentication Helpers
   */

  // Generate test JWT token
  static generateToken(user, expiresIn = '1h') {
    return jwt.sign(
      { id: user.id, role: user.role },
      config.get('jwt.secret'),
      { expiresIn }
    );
  }

  // Create test user
  static async createTestUser(role = constants.AUTH.ROLES.USER) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    return models.User.create({
      username: faker.internet.userName(),
      email: faker.internet.email(),
      password: hashedPassword,
      role: role,
      isActive: true
    });
  }

  /**
   * Data Generators
   */

  // Generate test penduduk data
  static generatePendudukData() {
    const gender = faker.helpers.arrayElement(['L', 'P']);
    return {
      nik: faker.random.numeric(16),
      nama: faker.name.fullName(),
      tempatLahir: faker.address.city(),
      tanggalLahir: faker.date.past(50),
      jenisKelamin: gender,
      agama: faker.helpers.arrayElement(constants.MODELS.PENDUDUK.AGAMA),
      statusPerkawinan: faker.helpers.arrayElement(constants.MODELS.PENDUDUK.STATUS_PERKAWINAN),
      pekerjaan: faker.name.jobTitle(),
      alamat: faker.address.streetAddress(),
      rt: faker.random.numeric(3),
      rw: faker.random.numeric(3)
    };
  }

  // Generate test surat request data
  static generateSuratRequestData(pemohonId) {
    return {
      jenisSurat: faker.helpers.arrayElement(constants.MODELS.SURAT.JENIS),
      pemohonId: pemohonId,
      keperluan: faker.lorem.sentence(),
      status: 'PENDING'
    };
  }

  // Generate test bantuan sosial data
  static generateBantuanSosialData() {
    return {
      namaProgram: faker.company.catchPhrase(),
      jenisProgram: faker.helpers.arrayElement(constants.MODELS.BANTUAN_SOSIAL.JENIS_PROGRAM),
      deskripsi: faker.lorem.paragraph(),
      tahunAnggaran: faker.date.recent().getFullYear(),
      nilaiManfaat: parseFloat(faker.finance.amount(100000, 1000000)),
      tanggalMulai: faker.date.future(),
      tanggalSelesai: faker.date.future(1)
    };
  }

  /**
   * Database Helpers
   */

  // Clean test database
  static async cleanDatabase() {
    if (config.isTest()) {
      await models.sequelize.sync({ force: true });
    }
  }

  // Create test data
  static async createTestData() {
    // Create test users
    const admin = await this.createTestUser(constants.AUTH.ROLES.ADMIN);
    const staff = await this.createTestUser(constants.AUTH.ROLES.STAFF);
    const user = await this.createTestUser(constants.AUTH.ROLES.USER);

    // Create test penduduk
    const penduduk = await models.Penduduk.create(this.generatePendudukData());

    // Create test surat request
    const surat = await models.SuratRequest.create(
      this.generateSuratRequestData(penduduk.id)
    );

    // Create test bantuan sosial
    const bantuan = await models.BantuanSosial.create(
      this.generateBantuanSosialData()
    );

    return {
      admin,
      staff,
      user,
      penduduk,
      surat,
      bantuan
    };
  }

  /**
   * Request Helpers
   */

  // Generate test request
  static generateTestRequest(user = null) {
    const req = {
      body: {},
      query: {},
      params: {},
      headers: {},
      cookies: {}
    };

    if (user) {
      req.user = user;
      req.headers.authorization = `Bearer ${this.generateToken(user)}`;
    }

    return req;
  }

  // Generate test response
  static generateTestResponse() {
    const res = {
      statusCode: 200,
      headers: {},
      body: null
    };

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    res.json = (data) => {
      res.body = data;
      return res;
    };

    res.send = (data) => {
      res.body = data;
      return res;
    };

    res.setHeader = (key, value) => {
      res.headers[key] = value;
      return res;
    };

    return res;
  }

  /**
   * Assertion Helpers
   */

  // Assert successful response
  static assertSuccessResponse(res, message = null) {
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    if (message) {
      expect(res.body.message).toBe(message);
    }
  }

  // Assert error response
  static assertErrorResponse(res, statusCode, message = null) {
    expect(res.statusCode).toBe(statusCode);
    expect(res.body.success).toBe(false);
    if (message) {
      expect(res.body.message).toBe(message);
    }
  }

  // Assert validation error
  static assertValidationError(res, fields) {
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    
    fields.forEach(field => {
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: field })
      );
    });
  }

  // Assert unauthorized error
  static assertUnauthorizedError(res) {
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Authentication failed');
  }

  // Assert forbidden error
  static assertForbiddenError(res) {
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Not authorized to access this resource');
  }

  // Assert not found error
  static assertNotFoundError(res) {
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Resource not found');
  }

  /**
   * Mock Helpers
   */

  // Mock service response
  static mockServiceResponse(success = true, data = null, message = null) {
    return {
      success,
      data,
      message
    };
  }

  // Mock error response
  static mockErrorResponse(statusCode, message, errors = null) {
    return {
      success: false,
      statusCode,
      message,
      errors
    };
  }
}

module.exports = TestUtils;
