const bcrypt = require('bcryptjs');
const { sequelize, User, DesaProfile } = require('../models');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    // Sync database with force option in development only
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: true });
      logger.info('Database synchronized (tables recreated)');
    } else {
      await sequelize.sync();
      logger.info('Database synchronized');
    }

    // Check if admin user exists
    const adminExists = await User.findOne({
      where: { role: 'admin_desa' }
    });

    if (!adminExists) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        email: 'admin@desadigital.com',
        password: hashedPassword,
        role: 'admin_desa',
        isActive: true
      });
      logger.info('Default admin user created');
    }

    // Check if desa profile exists
    const profileExists = await DesaProfile.findOne();

    if (!profileExists) {
      // Create default desa profile
      await DesaProfile.create({
        namaDesa: 'Desa Digital',
        kecamatan: 'Kecamatan Digital',
        kabupaten: 'Kabupaten Digital',
        provinsi: 'Provinsi Digital',
        kodePos: '12345',
        alamatKantor: 'Jl. Desa Digital No. 1',
        email: 'kontak@desadigital.com',
        telepon: '021-1234567',
        website: 'https://desadigital.com',
        visi: 'Mewujudkan Desa Digital yang Maju dan Sejahtera',
        misi: JSON.stringify([
          'Mengembangkan infrastruktur digital desa',
          'Meningkatkan pelayanan publik berbasis teknologi',
          'Memberdayakan masyarakat melalui literasi digital'
        ]),
        updatedBy: 1 // Admin user ID
      });
      logger.info('Default desa profile created');
    }

    // Create test users if in development
    if (process.env.NODE_ENV === 'development') {
      const testUsers = [
        {
          username: 'perangkat',
          email: 'perangkat@desadigital.com',
          password: await bcrypt.hash('perangkat123', 10),
          role: 'perangkat_desa',
          isActive: true
        },
        {
          username: 'warga',
          email: 'warga@desadigital.com',
          password: await bcrypt.hash('warga123', 10),
          role: 'warga',
          isActive: true
        }
      ];

      await User.bulkCreate(testUsers);
      logger.info('Test users created');

      // Create test data for other models
      // TODO: Add test data creation for other models
    }

    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

// Execute if running directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  initializeDatabase()
    .then(() => {
      logger.info('Database initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database initialization script failed:', error);
      process.exit(1);
    });
}

module.exports = initializeDatabase;
