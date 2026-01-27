const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');

// Legacy routes (maintained for backward compatibility)
router.post('/process', paymentsController.processPayment);
router.post('/templates/purchase', paymentsController.purchaseTemplate);
router.post('/webhooks/:gateway', paymentsController.handleWebhook);
router.get('/status/:transactionId', paymentsController.getPaymentStatus);
router.get('/statistics', paymentsController.getPaymentStatistics);
router.get('/gateways', paymentsController.getAvailableGateways);

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
        get: 'GET /api/payments/refunds/:id',
        list: 'GET /api/payments/refunds'
      },
      wallets: {
        create: 'POST /api/payments/wallets',
        get: 'GET /api/payments/wallets/:id',
        balance: 'GET /api/payments/wallets/:id/balance',
        transactions: 'GET /api/payments/wallets/:id/transactions'
      },
      paymentMethods: {
        create: 'POST /api/payments/payment-methods',
        get: 'GET /api/payments/payment-methods/:id',
        list: 'GET /api/payments/payment-methods',
        delete: 'DELETE /api/payments/payment-methods/:id'
      },
      invoices: {
        create: 'POST /api/payments/invoices',
        get: 'GET /api/payments/invoices/:id',
        list: 'GET /api/payments/invoices',
        pay: 'POST /api/payments/invoices/:id/pay'
      }
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
