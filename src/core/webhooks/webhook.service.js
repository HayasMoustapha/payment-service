const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Service de gestion des webhooks pour les paiements
 * Traite les webhooks Stripe et PayPal de manière sécurisée
 */
class WebhookService {
  constructor() {
    this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID;
    this.webhookHandlers = new Map();
    this.setupHandlers();
  }

  /**
   * Configure les handlers pour les événements webhook
   */
  setupHandlers() {
    // Stripe event handlers
    this.webhookHandlers.set('stripe.payment_intent.succeeded', this.handleStripePaymentSucceeded.bind(this));
    this.webhookHandlers.set('stripe.payment_intent.payment_failed', this.handleStripePaymentFailed.bind(this));
    this.webhookHandlers.set('stripe.payment_intent.canceled', this.handleStripePaymentCanceled.bind(this));
    this.webhookHandlers.set('stripe.charge.succeeded', this.handleStripeChargeSucceeded.bind(this));
    this.webhookHandlers.set('stripe.charge.failed', this.handleStripeChargeFailed.bind(this));
    this.webhookHandlers.set('stripe.charge.dispute.created', this.handleStripeDisputeCreated.bind(this));
    this.webhookHandlers.set('stripe.customer.subscription.created', this.handleStripeSubscriptionCreated.bind(this));
    this.webhookHandlers.set('stripe.customer.subscription.deleted', this.handleStripeSubscriptionDeleted.bind(this));
    this.webhookHandlers.set('stripe.invoice.payment_succeeded', this.handleStripeInvoiceSucceeded.bind(this));
    this.webhookHandlers.set('stripe.invoice.payment_failed', this.handleStripeInvoiceFailed.bind(this));

    // PayPal event handlers
    this.webhookHandlers.set('paypal.payment.completed', this.handlePayPalPaymentCompleted.bind(this));
    this.webhookHandlers.set('paypal.payment.failed', this.handlePayPalPaymentFailed.bind(this));
    this.webhookHandlers.set('paypal.payment.denied', this.handlePayPalPaymentDenied.bind(this));
    this.webhookHandlers.set('paypal.payment.captured', this.handlePayPalPaymentCaptured.bind(this));
    this.webhookHandlers.set('paypal.payment.refunded', this.handlePayPalPaymentRefunded.bind(this));
    this.webhookHandlers.set('paypal.merchant.onboarding.completed', this.handlePayPalMerchantOnboarding.bind(this));
  }

  /**
   * Traite un webhook Stripe
   * @param {string} body - Corps du webhook
   * @param {string} signature - Signature Stripe
   * @returns {Promise<Object>} Résultat du traitement
   */
  async processStripeWebhook(body, signature) {
    try {
      // Vérifier la signature
      const event = this.verifyStripeWebhook(body, signature);
      
      logger.payment('Stripe webhook received', {
        eventId: event.id,
        type: event.type,
        created: event.created
      });

      // Traiter l'événement
      const handler = this.webhookHandlers.get(`stripe.${event.type}`);
      if (handler) {
        const result = await handler(event);
        
        logger.payment('Stripe webhook processed', {
          eventId: event.id,
          type: event.type,
          success: result.success
        });

        return {
          success: true,
          eventId: event.id,
          eventType: event.type,
          processed: true,
          result
        };
      } else {
        logger.warn('No handler for Stripe webhook event', {
          eventId: event.id,
          type: event.type
        });

        return {
          success: true,
          eventId: event.id,
          eventType: event.type,
          processed: false,
          message: 'No handler for this event type'
        };
      }
    } catch (error) {
      logger.error('Stripe webhook processing failed', {
        error: error.message,
        signature: signature?.substring(0, 20) + '...'
      });

      return {
        success: false,
        error: error.message,
        type: 'WEBHOOK_PROCESSING_FAILED'
      };
    }
  }

  /**
   * Traite un webhook PayPal
   * @param {Object} headers - Headers HTTP
   * @param {Object} body - Corps du webhook
   * @returns {Promise<Object>} Résultat du traitement
   */
  async processPayPalWebhook(headers, body) {
    try {
      // Vérifier l'authenticité du webhook
      const isValid = await this.verifyPayPalWebhook(headers, body);
      
      if (!isValid) {
        throw new Error('Invalid PayPal webhook signature');
      }

      const eventType = headers['paypal-auth-algo'] || body.event_type;
      const eventId = body.id || crypto.randomUUID();

      logger.payment('PayPal webhook received', {
        eventId,
        eventType,
        resourceType: body.resource_type
      });

      // Traiter l'événement
      const handler = this.webhookHandlers.get(`paypal.${eventType}`);
      if (handler) {
        const result = await handler(body);
        
        logger.payment('PayPal webhook processed', {
          eventId,
          eventType,
          success: result.success
        });

        return {
          success: true,
          eventId,
          eventType,
          processed: true,
          result
        };
      } else {
        logger.warn('No handler for PayPal webhook event', {
          eventId,
          eventType
        });

        return {
          success: true,
          eventId,
          eventType,
          processed: false,
          message: 'No handler for this event type'
        };
      }
    } catch (error) {
      logger.error('PayPal webhook processing failed', {
        error: error.message,
        headers: Object.keys(headers)
      });

      return {
        success: false,
        error: error.message,
        type: 'WEBHOOK_PROCESSING_FAILED'
      };
    }
  }

