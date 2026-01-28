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
  ValidationMiddleware.validate({ body: addPaymentMethodSchema }),
  paymentMethodsController.addPaymentMethod
);

// Update payment method
router.put('/:methodId', 
  ValidationMiddleware.validateParams({
    methodId: Joi.string().required()
  }),
  ValidationMiddleware.validate({ body: updatePaymentMethodSchema }),
  paymentMethodsController.updatePaymentMethod
);

// Delete payment method
router.delete('/:methodId', 
  ValidationMiddleware.validateParams({
    methodId: Joi.string().required()
  }),
  paymentMethodsController.deletePaymentMethod
);

module.exports = router;
