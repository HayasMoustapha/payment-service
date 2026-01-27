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
  refundsController.getStripeRefund
);

router.get('/stripe', 
  SecurityMiddleware.withPermissions('refunds.read'),
  refundsController.listStripeRefunds
);

// PayPal refunds
router.post('/paypal', 
  SecurityMiddleware.withPermissions('refunds.create'),
  ValidationMiddleware.validate({ body: createPayPalRefundSchema }),
  refundsController.createPayPalRefund
);

router.get('/paypal/:refundId', 
  SecurityMiddleware.withPermissions('refunds.read'),
  ValidationMiddleware.validateParams({
    refundId: Joi.string().required()
  }),
  refundsController.getPayPalRefund
);

router.get('/paypal', 
  SecurityMiddleware.withPermissions('refunds.read'),
  refundsController.listPayPalRefunds
);

// Generic refund status
router.get('/status/:refundId', 
  SecurityMiddleware.withPermissions('refunds.read'),
  ValidationMiddleware.validateParams({
    refundId: Joi.string().required()
  }),
  refundsController.getRefundStatus
);

// Refund statistics
router.get('/statistics', 
  SecurityMiddleware.withPermissions('refunds.read'),
  ValidationMiddleware.validateQuery({
    period: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
    gateway: Joi.string().valid('stripe', 'paypal').optional()
  }),
  refundsController.getRefundStatistics
);

module.exports = router;
