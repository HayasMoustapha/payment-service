const crypto = require('crypto');
const logger = require('../../utils/logger');
const webhookRetryService = require('./core/webhooks/webhook-retry.service');

/**
 * Controller pour le service de paiement
 * Gère les endpoints HTTP pour les opérations de paiement avec Stripe/PayPal
 * 
 * Principes :
 * - Communication synchrone HTTP
 * - Intégration Stripe et PayPal
 * - Gestion des paiements et refunds
 * - Génération de factures PDF
 * - Webhooks pour les callbacks ET communication avec Event-Planner-Core
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');

/**
 * Initialise un paiement
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function initiatePayment(req, res) {
  try {
    const {
      payment_intent_id,
      event_id,
      organizer_id,
      amount,
      currency,
      payment_method,
      customer_info,
      metadata
    } = req.body;
    
    console.log(`[PAYMENT_CONTROLLER] Initialisation paiement ${payment_intent_id} via ${payment_method}`);
    
    // Validation des données
    if (!payment_intent_id || !event_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Données obligatoires manquantes',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    let paymentResponse;
    
    switch (payment_method) {
      case 'stripe':
        paymentResponse = await initiateStripePayment({
          payment_intent_id,
          amount,
          currency,
          customer_info,
          metadata
        });
        break;
        
      case 'paypal':
        paymentResponse = await initiatePayPalPayment({
          payment_intent_id,
          amount,
          currency,
          customer_info,
          metadata
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Méthode de paiement non supportée',
          code: 'UNSUPPORTED_PAYMENT_METHOD'
        });
    }
    
    // Persistance locale du paiement
    await persistPayment({
      payment_intent_id,
      event_id,
      organizer_id,
      payment_service_id: paymentResponse.payment_service_id,
      amount,
      currency,
      payment_method,
      customer_info,
      metadata,
      status: 'pending'
    });
    
    res.status(201).json({
      success: true,
      data: {
        payment_intent_id,
        payment_service_id: paymentResponse.payment_service_id,
        payment_url: paymentResponse.payment_url,
        client_secret: paymentResponse.client_secret,
        payment_method: payment_method,
        amount: amount,
        currency: currency,
        status: 'pending'
      }
    });
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur initialisation paiement:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'initialisation du paiement',
      code: 'PAYMENT_INIT_ERROR'
    });
  }
}

/**
 * Initialise un paiement via Stripe
 * @param {Object} paymentData - Données du paiement
 * @returns {Promise<Object>} Réponse Stripe
 */
async function initiateStripePayment(paymentData) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentData.amount * 100), // Stripe utilise les cents
      currency: paymentData.currency.toLowerCase(),
      metadata: {
        payment_intent_id: paymentData.payment_intent_id,
        event_id: paymentData.metadata?.event_id,
        ...paymentData.metadata
      },
      automatic_payment_methods: {
        enabled: true
      },
      receipt_email: paymentData.customer_info?.email
    });
    
    return {
      payment_service_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      payment_url: null // Stripe utilise le client_secret côté frontend
    };
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur Stripe:', error.message);
    throw new Error(`Erreur Stripe: ${error.message}`);
  }
}

/**
 * Initialise un paiement via PayPal
 * @param {Object} paymentData - Données du paiement
 * @returns {Promise<Object>} Réponse PayPal
 */
async function initiatePayPalPayment(paymentData) {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: paymentData.payment_intent_id,
        description: paymentData.metadata?.description || 'Paiement Event Planner',
        amount: {
          currency_code: paymentData.currency.toUpperCase(),
          value: paymentData.amount.toString()
        },
        custom_id: paymentData.payment_intent_id
      }],
      application_context: {
        return_url: paymentData.metadata?.return_url,
        cancel_url: paymentData.metadata?.cancel_url,
        brand_name: 'Event Planner',
        locale: 'fr-FR',
        user_action: 'PAY_NOW'
      }
    });
    
    const client = () => new paypal.core.PayPalHttpClient(getPayPalEnvironment());
    const response = await client().execute(request);
    
    const order = response.result;
    
    // Récupération de l'URL de redirection
    const approvalUrl = order.links.find(link => link.rel === 'approve')?.href;
    
    return {
      payment_service_id: order.id,
      client_secret: null,
      payment_url: approvalUrl
    };
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur PayPal:', error.message);
    throw new Error(`Erreur PayPal: ${error.message}`);
  }
}

