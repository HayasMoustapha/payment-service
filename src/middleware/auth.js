const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT tokens and sets user context
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Access token required'
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Set user in request
    req.user = decoded;
    req.userId = decoded.id;
    
    logger.auth('User authenticated', {
      userId: decoded.id,
      email: decoded.email
    });

    next();
  } catch (error) {
    logger.error('Authentication failed', {
      error: error.message,
      token: req.header('Authorization')?.substring(0, 20) + '...'
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

module.exports = {
  authenticate
};
