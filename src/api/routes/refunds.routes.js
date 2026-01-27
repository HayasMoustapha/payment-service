const express = require('express');
const Joi = require('joi');
const router = express.Router();
const refundsController = require('../controllers/refunds.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply authentication to all routes
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Validation schemas
const createStripeRefundSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  amount: Joi.number().integer().min(100).optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').default('requested_by_customer'),
  metadata: Joi.object().optional()
});

const createPayPalRefundSchema = Joi.object({
  paymentId: Joi.string().required(),
  amount: Joi.number().integer().min(100).optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').default('requested_by_customer'),
  note: Joi.string().optional()
});

// Stripe refunds
router.post('/stripe', 
  SecurityMiddleware.withPermissions('refunds.create'),
  ValidationMiddleware.validate({ body: createStripeRefundSchema }),
  refundsController.createStripeRefund
);

router.get('/stripe/:refundId', 
  SecurityMiddleware.withPermissions('refunds.read'),
  ValidationMiddleware.validateParams({
    refundId: Joi.string().required()
  }),
  refundsController.getRefundStatus
);

// PayPal refunds
router.post('/paypal', 
  SecurityMiddleware.withPermissions('refunds.create'),
  ValidationMiddleware.validate({ body: createPayPalRefundSchema }),
  refundsController.createPayPalRefund
);

// Generic refund status
router.get('/status/:refundId', 
  SecurityMiddleware.withPermissions('refunds.read'),
  ValidationMiddleware.validateParams({
    refundId: Joi.string().required()
  }),
  refundsController.getRefundStatus
);

// List refunds
router.get('/', 
  SecurityMiddleware.withPermissions('refunds.read'),
  ValidationMiddleware.validateQuery({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    gateway: Joi.string().valid('stripe', 'paypal').optional()
  }),
  refundsController.listRefunds
);

module.exports = router;