/**
 * Récupère le statut d'un paiement
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getPaymentStatus(req, res) {
  try {
    const { paymentServiceId } = req.params;
    
    // Récupération du paiement local
    const localPayment = await getLocalPayment(paymentServiceId);
    
    if (!localPayment) {
      return res.status(404).json({
        success: false,
        error: 'Paiement non trouvé',
        code: 'PAYMENT_NOT_FOUND'
      });
    }
    
    let serviceStatus;
    
    switch (localPayment.payment_method) {
      case 'stripe':
        serviceStatus = await getStripePaymentStatus(paymentServiceId);
        break;
        
      case 'paypal':
        serviceStatus = await getPayPalPaymentStatus(paymentServiceId);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Méthode de paiement non supportée',
          code: 'UNSUPPORTED_PAYMENT_METHOD'
        });
    }
    
    // Mise à jour du statut local si nécessaire
    if (serviceStatus.status !== localPayment.status) {
      await updatePaymentStatus(paymentServiceId, {
        status: serviceStatus.status,
        completed_at: serviceStatus.completed_at,
        error_message: serviceStatus.error_message
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        payment_intent_id: localPayment.payment_intent_id,
        payment_service_id: paymentServiceId,
        status: serviceStatus.status,
        amount: localPayment.amount,
        currency: localPayment.currency,
        payment_method: localPayment.payment_method,
        completed_at: serviceStatus.completed_at,
        error_message: serviceStatus.error_message
      }
    });
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur récupération statut:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du statut',
      code: 'STATUS_ERROR'
    });
  }
}

/**
 * Annule un paiement
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function cancelPayment(req, res) {
  try {
    const { paymentServiceId } = req.params;
    const { reason } = req.body;
    
    // Récupération du paiement local
    const localPayment = await getLocalPayment(paymentServiceId);
    
    if (!localPayment) {
      return res.status(404).json({
        success: false,
        error: 'Paiement non trouvé',
        code: 'PAYMENT_NOT_FOUND'
      });
    }
    
    if (localPayment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Seuls les paiements en attente peuvent être annulés',
        code: 'PAYMENT_NOT_CANCELLABLE'
      });
    }
    
    let cancelResult;
    
    switch (localPayment.payment_method) {
      case 'stripe':
        cancelResult = await cancelStripePayment(paymentServiceId);
        break;
        
      case 'paypal':
        cancelResult = await cancelPayPalPayment(paymentServiceId);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Méthode de paiement non supportée',
          code: 'UNSUPPORTED_PAYMENT_METHOD'
        });
    }
    
    // Mise à jour du statut local
    await updatePaymentStatus(paymentServiceId, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });
    
    res.status(200).json({
      success: true,
      data: {
        payment_intent_id: localPayment.payment_intent_id,
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur annulation paiement:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'annulation du paiement',
      code: 'CANCEL_ERROR'
    });
  }
}

/**
 * Traite un webhook Stripe
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function handleStripeWebhook(req, res) {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!sig || !webhookSecret) {
      return res.status(400).json({
        success: false,
        error: 'Signature webhook manquante',
        code: 'MISSING_WEBHOOK_SIGNATURE'
      });
    }
    
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    console.log(`[PAYMENT_CONTROLLER] Webhook Stripe reçu: ${event.type}`);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
        
      case 'payment_intent.canceled':
        await handlePaymentCancellation(event.data.object);
        break;
        
      default:
        console.log(`[PAYMENT_CONTROLLER] Webhook Stripe non géré: ${event.type}`);
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur webhook Stripe:', error.message);
    res.status(400).json({
      success: false,
      error: 'Webhook invalide',
      code: 'INVALID_WEBHOOK'
    });
  }
}

/**
 * Traite un webhook PayPal
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function handlePayPalWebhook(req, res) {
  try {
    const webhookEvent = req.body;
    
    console.log(`[PAYMENT_CONTROLLER] Webhook PayPal reçu: ${webhookEvent.event_type}`);
    
    switch (webhookEvent.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePayPalPaymentSuccess(webhookEvent.resource);
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePayPalPaymentFailure(webhookEvent.resource);
        break;
        
      default:
        console.log(`[PAYMENT_CONTROLLER] Webhook PayPal non géré: ${webhookEvent.event_type}`);
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur webhook PayPal:', error.message);
    res.status(400).json({
      success: false,
      error: 'Webhook invalide',
      code: 'INVALID_WEBHOOK'
    });
  }
}

/**
 * Gère le succès d'un paiement
 * @param {Object} paymentData - Données du paiement
 */
