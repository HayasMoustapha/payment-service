const express = require('express');
const Joi = require('joi');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

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

// Stripe Payment Intents
router.post('/payment-intent', 
  ValidationMiddleware.validate(createPaymentIntentSchema),
  stripeController.createPaymentIntent
);

router.get('/payment-intent/:paymentIntentId',
  ValidationMiddleware.validate(Joi.object({
    paymentIntentId: Joi.string().required()
  }), 'params'),
  stripeController.getPaymentIntent
);

router.post('/confirm',
  ValidationMiddleware.validate(confirmPaymentSchema),
  stripeController.confirmPaymentIntent
);

// Stripe Customers
router.post('/customers',
  ValidationMiddleware.validate(createCustomerSchema),
  stripeController.createCustomer
);

router.get('/customers/:customerId',
  ValidationMiddleware.validate(Joi.object({
    customerId: Joi.string().required()
  }), 'params'),
  stripeController.getCustomer
);

// Stripe Payment Methods
router.post('/payment-methods',
  ValidationMiddleware.validate(createPaymentMethodSchema),
  stripeController.createPaymentMethod
);

router.get('/customers/:customerId/payment-methods',
  ValidationMiddleware.validate(Joi.object({
    customerId: Joi.string().required()
  }), 'params'),
  stripeController.getCustomerPaymentMethods
);

module.exports = router;
