const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paymentMethodsController = require('../controllers/payment-methods.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply authentication to all routes
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

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
  SecurityMiddleware.withPermissions('payment-methods.read'),
  paymentMethodsController.getUserPaymentMethods
);

// Add payment method
router.post('/', 
  SecurityMiddleware.withPermissions('payment-methods.create'),
  ValidationMiddleware.validate({ body: addPaymentMethodSchema }),
  paymentMethodsController.addPaymentMethod
);

// Update payment method
router.put('/:methodId', 
  SecurityMiddleware.withPermissions('payment-methods.update'),
  ValidationMiddleware.validateParams({
    methodId: Joi.string().required()
  }),
  ValidationMiddleware.validate({ body: updatePaymentMethodSchema }),
  paymentMethodsController.updatePaymentMethod
);

// Delete payment method
router.delete('/:methodId', 
  SecurityMiddleware.withPermissions('payment-methods.delete'),
  ValidationMiddleware.validateParams({
    methodId: Joi.string().required()
  }),
  paymentMethodsController.deletePaymentMethod
);

// Set default payment method
router.post('/:methodId/default', 
  SecurityMiddleware.withPermissions('payment-methods.update'),
  ValidationMiddleware.validateParams({
    methodId: Joi.string().required()
  }),
  paymentMethodsController.setDefaultPaymentMethod
);

// Get available payment methods
router.get('/available', 
  SecurityMiddleware.withPermissions('payment-methods.read'),
  paymentMethodsController.getAvailablePaymentMethods
);

// Validate payment method
router.post('/validate', 
  ValidationMiddleware.validate({
    body: Joi.object({
      type: Joi.string().required(),
      token: Joi.string().required(),
      provider: Joi.string().required()
    })
  }),
  paymentMethodsController.validatePaymentMethod
);

module.exports = router;
