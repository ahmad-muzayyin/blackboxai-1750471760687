const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require('../config/database.js')[env];
const logger = require('../utils/loggerManager');
const metrics = require('../utils/metricsManager');

const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      ...config,
      logging: (msg) => logger.debug(msg),
      benchmark: true,
      hooks: {
        beforeQuery: (options) => {
          options.startTime = process.hrtime();
        },
        afterQuery: (options) => {
          const [seconds, nanoseconds] = process.hrtime(options.startTime);
          const duration = seconds + nanoseconds / 1e9;
          
          metrics.observeHistogram('db_query_duration_seconds', duration, {
            type: options.type,
            model: options.model?.name || 'unknown'
          });
        }
      }
    }
  );
}

// Read all model files and import them
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Set up model associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add utility methods to db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Add health check method
db.checkConnection = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      message: 'Database connection is active'
    };
  } catch (error) {
    logger.error('Database connection error:', error);
    return {
      status: 'unhealthy',
      message: 'Unable to connect to database',
      error: error.message
    };
  }
};

// Add transaction wrapper
db.transaction = async (callback) => {
  const t = await sequelize.transaction();
  try {
    const result = await callback(t);
    await t.commit();
    return result;
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

// Add bulk operation wrapper with chunking
db.bulkOperation = async (Model, operation, data, options = {}) => {
  const chunkSize = options.chunkSize || 1000;
  const results = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkResult = await Model[operation](chunk, options);
    results.push(...(Array.isArray(chunkResult) ? chunkResult : [chunkResult]));
  }
  
  return results;
};

// Add cache wrapper (if using cache)
db.withCache = async (key, callback, ttl = 3600) => {
  const cache = require('../utils/cacheManager');
  let result = await cache.get(key);
  
  if (!result) {
    result = await callback();
    await cache.set(key, result, ttl);
  }
  
  return result;
};

// Add search wrapper
db.search = async (Model, query, options = {}) => {
  const { Op } = Sequelize;
  const searchableFields = options.fields || Object.keys(Model.rawAttributes);
  const whereClause = {};
  
  searchableFields.forEach(field => {
    whereClause[field] = {
      [Op.like]: `%${query}%`
    };
  });
  
  return await Model.findAll({
    where: {
      [Op.or]: whereClause
    },
    ...options
  });
};

// Error handler for database errors
sequelize.error = (error) => {
  metrics.incrementCounter('db_errors_total', {
    type: error.name
  });
  
  logger.error('Database error:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  
  throw error;
};

// Export the db object
module.exports = db;
