const { Penduduk, User } = require('../models');
const { ValidationError } = require('../utils/errorManager');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/loggerManager');
const metrics = require('../utils/metricsManager');

/**
 * Get all penduduk with pagination
 * @route GET /api/penduduk
 */
exports.getAllPenduduk = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Penduduk.sequelize.Op.or] = [
        { nama: { [Penduduk.sequelize.Op.like]: `%${search}%` } },
        { nik: { [Penduduk.sequelize.Op.like]: `%${search}%` } },
        { noKK: { [Penduduk.sequelize.Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Penduduk.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nama', 'ASC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    trackPendudukMetrics('getAllPenduduk', startTime, true);

    return res.json(
      responseFormatter.paginated(
        rows,
        page,
        limit,
        count
      )
    );
  } catch (error) {
    trackPendudukMetrics('getAllPenduduk', startTime, false);
    next(error);
  }
};

/**
 * Get penduduk by ID
 * @route GET /api/penduduk/:id
 */
exports.getPendudukById = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const penduduk = await Penduduk.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!penduduk) {
      throw new ValidationError('Penduduk not found');
    }

    trackPendudukMetrics('getPendudukById', startTime, true);

    return res.json(
      responseFormatter.success(penduduk)
    );
  } catch (error) {
    trackPendudukMetrics('getPendudukById', startTime, false);
    next(error);
  }
};

/**
 * Create new penduduk
 * @route POST /api/penduduk
 */
exports.createPenduduk = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const {
      nik,
      noKK,
      nama,
      tempatLahir,
      tanggalLahir,
      jenisKelamin,
      agama,
      statusPerkawinan,
      pekerjaan,
      alamat,
      rt,
      rw,
      userId
    } = req.body;

    // Check if NIK already exists
    const existingNIK = await Penduduk.findOne({ where: { nik } });
    if (existingNIK) {
      throw new ValidationError('NIK already registered');
    }

    const penduduk = await Penduduk.create({
      nik,
      noKK,
      nama,
      tempatLahir,
      tanggalLahir,
      jenisKelamin,
      agama,
      statusPerkawinan,
      pekerjaan,
      alamat,
      rt,
      rw,
      userId
    });

    trackPendudukMetrics('createPenduduk', startTime, true);

    return res.status(201).json(
      responseFormatter.created(penduduk, 'Penduduk created successfully')
    );
  } catch (error) {
    trackPendudukMetrics('createPenduduk', startTime, false);
    next(error);
  }
};

/**
 * Update penduduk
 * @route PUT /api/penduduk/:id
 */
exports.updatePenduduk = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const penduduk = await Penduduk.findByPk(req.params.id);
    if (!penduduk) {
      throw new ValidationError('Penduduk not found');
    }

    const {
      nama,
      tempatLahir,
      tanggalLahir,
      jenisKelamin,
      agama,
      statusPerkawinan,
      pekerjaan,
      alamat,
      rt,
      rw,
      statusTinggal,
      statusHidup,
      kewarganegaraan
    } = req.body;

    await penduduk.update({
      nama,
      tempatLahir,
      tanggalLahir,
      jenisKelamin,
      agama,
      statusPerkawinan,
      pekerjaan,
      alamat,
      rt,
      rw,
      statusTinggal,
      statusHidup,
      kewarganegaraan
    });

    trackPendudukMetrics('updatePenduduk', startTime, true);

    return res.json(
      responseFormatter.success(penduduk, 'Penduduk updated successfully')
    );
  } catch (error) {
    trackPendudukMetrics('updatePenduduk', startTime, false);
    next(error);
  }
};

/**
 * Delete penduduk
 * @route DELETE /api/penduduk/:id
 */
exports.deletePenduduk = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const penduduk = await Penduduk.findByPk(req.params.id);
    if (!penduduk) {
      throw new ValidationError('Penduduk not found');
    }

    await penduduk.destroy();

    trackPendudukMetrics('deletePenduduk', startTime, true);

    return res.json(
      responseFormatter.success(null, 'Penduduk deleted successfully')
    );
  } catch (error) {
    trackPendudukMetrics('deletePenduduk', startTime, false);
    next(error);
  }
};

/**
 * Get penduduk by NIK
 * @route GET /api/penduduk/nik/:nik
 */
exports.getPendudukByNIK = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const penduduk = await Penduduk.findOne({
      where: { nik: req.params.nik },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!penduduk) {
      throw new ValidationError('Penduduk not found');
    }

    trackPendudukMetrics('getPendudukByNIK', startTime, true);

    return res.json(
      responseFormatter.success(penduduk)
    );
  } catch (error) {
    trackPendudukMetrics('getPendudukByNIK', startTime, false);
    next(error);
  }
};

/**
 * Get penduduk by KK
 * @route GET /api/penduduk/kk/:nokk
 */
exports.getPendudukByKK = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const penduduk = await Penduduk.findAll({
      where: { noKK: req.params.nokk },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    trackPendudukMetrics('getPendudukByKK', startTime, true);

    return res.json(
      responseFormatter.success(penduduk)
    );
  } catch (error) {
    trackPendudukMetrics('getPendudukByKK', startTime, false);
    next(error);
  }
};

// Helper function to track metrics
function trackPendudukMetrics(operation, startTime, success) {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const duration = seconds + nanoseconds / 1e9;

  metrics.observeHistogram('penduduk_operation_duration_seconds', duration, {
    operation
  });

  metrics.incrementCounter('penduduk_operations_total', {
    operation,
    success: success.toString()
  });
}
