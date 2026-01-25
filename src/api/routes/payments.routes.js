const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const logger = require('../../utils/logger');

/**
 * Routes pour les paiements - Version simplifiée pour test
 */

// Middleware d'authentification pour la plupart des routes
// router.use(authenticate); // Désactivé pour le test

// Routes principales avec PaymentService
router.post('/process', paymentsController.processPayment);
router.post('/templates/purchase', paymentsController.purchaseTemplate);
router.post('/webhooks/:gateway', paymentsController.handleWebhook);
router.get('/status/:transactionId', paymentsController.getPaymentStatus);
router.get('/statistics', paymentsController.getPaymentStatistics);
router.get('/gateways', paymentsController.getAvailableGateways);

// Route racine pour test
router.get('/', (req, res) => {
  res.json({
    service: 'Payment API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      process: 'POST /process',
      purchase: 'POST /templates/purchase',
      status: 'GET /status/:transactionId',
      statistics: 'GET /statistics',
      gateways: 'GET /gateways',
      webhooks: 'POST /webhooks/:gateway'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
