const { Op } = require('sequelize');
const { BantuanSosial, BantuanSosialPenerima, Penduduk, User } = require('../models');
const { APIError, catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Get all bantuan sosial programs with pagination and filters
const getAllBantuanSosial = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    jenisProgram,
    tahunAnggaran,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build where clause
  const whereClause = {};
  if (search) {
    whereClause[Op.or] = [
      { namaProgram: { [Op.like]: `%${search}%` } },
      { deskripsi: { [Op.like]: `%${search}%` } }
    ];
  }
  if (status) whereClause.status = status;
  if (jenisProgram) whereClause.jenisProgram = jenisProgram;
  if (tahunAnggaran) whereClause.tahunAnggaran = tahunAnggaran;

  // Calculate offset
  const offset = (page - 1) * limit;

  // Get bantuan sosial with pagination
  const { count, rows: bantuanSosial } = await BantuanSosial.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'username']
      }
    ],
    order: [[sortBy, sortOrder.toUpperCase()]],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json({
    success: true,
    data: {
      bantuanSosial,
      pagination: {
        total: count,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    }
  });
});

// Get single bantuan sosial program
const getBantuanSosialById = catchAsync(async (req, res) => {
  const bantuanSosial = await BantuanSosial.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'username']
      },
      {
        model: BantuanSosialPenerima,
        as: 'penerima',
        include: [{
          model: Penduduk,
          as: 'penduduk',
          attributes: ['id', 'nik', 'nama', 'alamat']
        }]
      }
    ]
  });

  if (!bantuanSosial) {
    throw new APIError('Bantuan sosial program not found', 404);
  }

  res.json({
    success: true,
    data: bantuanSosial
  });
});

// Create new bantuan sosial program
const createBantuanSosial = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const bantuanData = {
    ...req.body,
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  const bantuanSosial = await BantuanSosial.create(bantuanData);

  logger.info({
    type: 'BANTUAN_SOSIAL_CREATED',
    bantuanId: bantuanSosial.id,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: bantuanSosial
  });
});

// Update bantuan sosial program
const updateBantuanSosial = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const bantuanSosial = await BantuanSosial.findByPk(req.params.id);

  if (!bantuanSosial) {
    throw new APIError('Bantuan sosial program not found', 404);
  }

  const updateData = {
    ...req.body,
    updatedBy: req.user.id
  };

  await bantuanSosial.update(updateData);

  logger.info({
    type: 'BANTUAN_SOSIAL_UPDATED',
    bantuanId: bantuanSosial.id,
    updatedBy: req.user.id
  });

  res.json({
    success: true,
    data: bantuanSosial
  });
});

// Add penerima to bantuan sosial
const addPenerima = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const { bantuanSosialId } = req.params;
  const { pendudukId, nilaiDiterima } = req.body;

  // Verify bantuan sosial exists
  const bantuanSosial = await BantuanSosial.findByPk(bantuanSosialId);
  if (!bantuanSosial) {
    throw new APIError('Bantuan sosial program not found', 404);
  }

  // Verify penduduk exists
  const penduduk = await Penduduk.findByPk(pendudukId);
  if (!penduduk) {
    throw new APIError('Penduduk not found', 404);
  }

  // Check if penduduk is already a recipient
  const existingPenerima = await BantuanSosialPenerima.findOne({
    where: {
      bantuanSosialId,
      pendudukId
    }
  });

  if (existingPenerima) {
    throw new APIError('Penduduk is already registered as a recipient', 400);
  }

  // Create penerima
  const penerima = await BantuanSosialPenerima.create({
    bantuanSosialId,
    pendudukId,
    nilaiDiterima,
    status: 'TERDAFTAR'
  });

  // Update jumlah penerima in bantuan sosial
  await bantuanSosial.increment('jumlahPenerima');

  logger.info({
    type: 'BANTUAN_SOSIAL_PENERIMA_ADDED',
    bantuanId: bantuanSosialId,
    pendudukId,
    addedBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: penerima
  });
});

// Update penerima status
const updatePenerimaStatus = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const { bantuanSosialId, penerimaId } = req.params;
  const { status, keterangan } = req.body;

  const penerima = await BantuanSosialPenerima.findOne({
    where: {
      id: penerimaId,
      bantuanSosialId
    }
  });

  if (!penerima) {
    throw new APIError('Penerima not found', 404);
  }

  await penerima.update({
    status,
    keterangan,
    ...(status === 'VERIFIKASI' && { verifiedBy: req.user.id }),
    ...(status === 'DISETUJUI' && { approvedBy: req.user.id })
  });

  logger.info({
    type: 'BANTUAN_SOSIAL_PENERIMA_STATUS_UPDATED',
    bantuanId: bantuanSosialId,
    penerimaId,
    status,
    updatedBy: req.user.id
  });

  res.json({
    success: true,
    data: penerima
  });
});

// Get bantuan sosial statistics
const getBantuanSosialStats = catchAsync(async (req, res) => {
  const stats = await Promise.all([
    // Total programs
    BantuanSosial.count(),
    
    // Status distribution
    ...['DRAFT', 'AKTIF', 'SELESAI', 'DIBATALKAN'].map(status =>
      BantuanSosial.count({ where: { status } })
    ),
    
    // Total budget allocation
    BantuanSosial.sum('totalAnggaran'),
    
    // Total recipients
    BantuanSosialPenerima.count(),
    
    // Recipients status distribution
    ...['TERDAFTAR', 'VERIFIKASI', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'SELESAI'].map(status =>
      BantuanSosialPenerima.count({ where: { status } })
    )
  ]);

  const [
    totalPrograms,
    draftPrograms,
    activePrograms,
    completedPrograms,
    cancelledPrograms,
    totalBudget,
    totalRecipients,
    ...recipientStats
  ] = stats;

  res.json({
    success: true,
    data: {
      programs: {
        total: totalPrograms,
        statusDistribution: {
          draft: draftPrograms,
          active: activePrograms,
          completed: completedPrograms,
          cancelled: cancelledPrograms
        }
      },
      budget: {
        total: totalBudget || 0
      },
      recipients: {
        total: totalRecipients,
        statusDistribution: {
          registered: recipientStats[0],
          verified: recipientStats[1],
          approved: recipientStats[2],
          rejected: recipientStats[3],
          cancelled: recipientStats[4],
          completed: recipientStats[5]
        }
      }
    }
  });
});

module.exports = {
  getAllBantuanSosial,
  getBantuanSosialById,
  createBantuanSosial,
  updateBantuanSosial,
  addPenerima,
  updatePenerimaStatus,
  getBantuanSosialStats
};
