// Importation des modules nécessaires pour les routes de paiements
const express = require('express'); // Framework web Node.js
const Joi = require('joi'); // Bibliothèque de validation de schémas
const router = express.Router(); // Crée un routeur Express
const paymentsController = require('../controllers/payments.controller'); // Contrôleur des paiements
const { ValidationMiddleware } = require('../../../../shared'); // Middleware de validation
const paymentErrorHandler = require('../../error/payment.errorHandler'); // Gestionnaire d'erreurs

// APPLICATION DU GESTIONNAIRE D'ERREURS : Appliqué à toutes les routes de paiement
// Cela permet de capturer les erreurs spécifiques aux paiements
router.use(paymentErrorHandler);

// ROUTES LEGACY : Anciennes routes maintenues pour compatibilité ascendante
// Ces routes assurent que les anciens clients continuent de fonctionner

/**
 * ROUTE 1 : Traiter un paiement
 * Méthode : POST
 * URL : /api/payments/payments/process
 * Description : Crée une nouvelle transaction de paiement
 */
router.post('/process', 
  // MIDDLEWARE DE VALIDATION : Vérifie que les données sont valides avant d'appeler le contrôleur
  ValidationMiddleware.validate(Joi.object({
    amount: Joi.number().required(), // Montant requis (nombre)
    currency: Joi.string().default('eur'), // Devise, 'eur' par défaut
    gateway: Joi.string().valid('stripe', 'paypal', 'cinetpay').required(), // Passerelle requise
    customerEmail: Joi.string().email().required(), // Email valide requis
    description: Joi.string().required() // Description requise
  })),
  paymentsController.processPayment // Contrôleur qui traite le paiement
);

/**
 * ROUTE 2 : Acheter un template
 * Méthode : POST
 * URL : /api/payments/payments/templates/purchase
 * Description : Achète un template (design, modèle, etc.)
 */
router.post('/templates/purchase', 
  // VALIDATION : Vérifie les données d'achat de template
  ValidationMiddleware.validate(Joi.object({
    templateId: Joi.string().required(), // ID du template requis
    customerEmail: Joi.string().email().required(), // Email valide requis
    paymentMethod: Joi.string().required() // Méthode de paiement requise
  })),
  paymentsController.purchaseTemplate // Contrôleur pour l'achat de template
);

/**
 * ROUTE 3 : Webhooks des passerelles
 * Méthode : POST
 * URL : /api/payments/payments/webhooks/:gateway
 * Description : Reçoit les notifications des passerelles (Stripe, PayPal)
 */
router.post('/webhooks/:gateway', 
  // VALIDATION : Vérifie le paramètre de la passerelle
  ValidationMiddleware.validate(Joi.object({
    gateway: Joi.string().valid('stripe', 'paypal', 'cinetpay').required() // Passerelle valide requise
  }), 'params'), // Spécifie que la validation s'applique aux paramètres d'URL
  paymentsController.handleWebhook // Contrôleur pour traiter les webhooks
);

/**
 * ROUTE 4 : Statut d'une transaction
 * Méthode : GET
 * URL : /api/payments/payments/status/:transactionId
 * Description : Récupère le statut d'une transaction spécifique
 */
router.get('/status/:transactionId', 
  // VALIDATION : Vérifie l'ID de transaction
  ValidationMiddleware.validate(Joi.object({
    transactionId: Joi.string().required() // ID de transaction requis
  }), 'params'), // Validation sur les paramètres d'URL
  paymentsController.getPaymentStatus // Contrôleur pour obtenir le statut
);

/**
 * ROUTE 5 : Statistiques des paiements
 * Méthode : GET
 * URL : /api/payments/payments/statistics
 * Description : Récupère les statistiques des paiements
 */
router.get('/statistics', 
  paymentsController.getPaymentStatistics // Pas de validation, contrôleur direct
);

/**
 * ROUTE 6 : Passerelles disponibles
 * Méthode : GET
 * URL : /api/payments/payments/gateways
 * Description : Liste les passerelles de paiement disponibles
 */
router.get('/gateways', 
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
