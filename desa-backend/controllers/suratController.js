const { SuratRequest, Penduduk, User } = require('../models');
const { ValidationError } = require('../utils/errorManager');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/loggerManager');
const metrics = require('../utils/metricsManager');
const pdfGenerator = require('../utils/pdfGenerator');

/**
 * Get all surat requests with pagination
 * @route GET /api/surat
 */
exports.getAllSurat = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const status = req.query.status;
    const search = req.query.search;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where[SuratRequest.sequelize.Op.or] = [
        { nomorSurat: { [SuratRequest.sequelize.Op.like]: `%${search}%` } },
        { jenisSurat: { [SuratRequest.sequelize.Op.like]: `%${search}%` } },
        { trackingCode: { [SuratRequest.sequelize.Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await SuratRequest.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Penduduk,
          as: 'pemohon',
          attributes: ['id', 'nik', 'nama']
        },
        {
          model: User,
          as: 'processor',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username']
        }
      ]
    });

    trackSuratMetrics('getAllSurat', startTime, true);

    return res.json(
      responseFormatter.paginated(
        rows,
        page,
        limit,
        count
      )
    );
  } catch (error) {
    trackSuratMetrics('getAllSurat', startTime, false);
    next(error);
  }
};

/**
 * Get surat request by ID
 * @route GET /api/surat/:id
 */
exports.getSuratById = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const surat = await SuratRequest.findByPk(req.params.id, {
      include: [
        {
          model: Penduduk,
          as: 'pemohon',
          attributes: ['id', 'nik', 'nama', 'alamat', 'rt', 'rw']
        },
        {
          model: User,
          as: 'processor',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username']
        }
      ]
    });

    if (!surat) {
      throw new ValidationError('Surat request not found');
    }

    trackSuratMetrics('getSuratById', startTime, true);

    return res.json(
      responseFormatter.success(surat)
    );
  } catch (error) {
    trackSuratMetrics('getSuratById', startTime, false);
    next(error);
  }
};

/**
 * Create new surat request
 * @route POST /api/surat
 */
exports.createSurat = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const {
      jenisSurat,
      pemohonId,
      keperluan,
      templateData
    } = req.body;

    // Validate pemohon exists
    const pemohon = await Penduduk.findByPk(pemohonId);
    if (!pemohon) {
      throw new ValidationError('Pemohon not found');
    }

    const surat = await SuratRequest.create({
      jenisSurat,
      pemohonId,
      keperluan,
      templateData,
      status: 'pending'
    });

    trackSuratMetrics('createSurat', startTime, true);

    return res.status(201).json(
      responseFormatter.created(surat, 'Surat request created successfully')
    );
  } catch (error) {
    trackSuratMetrics('createSurat', startTime, false);
    next(error);
  }
};

/**
 * Update surat request status
 * @route PUT /api/surat/:id/status
 */
exports.updateStatus = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const { status, keterangan } = req.body;
    const userId = req.user.id;

    const surat = await SuratRequest.findByPk(req.params.id);
    if (!surat) {
      throw new ValidationError('Surat request not found');
    }

    switch (status) {
      case 'approved':
        await surat.approve(userId);
        break;
      case 'rejected':
        await surat.reject(userId, keterangan);
        break;
      case 'completed':
        await surat.complete(userId);
        break;
      default:
        throw new ValidationError('Invalid status');
    }

    trackSuratMetrics('updateStatus', startTime, true);

    return res.json(
      responseFormatter.success(surat, 'Status updated successfully')
    );
  } catch (error) {
    trackSuratMetrics('updateStatus', startTime, false);
    next(error);
  }
};

/**
 * Generate PDF for surat
 * @route GET /api/surat/:id/pdf
 */
exports.generatePDF = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const surat = await SuratRequest.findByPk(req.params.id, {
      include: [
        {
          model: Penduduk,
          as: 'pemohon',
          attributes: ['id', 'nik', 'nama', 'alamat', 'rt', 'rw']
        }
      ]
    });

    if (!surat) {
      throw new ValidationError('Surat request not found');
    }

    if (surat.status !== 'approved' && surat.status !== 'completed') {
      throw new ValidationError('Surat has not been approved');
    }

    const pdfBuffer = await pdfGenerator.generateSurat(surat);

    trackSuratMetrics('generatePDF', startTime, true);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=surat-${surat.nomorSurat}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    trackSuratMetrics('generatePDF', startTime, false);
    next(error);
  }
};

/**
 * Track surat request by tracking code
 * @route GET /api/surat/track/:code
 */
exports.trackSurat = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const surat = await SuratRequest.findByTrackingCode(req.params.code);
    
    if (!surat) {
      throw new ValidationError('Surat request not found');
    }

    trackSuratMetrics('trackSurat', startTime, true);

    return res.json(
      responseFormatter.success(surat)
    );
  } catch (error) {
    trackSuratMetrics('trackSurat', startTime, false);
    next(error);
  }
};

// Helper function to track metrics
function trackSuratMetrics(operation, startTime, success) {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const duration = seconds + nanoseconds / 1e9;

  metrics.observeHistogram('surat_operation_duration_seconds', duration, {
    operation
  });

  metrics.incrementCounter('surat_operations_total', {
    operation,
    success: success.toString()
  });
}
