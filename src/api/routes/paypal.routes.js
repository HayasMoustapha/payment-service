const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paypalController = require('../controllers/paypal.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

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
  ValidationMiddleware.validate({ body: createOrderSchema }),
  paypalController.createOrder
);

router.get('/orders/:orderId', 
  ValidationMiddleware.validateParams({
    orderId: Joi.string().required()
  }),
  paypalController.getOrder
);

router.post('/orders/:orderId/capture', 
  ValidationMiddleware.validateParams({
    orderId: Joi.string().required()
  }),
  ValidationMiddleware.validate({ body: captureOrderSchema }),
  paypalController.captureOrder
);

module.exports = router;
