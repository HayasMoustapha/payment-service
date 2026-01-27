const express = require('express');
const Joi = require('joi');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
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

// Apply authentication to all routes (sauf webhooks)
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Stripe Payment Intents
router.post('/payment-intent', 
  SecurityMiddleware.withPermissions('payments.create'),
  ValidationMiddleware.validate({ body: createPaymentIntentSchema }),
  stripeController.createPaymentIntent
);

router.get('/payment-intent/:paymentIntentId',
  SecurityMiddleware.withPermissions('payments.read'),
  ValidationMiddleware.validateParams({
    paymentIntentId: Joi.string().required()
  }),
  stripeController.getPaymentIntent
);

router.post('/confirm',
  SecurityMiddleware.withPermissions('payments.update'),
  ValidationMiddleware.validate({ body: confirmPaymentSchema }),
  stripeController.confirmPaymentIntent
);

// Stripe Customers
router.post('/customers',
  SecurityMiddleware.withPermissions('customers.create'),
  ValidationMiddleware.validate({ body: createCustomerSchema }),
  stripeController.createCustomer
);

router.get('/customers/:customerId',
  SecurityMiddleware.withPermissions('customers.read'),
  ValidationMiddleware.validateParams({
    customerId: Joi.string().required()
  }),
  stripeController.getCustomer
);

// Stripe Payment Methods
router.post('/payment-methods',
  SecurityMiddleware.withPermissions('payment-methods.create'),
  ValidationMiddleware.validate({ body: createPaymentMethodSchema }),
  stripeController.createPaymentMethod
);

router.get('/customers/:customerId/payment-methods',
  SecurityMiddleware.withPermissions('payment-methods.read'),
  ValidationMiddleware.validateParams({
    customerId: Joi.string().required()
  }),
  stripeController.getCustomerPaymentMethods
);

module.exports = router;
