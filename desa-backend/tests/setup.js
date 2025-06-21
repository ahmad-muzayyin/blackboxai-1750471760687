const { sequelize } = require('../models');
const logger = require('../utils/logger');

module.exports = async () => {
  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Sync test database
    await sequelize.sync({ force: true });
    logger.info('Test database synchronized');

  } catch (error) {
    logger.error('Test setup failed:', error);
    throw error;
  }
};
