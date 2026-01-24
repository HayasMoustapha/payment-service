const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { authenticate, requireStripeWebhook, requirePayPalWebhook, requireAPIKey } = require('../../../shared');
const { requirePermission } = require('../../../shared');
const logger = require('../../utils/logger');

/**
 * Routes pour les paiements
 */

// Middleware d'authentification pour la plupart des routes
router.use(authenticate);

// Routes Stripe
// POST /api/payments/stripe/payment-intent - Créer un Payment Intent
router.post('/stripe/payment-intent',
  requirePermission('payments.stripe.create'),
  paymentsController.createStripePaymentIntent
);

// POST /api/payments/stripe/checkout-session - Créer une Checkout Session
router.post('/stripe/checkout-session',
  requirePermission('payments.stripe.create'),
  paymentsController.createStripeCheckoutSession
);

// GET /api/payments/stripe/customers/:customerId - Récupérer un client Stripe
router.get('/stripe/customers/:customerId',
  requirePermission('payments.customers.read'),
  paymentsController.getStripeCustomer
);

// POST /api/payments/stripe/customers - Créer un client Stripe
router.post('/stripe/customers',
  requirePermission('payments.customers.create'),
  paymentsController.createStripeCustomer
);

// POST /api/payments/stripe/payment-methods - Créer une méthode de paiement
router.post('/stripe/payment-methods',
  requirePermission('payments.payment-methods.create'),
  paymentsController.createStripePaymentMethod
);

// GET /api/payments/stripe/customers/:customerId/payment-methods - Lister les méthodes de paiement
router.get('/stripe/customers/:customerId/payment-methods',
  requirePermission('payments.payment-methods.read'),
  paymentsController.listStripePaymentMethods
);

// Routes PayPal
// POST /api/payments/paypal/orders - Créer un ordre PayPal
router.post('/paypal/orders',
  requirePermission('payments.paypal.create'),
  paymentsController.createPayPalOrder
);

// POST /api/payments/paypal/orders/:orderId/capture - Capturer un paiement PayPal
router.post('/paypal/orders/:orderId/capture',
  requirePermission('payments.paypal.capture'),
  paymentsController.capturePayPalPayment
);

// Routes de paiement génériques
// GET /api/payments/:paymentId/:provider - Récupérer les détails d'un paiement
router.get('/:paymentId/:provider',
  requirePermission('payments.read'),
  paymentsController.getPayment
);

// DELETE /api/payments/:paymentId/:provider/cancel - Annuler un paiement
router.delete('/:paymentId/:provider/cancel',
  requirePermission('payments.cancel'),
  paymentsController.cancelPayment
);

// Routes de remboursement
// POST /api/payments/refunds - Créer un remboursement
router.post('/refunds',
  requirePermission('payments.refunds.create'),
  paymentsController.createRefund
);

// GET /api/payments/refunds/:refundId/:provider - Récupérer les détails d'un remboursement
router.get('/refunds/:refundId/:provider',
  requirePermission('payments.refunds.read'),
  paymentsController.getRefund
);

// GET /api/payments/refunds - Lister les remboursements de l'utilisateur
router.get('/refunds',
  requirePermission('payments.refunds.read'),
  paymentsController.listUserRefunds
);

// Routes de facturation
// POST /api/payments/invoices - Générer une facture
router.post('/invoices',
  requirePermission('payments.invoices.create'),
  paymentsController.generateInvoice
);

// GET /api/payments/invoices/:invoiceId/download - Télécharger une facture PDF
router.get('/invoices/:invoiceId/download',
  requirePermission('payments.invoices.read'),
  paymentsController.downloadInvoice
);

// Routes de santé et statistiques
// GET /api/payments/health - Vérifier la santé du service
router.get('/health',
  paymentsController.healthCheck
);

// GET /api/payments/stats - Récupérer les statistiques du service
router.get('/stats',
  requirePermission('payments.stats.read'),
  paymentsController.getStats
);

// Routes de webhooks (pas d'authentification requise, validation par signature)

