const express = require('express');
const router = express.Router();
const paymentMethodsController = require('../controllers/payment-methods.controller');
const { authenticate, requirePermission } = require('../../../../shared');
const { validate } = require('../../middleware/validation');
const Joi = require('joi');

// Validation schemas
const addPaymentMethodSchema = Joi.object({
  type: Joi.string().valid('card', 'sepa_debit', 'ideal').required(),
  card: Joi.object({
    number: Joi.string().required(),
    exp_month: Joi.number().integer().min(1).max(12).required(),
    exp_year: Joi.number().integer().min(2024).required(),
    cvc: Joi.string().required()
  }).when('type', {
    is: 'card',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  billing_details: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional(),
    address: Joi.object({
      line1: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().optional(),
      postal_code: Joi.string().required(),
      country: Joi.string().required()
    }).optional()
  }).required(),
  isDefault: Joi.boolean().default(false)
});

const updatePaymentMethodSchema = Joi.object({
  isDefault: Joi.boolean().optional(),
  metadata: Joi.object().optional()
});

// Apply authentication to all routes
router.use(authenticate);

// Add Payment Method
router.post('/',
  requirePermission('payment-methods.create'),
  validate(addPaymentMethodSchema),
  paymentMethodsController.addPaymentMethod
);

// Get User Payment Methods
router.get('/',
  requirePermission('payment-methods.read'),
  paymentMethodsController.getUserPaymentMethods
);

// Update Payment Method
router.put('/:paymentMethodId',
  requirePermission('payment-methods.update'),
  validate(updatePaymentMethodSchema),
  paymentMethodsController.updatePaymentMethod
);

// Delete Payment Method
router.delete('/:paymentMethodId',
  requirePermission('payment-methods.delete'),
  paymentMethodsController.deletePaymentMethod
);

module.exports = router;
