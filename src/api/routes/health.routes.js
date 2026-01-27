const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require(../../../shared)))))');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Health check route (no authentication required)
router.get('/',
  ValidationMiddleware.validate({
    query: Joi.object({
      detailed: Joi.boolean().default(false)
    })
  }),
  healthController.getHealthCheck
);

// Detailed health check (authentication required)
router.get('/detailed',
  SecurityMiddleware.authenticated(),
  ValidationMiddleware.validateQuery({
    detailed: Joi.boolean().default(true)
  }),
  healthController.getDetailedHealthCheck
);

// Service status (authentication required)
router.get('/status',
  SecurityMiddleware.authenticated(),
  ValidationMiddleware.validateQuery({
    service: Joi.string().optional()
  }),
  healthController.getServiceStatus
);

// Database status (authentication required)
router.get('/database',
  SecurityMiddleware.authenticated(),
  healthController.getDatabaseStatus
);

// External services status (authentication required)
router.get('/external',
  SecurityMiddleware.authenticated(),
  ValidationMiddleware.validateQuery({
    service: Joi.string().optional()
  }),
  healthController.getExternalServicesStatus
);

// Metrics (authentication required)
router.get('/metrics',
  SecurityMiddleware.authenticated(),
  healthController.getMetrics
);

module.exports = router;
