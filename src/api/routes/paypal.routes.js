const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paypalController = require('../controllers/paypal.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply authentication to all routes (sauf webhooks)
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Validation schemas
const createOrderSchema = Joi.object({
  amount: Joi.object({
    currency_code: Joi.string().required(),
    value: Joi.string().required()
  }).required(),
  description: Joi.string().required(),
  returnUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().optional()
});

const captureOrderSchema = Joi.object({
  orderId: Joi.string().required(),
  amount: Joi.object({
    currency_code: Joi.string().required(),
    value: Joi.string().required()
  }).optional()
});

// PayPal Orders
router.post('/orders', 
  SecurityMiddleware.withPermissions('payments.create'),
  ValidationMiddleware.validate({ body: createOrderSchema }),
  paypalController.createOrder
);

router.get('/orders/:orderId', 
  SecurityMiddleware.withPermissions('payments.read'),
  paypalController.getOrder
);

router.post('/orders/:orderId/capture', 
  SecurityMiddleware.withPermissions('payments.update'),
  ValidationMiddleware.validateParams({
    orderId: Joi.string().required()
  }),
  ValidationMiddleware.validate({ body: captureOrderSchema }),
  paypalController.captureOrder
);

module.exports = router;
