const { sequelize } = require('../models');
const logger = require('../utils/logger');

module.exports = async () => {
  try {
    // Close database connection
    await sequelize.close();
    logger.info('Test database connection closed');

  } catch (error) {
    logger.error('Test teardown failed:', error);
    throw error;
  }
};