// POST /api/payments/webhooks/stripe - Webhook Stripe
router.post('/webhooks/stripe',
  requireStripeWebhook(),
  async (req, res) => {
    try {
      const stripeService = require('../../core/stripe/stripe.service');
      const logger = require('../../utils/logger');
      
      // Traiter le webhook Stripe
      const result = await stripeService.processWebhook(req.rawBody, req.stripeSignature);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      // Traiter les différents types d'événements
      const event = result.event;
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        case 'payment_intent.canceled':
          await handlePaymentCanceled(event.data.object);
          break;
        case 'charge.succeeded':
          await handleChargeSucceeded(event.data.object);
          break;
        case 'charge.failed':
          await handleChargeFailed(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        default:
          logger.webhook('Unhandled Stripe webhook event', {
            eventType: event.type,
            eventId: event.id
          });
      }

      return res.status(200).json({ 
        success: true,
        received: true 
      });
    } catch (error) {
      logger.error('Stripe webhook processing failed', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  }
);

// POST /api/payments/webhooks/paypal - Webhook PayPal
router.post('/webhooks/paypal',
  requirePayPalWebhook(),
  async (req, res) => {
    try {
      const paypalService = require('../../core/paypal/paypal.service');
      const logger = require('../../utils/logger');
      
      // Traiter le webhook PayPal
      const result = await paypalService.verifyWebhook(req.body, req.paypalWebhookHeaders);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      // Traiter les différents types d'événements
      const webhook = result.webhook;
      
      switch (webhook.eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await handlePayPalPaymentCaptured(webhook.resource);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await handlePayPalPaymentDenied(webhook.resource);
          break;
        case 'CHECKOUT.ORDER.APPROVED':
          await handlePayPalOrderApproved(webhook.resource);
          break;
        case 'CHECKOUT.ORDER.COMPLETED':
          await handlePayPalOrderCompleted(webhook.resource);
          break;
        default:
          logger.webhook('Unhandled PayPal webhook event', {
            eventType: webhook.eventType,
            resourceId: webhook.resource?.id
          });
      }

      return res.status(200).json({ 
        success: true,
        received: true 
      });
    } catch (error) {
      logger.error('PayPal webhook processing failed', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  }
);

// Fonctions de traitement des webhooks Stripe
async function handlePaymentSucceeded(paymentIntent) {
  logger.webhook('Payment succeeded', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    customerId: paymentIntent.customer
  });

  // Envoyer une notification de confirmation
  try {
    const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL;
    const notificationServiceToken = process.env.NOTIFICATION_SERVICE_TOKEN;
    
    if (notificationServiceUrl && notificationServiceToken) {
      const axios = require('axios');
      
      await axios.post(
        `${notificationServiceUrl}/api/notifications/email`,
        {
          to: paymentIntent.receipt_email || 'customer@example.com',
          template: 'payment-confirmation',
          data: {
            payment: {
              id: paymentIntent.id,
              amount: paymentIntent.amount / 100,
              currency: paymentIntent.currency
            },
            event: {
              title: paymentIntent.description || 'Paiement réussi'
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${notificationServiceToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error) {
    logger.error('Failed to send payment confirmation notification', {
      error: error.message,
      paymentIntentId: paymentIntent.id
    });
  }
}

async function handlePaymentFailed(paymentIntent) {
  logger.webhook('Payment failed', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    lastPaymentError: paymentIntent.last_payment_error
  });
}

async function handlePaymentCanceled(paymentIntent) {
  logger.webhook('Payment canceled', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100
  });
}

async function handleChargeSucceeded(charge) {
  logger.webhook('Charge succeeded', {
    chargeId: charge.id,
    amount: charge.amount / 100,
    paymentIntentId: charge.payment_intent
  });
}

async function handleChargeFailed(charge) {
  logger.webhook('Charge failed', {
    chargeId: charge.id,
    amount: charge.amount / 100,
    failureCode: charge.failure_code,
    failureMessage: charge.failure_message
  });
}

async function handleInvoicePaymentSucceeded(invoice) {
  logger.webhook('Invoice payment succeeded', {
    invoiceId: invoice.id,
    amount: invoice.amount_paid / 100,
    customerId: invoice.customer
  });
}

async function handleInvoicePaymentFailed(invoice) {
  logger.webhook('Invoice payment failed', {
    invoiceId: invoice.id,
    amount: invoice.amount_due / 100,
    customerId: invoice.customer
  });
}

async function handleSubscriptionCreated(subscription) {
  logger.webhook('Subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  });
}

async function handleSubscriptionUpdated(subscription) {
  logger.webhook('Subscription updated', {
    subscriptionId: subscription.id,
    status: subscription.status
  });
}

async function handleSubscriptionDeleted(subscription) {
  logger.webhook('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  });
}

// Fonctions de traitement des webhooks PayPal
async function handlePayPalPaymentCaptured(capture) {
  logger.webhook('PayPal payment captured', {
    captureId: capture.id,
    amount: capture.amount?.value,
    currency: capture.amount?.currency_code
  });
}

async function handlePayPalPaymentDenied(capture) {
  logger.webhook('PayPal payment denied', {
    captureId: capture.id,
    status: capture.status
  });
}

async function handlePayPalOrderApproved(order) {
  logger.webhook('PayPal order approved', {
    orderId: order.id,
    status: order.status
  });
}

async function handlePayPalOrderCompleted(order) {
  logger.webhook('PayPal order completed', {
    orderId: order.id,
    status: order.status
  });
}

module.exports = router;
