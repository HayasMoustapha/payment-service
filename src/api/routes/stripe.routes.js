const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');
const { authenticate, requirePermission } = require('../../../../shared');
const { injectUserContext } = require('../../../../shared/context-middleware');
const { validate } = require('../../middleware/validation');
const Joi = require('joi');

// Validation schemas
const createPaymentIntentSchema = Joi.object({
  amount: Joi.number().integer().min(100).required(),
  currency: Joi.string().default('eur'),
  customerEmail: Joi.string().email().required(),
  description: Joi.string().required(),
  metadata: Joi.object().optional()
});

const createCustomerSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().required(),
  phone: Joi.string().optional()
});

const createPaymentMethodSchema = Joi.object({
  customerId: Joi.string().required(),
  paymentMethodId: Joi.string().required(),
  isDefault: Joi.boolean().default(false)
});

const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  paymentMethodId: Joi.string().required()
});

// Apply authentication to all routes
router.use(authenticate);

// Stripe Payment Intents
router.post('/payment-intent', 
  requirePermission('payments.create'),
  validate(createPaymentIntentSchema),
  stripeController.createPaymentIntent
);

router.get('/payment-intent/:paymentIntentId',
  requirePermission('payments.read'),
  stripeController.getPaymentIntent
);

router.post('/confirm',
  requirePermission('payments.update'),
  validate(confirmPaymentSchema),
  stripeController.confirmPaymentIntent
);

// Stripe Customers
router.post('/customers',
  requirePermission('customers.create'),
  validate(createCustomerSchema),
  stripeController.createCustomer
);

router.get('/customers/:customerId',
  requirePermission('customers.read'),
  stripeController.getCustomer
);

// Stripe Payment Methods
router.post('/payment-methods',
  requirePermission('payment-methods.create'),
  validate(createPaymentMethodSchema),
  stripeController.createPaymentMethod
);

router.get('/customers/:customerId/payment-methods',
  requirePermission('payment-methods.read'),
  stripeController.getCustomerPaymentMethods
);

module.exports = router;
