const express = require('express');
const Joi = require('joi');
const router = express.Router();
const refundsController = require('../controllers/refunds.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

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
  ValidationMiddleware.validate(createStripeRefundSchema),
  refundsController.createStripeRefund
);

router.get('/stripe/:refundId', 
  ValidationMiddleware.validate(Joi.object({
    refundId: Joi.string().required()
  }), 'params'),
  refundsController.getRefundStatus
);

// PayPal refunds
router.post('/paypal', 
  ValidationMiddleware.validate(createPayPalRefundSchema),
  refundsController.createPayPalRefund
);

// Generic refund status
router.get('/status/:refundId', 
  ValidationMiddleware.validate(Joi.object({
    refundId: Joi.string().required()
  }), 'params'),
  refundsController.getRefundStatus
);

// List refunds
router.get('/', 
  refundsController.listRefunds
);

module.exports = router;
