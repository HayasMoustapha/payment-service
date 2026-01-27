const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paypalController = require('../controllers/paypal.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../../event-planner-saas/event-planner-backend/shared');
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
  orderId: Joi.string().required()
});

const createInvoiceSchema = Joi.object({
  amount: Joi.object({
    currency_code: Joi.string().required(),
    value: Joi.string().required()
  }).required(),
  description: Joi.string().required(),
  merchantInfo: Joi.object({
    email: Joi.string().email().required()
  }).required(),
  billingInfo: Joi.array().items(
    Joi.object({
      email: Joi.string().email().required(),
      name: Joi.object({
        given_name: Joi.string().required(),
        surname: Joi.string().required()
      }).required()
    })
  ).required()
});

// Apply authentication to all routes
router.use(authenticate);

// PayPal Orders
router.post('/orders',
  requirePermission('payments.create'),
  validate(createOrderSchema),
  paypalController.createOrder
);

router.get('/orders/:orderId',
  requirePermission('payments.read'),
  paypalController.getOrder
);

router.post('/orders/:orderId/capture',
  requirePermission('payments.update'),
  validate(captureOrderSchema),
  paypalController.captureOrder
);

// PayPal Invoices
router.post('/invoices',
  requirePermission('invoices.create'),
  validate(createInvoiceSchema),
  paypalController.createInvoice
);

router.get('/invoices/:invoiceId',
  requirePermission('invoices.read'),
  paypalController.getInvoice
);

module.exports = router;
