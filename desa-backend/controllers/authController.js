const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { ValidationError } = require('../utils/errorManager');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/loggerManager');
const metrics = require('../utils/metricsManager');
const config = require('../utils/configManager');

/**
 * Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const { username, email, password, role = 'warga' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [User.sequelize.Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      throw new ValidationError('User already exists', {
        field: existingUser.username === username ? 'username' : 'email'
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      role
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Track metrics
    trackAuthMetrics('register', startTime, true);

    return res.status(201).json(
      responseFormatter.success({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }, 'User registered successfully')
    );
  } catch (error) {
    trackAuthMetrics('register', startTime, false);
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new ValidationError('Invalid email or password');
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new ValidationError('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ValidationError('Account is inactive');
    }

    // Update last login
    await user.update({
      lastLogin: new Date()
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Track metrics
    trackAuthMetrics('login', startTime, true);

    return res.json(
      responseFormatter.success({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }, 'Login successful')
    );
  } catch (error) {
    trackAuthMetrics('login', startTime, false);
    next(error);
  }
};

/**
 * Refresh access token
 * @route POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.get('jwt.refreshSecret'));
    
    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      throw new ValidationError('Invalid refresh token');
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    // Track metrics
    trackAuthMetrics('refreshToken', startTime, true);

    return res.json(
      responseFormatter.success({
        accessToken
      }, 'Token refreshed successfully')
    );
  } catch (error) {
    trackAuthMetrics('refreshToken', startTime, false);
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/profile
 */
exports.getProfile = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new ValidationError('User not found');
    }

    // Track metrics
    trackAuthMetrics('getProfile', startTime, true);

    return res.json(
      responseFormatter.success({
        user
      })
    );
  } catch (error) {
    trackAuthMetrics('getProfile', startTime, false);
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/auth/profile
 */
exports.updateProfile = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      throw new ValidationError('User not found');
    }

    // If updating password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        throw new ValidationError('Current password is required');
      }

      const isValidPassword = await user.validatePassword(currentPassword);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }
    }

    // Update user
    await user.update({
      username: username || user.username,
      email: email || user.email,
      password: newPassword || user.password
    });

    // Track metrics
    trackAuthMetrics('updateProfile', startTime, true);

    return res.json(
      responseFormatter.success({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }, 'Profile updated successfully')
    );
  } catch (error) {
    trackAuthMetrics('updateProfile', startTime, false);
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  const startTime = process.hrtime();
  try {
    // In a more complex implementation, you might want to invalidate the token
    // by adding it to a blacklist or removing refresh tokens from the database

    // Track metrics
    trackAuthMetrics('logout', startTime, true);

    return res.json(
      responseFormatter.success(null, 'Logged out successfully')
    );
  } catch (error) {
    trackAuthMetrics('logout', startTime, false);
    next(error);
  }
};

// Helper Functions

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    config.get('jwt.secret'),
    {
      expiresIn: config.get('jwt.expiresIn')
    }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id
    },
    config.get('jwt.refreshSecret'),
    {
      expiresIn: config.get('jwt.refreshExpiresIn')
    }
  );
}

function trackAuthMetrics(operation, startTime, success) {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const duration = seconds + nanoseconds / 1e9;

  metrics.observeHistogram('auth_operation_duration_seconds', duration, {
    operation
  });

  metrics.incrementCounter('auth_operations_total', {
    operation,
    success: success.toString()
  });
}
