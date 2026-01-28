const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paymentMethodsController = require('../controllers/payment-methods.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Validation schemas
const addPaymentMethodSchema = Joi.object({
  type: Joi.string().valid('card', 'bank_account', 'paypal', 'stripe').required(),
  provider: Joi.string().valid('stripe', 'paypal', 'cinetpay').required(),
  token: Joi.string().required(),
  isDefault: Joi.boolean().default(false),
  metadata: Joi.object().optional()
});

const updatePaymentMethodSchema = Joi.object({
  isDefault: Joi.boolean().optional(),
  metadata: Joi.object().optional()
});

// Get user payment methods
router.get('/', 
  paymentMethodsController.getUserPaymentMethods
);

// Add payment method
router.post('/', 
  ValidationMiddleware.validate(addPaymentMethodSchema),
  paymentMethodsController.addPaymentMethod
);

// Update payment method
router.put('/:methodId', 
  ValidationMiddleware.validate(Joi.object({
    methodId: Joi.string().required()
  }), 'params'),
  ValidationMiddleware.validate(updatePaymentMethodSchema),
  paymentMethodsController.updatePaymentMethod
);

// Delete payment method
router.delete('/:methodId', 
  ValidationMiddleware.validate(Joi.object({
    methodId: Joi.string().required()
  }), 'params'),
  paymentMethodsController.deletePaymentMethod
);

module.exports = router;
