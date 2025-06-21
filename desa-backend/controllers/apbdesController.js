const { Op } = require('sequelize');
const { APBDes, User } = require('../models');
const { APIError, catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Get all APBDes entries with pagination and filters
const getAllAPBDes = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    tahunAnggaran,
    jenis,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build where clause
  const whereClause = {};
  if (search) {
    whereClause[Op.or] = [
      { uraian: { [Op.like]: `%${search}%` } },
      { kategori: { [Op.like]: `%${search}%` } }
    ];
  }
  if (tahunAnggaran) whereClause.tahunAnggaran = tahunAnggaran;
  if (jenis) whereClause.jenis = jenis;
  if (status) whereClause.status = status;

  // Calculate offset
  const offset = (page - 1) * limit;

  // Get APBDes entries with pagination
  const { count, rows: apbdesEntries } = await APBDes.findAndCountAll({
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
      },
      {
        model: User,
        as: 'approver',
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
      apbdesEntries,
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

// Get APBDes summary by year
const getAPBDesSummary = catchAsync(async (req, res) => {
  const { tahunAnggaran } = req.params;

  // Get summary for each jenis
  const [pendapatan, belanja, pembiayaan] = await Promise.all([
    APBDes.getTotalByJenis(tahunAnggaran, 'PENDAPATAN'),
    APBDes.getTotalByJenis(tahunAnggaran, 'BELANJA'),
    APBDes.getTotalByJenis(tahunAnggaran, 'PEMBIAYAAN')
  ]);

  // Get realization totals
  const [pendapatanRealisasi, belanjaRealisasi, pembiayaanRealisasi] = await Promise.all([
    APBDes.getTotalRealisasiByJenis(tahunAnggaran, 'PENDAPATAN'),
    APBDes.getTotalRealisasiByJenis(tahunAnggaran, 'BELANJA'),
    APBDes.getTotalRealisasiByJenis(tahunAnggaran, 'PEMBIAYAAN')
  ]);

  // Calculate percentages
  const calculatePercentage = (realisasi, anggaran) => {
    return anggaran ? (realisasi / anggaran) * 100 : 0;
  };

  res.json({
    success: true,
    data: {
      tahunAnggaran,
      pendapatan: {
        anggaran: pendapatan,
        realisasi: pendapatanRealisasi,
        persentase: calculatePercentage(pendapatanRealisasi, pendapatan)
      },
      belanja: {
        anggaran: belanja,
        realisasi: belanjaRealisasi,
        persentase: calculatePercentage(belanjaRealisasi, belanja)
      },
      pembiayaan: {
        anggaran: pembiayaan,
        realisasi: pembiayaanRealisasi,
        persentase: calculatePercentage(pembiayaanRealisasi, pembiayaan)
      },
      total: {
        anggaran: pendapatan + pembiayaan - belanja,
        realisasi: pendapatanRealisasi + pembiayaanRealisasi - belanjaRealisasi
      }
    }
  });
});

// Create new APBDes entry
const createAPBDes = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const apbdesData = {
    ...req.body,
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  const apbdes = await APBDes.create(apbdesData);

  logger.info({
    type: 'APBDES_CREATED',
    apbdesId: apbdes.id,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: apbdes
  });
});

// Update APBDes entry
const updateAPBDes = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const apbdes = await APBDes.findByPk(req.params.id);

  if (!apbdes) {
    throw new APIError('APBDes entry not found', 404);
  }

  const updateData = {
    ...req.body,
    updatedBy: req.user.id
  };

  await apbdes.update(updateData);

  logger.info({
    type: 'APBDES_UPDATED',
    apbdesId: apbdes.id,
    updatedBy: req.user.id
  });

  res.json({
    success: true,
    data: apbdes
  });
});

// Update APBDes realization
const updateRealisasi = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError('Validation Error', 400, errors.array());
  }

  const { nilaiRealisasi } = req.body;
  const apbdes = await APBDes.findByPk(req.params.id);

  if (!apbdes) {
    throw new APIError('APBDes entry not found', 404);
  }

  if (nilaiRealisasi > apbdes.nilaiAnggaran) {
    throw new APIError('Realization value cannot exceed budget value', 400);
  }

  await apbdes.update({
    nilaiRealisasi,
    updatedBy: req.user.id
  });

  logger.info({
    type: 'APBDES_REALISASI_UPDATED',
    apbdesId: apbdes.id,
    nilaiRealisasi,
    updatedBy: req.user.id
  });

  res.json({
    success: true,
    data: apbdes
  });
});

// Get APBDes statistics and analysis
const getAPBDesStats = catchAsync(async (req, res) => {
  const { tahunAnggaran } = req.query;
  const whereClause = tahunAnggaran ? { tahunAnggaran } : {};

  const stats = await Promise.all([
    // Overall budget stats
    APBDes.findAll({
      where: whereClause,
      attributes: [
        'tahunAnggaran',
        'jenis',
        [sequelize.fn('SUM', sequelize.col('nilaiAnggaran')), 'totalAnggaran'],
        [sequelize.fn('SUM', sequelize.col('nilaiRealisasi')), 'totalRealisasi']
      ],
      group: ['tahunAnggaran', 'jenis']
    }),

    // Status distribution
    APBDes.count({
      where: whereClause,
      group: ['status']
    }),

    // Source distribution
    APBDes.count({
      where: whereClause,
      group: ['sumberDana']
    })
  ]);

  const [budgetStats, statusDistribution, sourceDistribution] = stats;

  // Process budget stats
  const processedStats = budgetStats.reduce((acc, stat) => {
    const year = stat.tahunAnggaran;
    if (!acc[year]) {
      acc[year] = {
        PENDAPATAN: { anggaran: 0, realisasi: 0 },
        BELANJA: { anggaran: 0, realisasi: 0 },
        PEMBIAYAAN: { anggaran: 0, realisasi: 0 }
      };
    }
    acc[year][stat.jenis] = {
      anggaran: parseFloat(stat.get('totalAnggaran')) || 0,
      realisasi: parseFloat(stat.get('totalRealisasi')) || 0
    };
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      budgetStats: processedStats,
      statusDistribution: statusDistribution.reduce((acc, curr) => {
        acc[curr.status] = curr.count;
        return acc;
      }, {}),
      sourceDistribution: sourceDistribution.reduce((acc, curr) => {
        acc[curr.sumberDana] = curr.count;
        return acc;
      }, {})
    }
  });
});

module.exports = {
  getAllAPBDes,
  getAPBDesSummary,
  createAPBDes,
  updateAPBDes,
  updateRealisasi,
  getAPBDesStats
};
