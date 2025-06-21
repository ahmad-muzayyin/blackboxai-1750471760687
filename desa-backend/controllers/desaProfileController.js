const { DesaProfile, User } = require('../models');
const { ValidationError } = require('../utils/errorManager');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/loggerManager');
const metrics = require('../utils/metricsManager');

/**
 * Get active desa profile
 * @route GET /api/desa/profile
 */
exports.getDesaProfile = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const profile = await DesaProfile.getActiveProfile();
    
    if (!profile) {
      throw new ValidationError('Desa profile not found');
    }

    trackProfileMetrics('getDesaProfile', startTime, true);

    return res.json(
      responseFormatter.success(profile)
    );
  } catch (error) {
    trackProfileMetrics('getDesaProfile', startTime, false);
    next(error);
  }
};

/**
 * Create or update desa profile
 * @route PUT /api/desa/profile
 */
exports.updateDesaProfile = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const {
      namaDesa,
      kodeDesa,
      kecamatan,
      kabupaten,
      provinsi,
      kodePos,
      alamat,
      telepon,
      email,
      website,
      visi,
      misi,
      luasWilayah,
      batasWilayah,
      jumlahDusun,
      jumlahRW,
      jumlahRT,
      dataGeografis,
      potensiDesa
    } = req.body;

    // Get existing profile or create new one
    let profile = await DesaProfile.getActiveProfile();
    
    if (!profile) {
      profile = await DesaProfile.create({
        namaDesa,
        kodeDesa,
        kecamatan,
        kabupaten,
        provinsi,
        kodePos,
        alamat,
        telepon,
        email,
        website,
        visi,
        misi,
        luasWilayah,
        batasWilayah,
        jumlahDusun,
        jumlahRW,
        jumlahRT,
        dataGeografis,
        potensiDesa,
        updatedBy: req.user.id
      });

      trackProfileMetrics('createDesaProfile', startTime, true);

      return res.status(201).json(
        responseFormatter.created(profile, 'Desa profile created successfully')
      );
    }

    // Update existing profile
    await profile.updateProfile({
      namaDesa,
      kodeDesa,
      kecamatan,
      kabupaten,
      provinsi,
      kodePos,
      alamat,
      telepon,
      email,
      website,
      visi,
      misi,
      luasWilayah,
      batasWilayah,
      jumlahDusun,
      jumlahRW,
      jumlahRT,
      dataGeografis,
      potensiDesa
    }, req.user.id);

    trackProfileMetrics('updateDesaProfile', startTime, true);

    return res.json(
      responseFormatter.success(profile, 'Desa profile updated successfully')
    );
  } catch (error) {
    trackProfileMetrics('updateDesaProfile', startTime, false);
    next(error);
  }
};

/**
 * Update desa logo
 * @route PUT /api/desa/profile/logo
 */
exports.updateLogo = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const profile = await DesaProfile.getActiveProfile();
    
    if (!profile) {
      throw new ValidationError('Desa profile not found');
    }

    const { logoUrl } = req.body;

    await profile.update({
      logoUrl,
      updatedBy: req.user.id
    });

    trackProfileMetrics('updateLogo', startTime, true);

    return res.json(
      responseFormatter.success(profile, 'Logo updated successfully')
    );
  } catch (error) {
    trackProfileMetrics('updateLogo', startTime, false);
    next(error);
  }
};

/**
 * Get desa statistics
 * @route GET /api/desa/statistics
 */
exports.getDesaStatistics = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const profile = await DesaProfile.getActiveProfile();
    
    if (!profile) {
      throw new ValidationError('Desa profile not found');
    }

    // Get various statistics from different models
    const [pendudukStats, suratStats, bantuanStats] = await Promise.all([
      // Get penduduk statistics from view
      profile.sequelize.query('SELECT * FROM vw_penduduk_summary', {
        type: profile.sequelize.QueryTypes.SELECT
      }),

      // Get surat statistics from view
      profile.sequelize.query('SELECT * FROM vw_surat_status', {
        type: profile.sequelize.QueryTypes.SELECT
      }),

      // Get bantuan sosial statistics
      profile.sequelize.query(`
        SELECT 
          COUNT(DISTINCT bs.id) as total_program,
          COUNT(DISTINCT bsp.penduduk_id) as total_penerima,
          SUM(bs.nilai_manfaat) as total_manfaat
        FROM bantuan_sosial bs
        LEFT JOIN bantuan_sosial_penerima bsp ON bs.id = bsp.bantuan_id
        WHERE bs.status = 'active'
      `, {
        type: profile.sequelize.QueryTypes.SELECT
      })
    ]);

    trackProfileMetrics('getDesaStatistics', startTime, true);

    return res.json(
      responseFormatter.success({
        profile: {
          namaDesa: profile.namaDesa,
          kecamatan: profile.kecamatan,
          kabupaten: profile.kabupaten,
          provinsi: profile.provinsi,
          luasWilayah: profile.luasWilayah,
          jumlahDusun: profile.jumlahDusun,
          jumlahRW: profile.jumlahRW,
          jumlahRT: profile.jumlahRT
        },
        penduduk: pendudukStats[0],
        layanan: {
          surat: suratStats,
          bantuanSosial: bantuanStats[0]
        }
      })
    );
  } catch (error) {
    trackProfileMetrics('getDesaStatistics', startTime, false);
    next(error);
  }
};

// Helper function to track metrics
function trackProfileMetrics(operation, startTime, success) {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const duration = seconds + nanoseconds / 1e9;

  metrics.observeHistogram('desa_profile_operation_duration_seconds', duration, {
    operation
  });

  metrics.incrementCounter('desa_profile_operations_total', {
    operation,
    success: success.toString()
  });
}