async function handlePaymentSuccess(paymentData) {
  try {
    const paymentIntentId = paymentData.metadata?.payment_intent_id;
    
    if (!paymentIntentId) {
      console.warn('[PAYMENT_CONTROLLER] payment_intent_id manquant dans le webhook');
      return;
    }
    
    await updatePaymentStatusByIntentId(paymentIntentId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // Émission du webhook vers event-planner-core
    await emitPaymentWebhook(paymentIntentId, 'completed', {
      payment_service_id: paymentData.id,
      completed_at: new Date().toISOString()
    });
    
    console.log(`[PAYMENT_CONTROLLER] Paiement ${paymentIntentId} marqué comme complété`);
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur traitement succès paiement:', error.message);
  }
}

/**
 * Gère l'échec d'un paiement
 * @param {Object} paymentData - Données du paiement
 */
async function handlePaymentFailure(paymentData) {
  try {
    const paymentIntentId = paymentData.metadata?.payment_intent_id;
    
    if (!paymentIntentId) {
      console.warn('[PAYMENT_CONTROLLER] payment_intent_id manquant dans le webhook');
      return;
    }
    
    await updatePaymentStatusByIntentId(paymentIntentId, {
      status: 'failed',
      error_message: paymentData.last_payment_error?.message || 'Paiement échoué'
    });
    
    // Émission du webhook vers event-planner-core
    await emitPaymentWebhook(paymentIntentId, 'failed', {
      payment_service_id: paymentData.id,
      error_message: paymentData.last_payment_error?.message
    });
    
    console.log(`[PAYMENT_CONTROLLER] Paiement ${paymentIntentId} marqué comme échoué`);
    
  } catch (error) {
    console.error('[PAYMENT_CONTROLLER] Erreur traitement échec paiement:', error.message);
  }
}

/**
 * Fonctions utilitaires (à implémenter avec la base de données)
 */
async function persistPayment(paymentData) {
  // TODO: Implémenter la persistance en base de données
  console.log(`[PAYMENT_CONTROLLER] Persistance paiement ${paymentData.payment_intent_id}`);
}

async function getLocalPayment(paymentServiceId) {
  // TODO: Implémenter la récupération depuis la base de données
  console.log(`[PAYMENT_CONTROLLER] Récupération paiement ${paymentServiceId}`);
  return null;
}

async function updatePaymentStatus(paymentServiceId, updateData) {
  // TODO: Implémenter la mise à jour en base de données
  console.log(`[PAYMENT_CONTROLLER] Mise à jour statut paiement ${paymentServiceId}: ${updateData.status}`);
}

async function updatePaymentStatusByIntentId(paymentIntentId, updateData) {
  // TODO: Implémenter la mise à jour par payment_intent_id
  console.log(`[PAYMENT_CONTROLLER] Mise à jour statut par intent ${paymentIntentId}: ${updateData.status}`);
}

/**
 * Émet un webhook vers Event-Planner-Core pour informer du statut du paiement
 * @param {string} paymentIntentId - ID de l'intention de paiement
 * @param {string} status - Statut du paiement (completed, failed, canceled)
 * @param {Object} data - Données supplémentaires du paiement
 */
async function emitPaymentWebhook(paymentIntentId, status, data) {
  try {
    const EVENT_CORE_SERVICE_URL = process.env.EVENT_CORE_SERVICE_URL || 'http://localhost:3001';
    
    const webhookPayload = {
      eventType: `payment.${status}`,
      paymentIntentId: paymentIntentId,
      status: status,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        source: 'payment-service',
        payment_service_id: data.payment_service_id,
        gateway: data.gateway || 'stripe',
        amount: data.amount,
        currency: data.currency || 'EUR',
        completed_at: data.completed_at || new Date().toISOString(),
        error_message: data.error_message || null
      }
    };
    
    console.log(`[PAYMENT_CONTROLLER] Envoi webhook à Event-Planner-Core: ${paymentIntentId} -> ${status}`);
    
    const response = await fetch(`${EVENT_CORE_SERVICE_URL}/api/internal/payment-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': 'payment-service',
        'X-Request-ID': `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        'X-Timestamp': new Date().toISOString(),
        'X-Webhook-Signature': generateWebhookSignature(webhookPayload)
      },
      body: JSON.stringify(webhookPayload)
    });
    
    if (!response.ok) {
      throw new Error(`Event-Planner-Core responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`[PAYMENT_CONTROLLER] Webhook accepté par Event-Planner-Core:`, result);
    
    return {
      success: true,
      webhookId: result.webhookId || paymentIntentId,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[PAYMENT_CONTROLLER] Erreur envoi webhook à Event-Planner-Core:`, error.message);
    
    // Ajouter à la queue de retry
    const webhookData = {
      status: status,
      data: {
        ...data,
        payment_service_id: data.payment_service_id,
        gateway: data.gateway || 'stripe',
        amount: data.amount,
        currency: data.currency || 'EUR',
        completed_at: data.completed_at || new Date().toISOString(),
        error_message: data.error_message || null
      }
    };
    
    const retryAdded = webhookRetryService.addToRetryQueue(paymentIntentId, webhookData);
    
    return {
      success: false,
      error: error.message,
      willRetry: retryAdded,
      retryAttempt: retryAdded ? 1 : null,
      maxRetries: webhookRetryService.maxRetries
    };
  }
}

