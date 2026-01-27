const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply authentication to all routes (sauf webhooks)
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Legacy routes (maintained for backward compatibility)
router.post('/process', 
  SecurityMiddleware.withPermissions('payments.create'),
  paymentsController.processPayment
);

router.post('/templates/purchase', 
  SecurityMiddleware.withPermissions('payments.create'),
  paymentsController.purchaseTemplate
);

router.post('/webhooks/:gateway', 
  ValidationMiddleware.validate({
    params: {
      gateway: Joi.string().valid('stripe', 'paypal', 'cinetpay').required()
    }
  }),
  paymentsController.handleWebhook
);

router.get('/status/:transactionId', 
  SecurityMiddleware.withPermissions('payments.read'),
  ValidationMiddleware.validateParams({
    transactionId: Joi.string().required()
  }),
  paymentsController.getPaymentStatus
);

router.get('/statistics', 
  SecurityMiddleware.withPermissions('payments.read'),
  ValidationMiddleware.validateQuery({
    period: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
    gateway: Joi.string().valid('stripe', 'paypal', 'cinetpay').optional()
  }),
  paymentsController.getPaymentStatistics
);

router.get('/gateways', 
  SecurityMiddleware.withPermissions('payments.read'),
  paymentsController.getAvailableGateways
);

// Service Info routes
router.get('/', (req, res) => {
  res.json({
    service: 'Payment API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      // Legacy endpoints
      process: 'POST /process',
      purchase: 'POST /templates/purchase',
      status: 'GET /status/:transactionId',
      statistics: 'GET /statistics',
      gateways: 'GET /gateways',
      webhooks: 'POST /webhooks/:gateway',
      // New structured endpoints
      stripe: {
        paymentIntent: 'POST /api/payments/stripe/payment-intent',
        paymentIntentGet: 'GET /api/payments/stripe/payment-intent/:id',
        confirm: 'POST /api/payments/stripe/confirm',
        customers: 'POST /api/payments/stripe/customers',
        customerGet: 'GET /api/payments/stripe/customers/:id',
        paymentMethods: 'POST /api/payments/stripe/payment-methods',
        customerPaymentMethods: 'GET /api/payments/stripe/customers/:id/payment-methods'
      },
      paypal: {
        orders: 'POST /api/payments/paypal/orders',
        orderGet: 'GET /api/payments/paypal/orders/:id',
        capture: 'POST /api/payments/paypal/orders/:id/capture',
        invoices: 'POST /api/payments/paypal/invoices',
        invoiceGet: 'GET /api/payments/paypal/invoices/:id'
      },
      refunds: {
        stripe: 'POST /api/payments/refunds/stripe',
        paypal: 'POST /api/payments/refunds/paypal',
        status: 'GET /api/payments/refunds/:id',
        list: 'GET /api/payments/refunds'
      },
      invoices: {
        generate: 'POST /api/payments/invoices/generate',
        get: 'GET /api/payments/invoices/:id',
        download: 'GET /api/payments/invoices/:id/download',
        list: 'GET /api/payments/invoices'
      },
      paymentMethods: {
        add: 'POST /api/payments/payment-methods',
        list: 'GET /api/payments/payment-methods',
        update: 'PUT /api/payments/payment-methods/:id',
        delete: 'DELETE /api/payments/payment-methods/:id'
      }
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
