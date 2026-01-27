const express = require('express');
const Joi = require('joi');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../../event-planner-saas/event-planner-backend/shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply authentication to all routes (sauf webhooks)
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(paymentErrorHandler);

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