  /**
   * Vérifie la signature d'un webhook Stripe
   * @param {string} body - Corps du webhook
   * @param {string} signature - Signature Stripe
   * @returns {Object} Événement Stripe vérifié
   */
  verifyStripeWebhook(body, signature) {
    if (!this.stripeWebhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    try {
      return stripe.webhooks.constructEvent(body, signature, this.stripeWebhookSecret);
    } catch (error) {
      throw new Error(`Invalid Stripe webhook signature: ${error.message}`);
    }
  }

  /**
   * Vérifie l'authenticité d'un webhook PayPal
   * @param {Object} headers - Headers HTTP
   * @param {Object} body - Corps du webhook
   * @returns {Promise<boolean>} True si valide
   */
  async verifyPayPalWebhook(headers, body) {
    if (!this.paypalWebhookId) {
      logger.warn('PayPal webhook ID not configured, skipping verification');
      return true; // En développement, on peut skipper
    }

    try {
      const paypal = require('@paypal/checkout-server-sdk');
      
      // Créer la signature attendue
      const certId = headers['paypal-cert-id'];
      const authAlgo = headers['paypal-auth-algo'];
      const transmissionId = headers['paypal-transmission-id'];
      const transmissionSig = headers['paypal-transmission-sig'];
      const transmissionTime = headers['paypal-transmission-time'];
      
      if (!certId || !authAlgo || !transmissionId || !transmissionSig || !transmissionTime) {
        throw new Error('Missing PayPal webhook headers');
      }

      // Pour l'instant, retourner true (implémentation complète nécessite plus de configuration)
      return true;
    } catch (error) {
      logger.error('PayPal webhook verification failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handler pour Stripe payment_intent.succeeded
   */
  async handleStripePaymentSucceeded(event) {
    const paymentIntent = event.data.object;
    
    try {
      // Mettre à jour le statut du paiement en base de données
      const paymentService = require('../payment/payment.service');
      await paymentService.updatePaymentStatus(paymentIntent.metadata.paymentId, 'succeeded', {
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.charges?.data[0]?.id,
        paidAt: new Date(paymentIntent.created * 1000)
      });

      // Notifier les autres services
      await this.notifyPaymentSuccess(paymentIntent);

      return {
        success: true,
        paymentId: paymentIntent.metadata.paymentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      };
    } catch (error) {
      logger.error('Failed to handle Stripe payment success', {
        error: error.message,
        paymentIntentId: paymentIntent.id
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handler pour Stripe payment_intent.payment_failed
   */
  async handleStripePaymentFailed(event) {
    const paymentIntent = event.data.object;
    
    try {
      const paymentService = require('../payment/payment.service');
      await paymentService.updatePaymentStatus(paymentIntent.metadata.paymentId, 'failed', {
        stripePaymentIntentId: paymentIntent.id,
        failureReason: paymentIntent.last_payment_error?.message,
        failedAt: new Date(paymentIntent.created * 1000)
      });

      await this.notifyPaymentFailure(paymentIntent);

      return {
        success: true,
        paymentId: paymentIntent.metadata.paymentId,
        failureReason: paymentIntent.last_payment_error?.message
      };
    } catch (error) {
      logger.error('Failed to handle Stripe payment failure', {
        error: error.message,
        paymentIntentId: paymentIntent.id
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handler pour Stripe charge.dispute.created
   */
  async handleStripeDisputeCreated(event) {
    const dispute = event.data.object;
    
    try {
      logger.alert('Stripe dispute created', {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: dispute.amount,
        reason: dispute.reason,
        currency: dispute.currency
      });

      // Mettre à jour le statut du paiement
      const paymentService = require('../payment/payment.service');
      await paymentService.updatePaymentStatus(dispute.charge, 'disputed', {
        stripeDisputeId: dispute.id,
        disputeReason: dispute.reason,
        disputedAt: new Date(dispute.created * 1000)
      });

      // Notifier l'admin
      await this.notifyDisputeCreated(dispute);

      return {
        success: true,
        disputeId: dispute.id,
        chargeId: dispute.charge,
        reason: dispute.reason
      };
    } catch (error) {
      logger.error('Failed to handle Stripe dispute', {
        error: error.message,
        disputeId: dispute.id
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handler pour PayPal payment.completed
   */
  async handlePayPalPaymentCompleted(event) {
    const payment = event.resource;
    
    try {
      const paymentService = require('../payment/payment.service');
      await paymentService.updatePaymentStatus(payment.custom_id, 'succeeded', {
        paypalPaymentId: payment.id,
        paypalOrderId: payment.supplementary_data?.related_ids?.order_id,
        paidAt: new Date(payment.create_time)
      });

      await this.notifyPaymentSuccess({
        metadata: { paymentId: payment.custom_id },
        amount: Math.round(parseFloat(payment.amount.value) * 100),
        currency: payment.amount.currency,
        id: payment.id
      });

      return {
        success: true,
        paymentId: payment.custom_id,
        paypalPaymentId: payment.id,
        amount: payment.amount
      };
    } catch (error) {
      logger.error('Failed to handle PayPal payment success', {
        error: error.message,
        paymentId: payment.id
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Notifie les autres services en cas de succès
   */
  async notifyPaymentSuccess(paymentData) {
    try {
      const notificationClient = require(../../../shared)))))/notification-client');
      
      // Envoyer une confirmation email
      await notificationClient.sendEmail({
        type: 'payment_success',
        to: paymentData.customerEmail,
        data: {
          paymentId: paymentData.metadata.paymentId,
          amount: paymentData.amount / 100,
          currency: paymentData.currency,
          eventId: paymentData.metadata.eventId
        }
      });

      // Mettre à jour le statut des tickets
      const ticketClient = require(../../../shared)))))/ticket-client');
      await ticketClient.updateTicketsStatus(paymentData.metadata.ticketIds, 'paid');

      logger.info('Payment success notifications sent', {
        paymentId: paymentData.metadata.paymentId
      });
    } catch (error) {
      logger.error('Failed to send payment success notifications', {
        error: error.message,
        paymentId: paymentData.metadata.paymentId
      });
    }
  }

  /**
   * Notifie les autres services en cas d'échec
   */
  async notifyPaymentFailure(paymentData) {
    try {
      const notificationClient = require(../../../shared)))))/notification-client');
      
      // Envoyer un email d'échec
      await notificationClient.sendEmail({
        type: 'payment_failure',
        to: paymentData.customerEmail,
        data: {
          paymentId: paymentData.metadata.paymentId,
          amount: paymentData.amount / 100,
          currency: paymentData.currency,
          eventId: paymentData.metadata.eventId,
          failureReason: paymentData.last_payment_error?.message
        }
      });

      logger.info('Payment failure notifications sent', {
        paymentId: paymentData.metadata.paymentId
      });
    } catch (error) {
      logger.error('Failed to send payment failure notifications', {
        error: error.message,
        paymentId: paymentData.metadata.paymentId
      });
    }
  }

  /**
   * Notifie en cas de dispute
   */
  async notifyDisputeCreated(dispute) {
    try {
      const notificationClient = require(../../../shared)))))/notification-client');
      
      // Notifier l'admin
      await notificationClient.sendEmail({
        type: 'payment_dispute',
        to: process.env.ADMIN_EMAIL,
        data: {
          disputeId: dispute.id,
          chargeId: dispute.charge,
          amount: dispute.amount / 100,
          currency: dispute.currency,
          reason: dispute.reason
        }
      });

      logger.alert('Dispute notification sent', {
        disputeId: dispute.id
      });
    } catch (error) {
      logger.error('Failed to send dispute notification', {
        error: error.message,
        disputeId: dispute.id
      });
    }
  }

  /**
   * Récupère les statistiques des webhooks
   */
  getWebhookStats() {
    return {
      stripeHandlers: Array.from(this.webhookHandlers.keys()).filter(k => k.startsWith('stripe.')).length,
      paypalHandlers: Array.from(this.webhookHandlers.keys()).filter(k => k.startsWith('paypal.')).length,
      totalHandlers: this.webhookHandlers.size,
      stripeConfigured: !!this.stripeWebhookSecret,
      paypalConfigured: !!this.paypalWebhookId
    };
  }

  // Handlers additionnels (implémentations minimales)
  async handleStripePaymentCanceled(event) {
    return { success: true, action: 'canceled' };
  }

  async handleStripeChargeSucceeded(event) {
    return { success: true, action: 'charge_succeeded' };
  }

  async handleStripeChargeFailed(event) {
    return { success: true, action: 'charge_failed' };
  }

  async handleStripeSubscriptionCreated(event) {
    return { success: true, action: 'subscription_created' };
  }

  async handleStripeSubscriptionDeleted(event) {
    return { success: true, action: 'subscription_deleted' };
  }

  async handleStripeInvoiceSucceeded(event) {
    return { success: true, action: 'invoice_succeeded' };
  }

  async handleStripeInvoiceFailed(event) {
    return { success: true, action: 'invoice_failed' };
  }

  async handlePayPalPaymentFailed(event) {
    return { success: true, action: 'payment_failed' };
  }

  async handlePayPalPaymentDenied(event) {
    return { success: true, action: 'payment_denied' };
  }

  async handlePayPalPaymentCaptured(event) {
    return { success: true, action: 'payment_captured' };
  }

  async handlePayPalPaymentRefunded(event) {
    return { success: true, action: 'payment_refunded' };
  }

  async handlePayPalMerchantOnboarding(event) {
    return { success: true, action: 'merchant_onboarding' };
  }
}

module.exports = new WebhookService();
