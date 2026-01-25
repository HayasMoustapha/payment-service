const express = require('express');
const router = express.Router();
const refundsController = require('../controllers/refunds.controller');
const { authenticate, requirePermission } = require('../../../../shared');
const { validate } = require('../../middleware/validation');
const Joi = require('joi');

// Validation schemas
const createStripeRefundSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  amount: Joi.number().integer().min(100).optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').default('requested_by_customer'),
  metadata: Joi.object().optional()
});

const createPayPalRefundSchema = Joi.object({
  captureId: Joi.string().required(),
  amount: Joi.object({
    currency_code: Joi.string().required(),
    value: Joi.string().required()
  }).optional(),
  reason: Joi.string().default('Customer requested refund')
});

// Apply authentication to all routes
router.use(authenticate);

// Stripe Refunds
router.post('/stripe',
  requirePermission('refunds.create'),
  validate(createStripeRefundSchema),
  refundsController.createStripeRefund
);

// PayPal Refunds
router.post('/paypal',
  requirePermission('refunds.create'),
  validate(createPayPalRefundSchema),
  refundsController.createPayPalRefund
);

// Get Refund Status
router.get('/:refundId',
  requirePermission('refunds.read'),
  refundsController.getRefundStatus
);

// List Refunds
router.get('/',
  requirePermission('refunds.read'),
  refundsController.listRefunds
);

module.exports = router;
