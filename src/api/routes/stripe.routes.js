const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');
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

// Stripe Payment Intents
router.post('/payment-intent', 
  validate(createPaymentIntentSchema),
  stripeController.createPaymentIntent
);

router.get('/payment-intent/:paymentIntentId',
  stripeController.getPaymentIntent
);

router.post('/confirm',
  validate(confirmPaymentSchema),
  stripeController.confirmPaymentIntent
);

// Stripe Checkout Sessions
router.post('/checkout-session',
  stripeController.createCheckoutSession
);

// Stripe Customers
router.post('/customers',
  validate(createCustomerSchema),
  stripeController.createCustomer
);

router.get('/customers/:customerId',
  stripeController.getCustomer
);

// Stripe Payment Methods
router.post('/payment-methods',
  stripeController.createPaymentMethod
);

router.post('/payment-methods/attach',
  stripeController.attachPaymentMethod
);

// Webhook handling
router.post('/webhook',
  stripeController.processWebhook
);

module.exports = router;