/**
 * Génère une signature pour le webhook
 * @param {Object} payload - Données du webhook
 * @returns {string} Signature HMAC-SHA256
 */
function generateWebhookSignature(payload) {
  const webhookSecret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
  const payloadString = JSON.stringify(payload);
  
  return crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString, 'utf8')
    .digest('hex');
}

function getPayPalEnvironment() {
  // TODO: Implémenter la configuration PayPal
  return process.env.NODE_ENV === 'production' 
    ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
    : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
}

async function getStripePaymentStatus(paymentServiceId) {
  // TODO: Implémenter la récupération du statut Stripe
  return { status: 'pending' };
}

async function getPayPalPaymentStatus(paymentServiceId) {
  // TODO: Implémenter la récupération du statut PayPal
  return { status: 'pending' };
}

async function cancelStripePayment(paymentServiceId) {
  // TODO: Implémenter l'annulation Stripe
  return { cancelled: true };
}

async function cancelPayPalPayment(paymentServiceId) {
  // TODO: Implémenter l'annulation PayPal
  return { cancelled: true };
}

async function handlePaymentCancellation(paymentData) {
  // TODO: Implémenter la gestion d'annulation
  console.log(`[PAYMENT_CONTROLLER] Paiement annulé: ${paymentData.id}`);
}

async function handlePayPalPaymentSuccess(paymentData) {
  // TODO: Implémenter la gestion succès PayPal
  console.log(`[PAYMENT_CONTROLLER] Paiement PayPal réussi: ${paymentData.id}`);
}

async function handlePayPalPaymentFailure(paymentData) {
  // TODO: Implémenter la gestion échec PayPal
  console.log(`[PAYMENT_CONTROLLER] Paiement PayPal échoué: ${paymentData.id}`);
}

module.exports = {
  initiatePayment,
  getPaymentStatus,
  cancelPayment,
  handleStripeWebhook,
  handlePayPalWebhook
};
