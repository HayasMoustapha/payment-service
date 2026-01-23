const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../../utils/logger');

/**
 * Service Stripe pour le traitement des paiements
 * Gère les payment intents, checkout sessions, refunds et webhooks
 */
class StripeService {
  constructor() {
    this.apiVersion = process.env.STRIPE_API_VERSION || '2024-06-20';
    this.currency = process.env.CURRENCY || 'eur';
    this.minAmount = parseInt(process.env.MIN_AMOUNT) || 100; // 1€ en centimes
    this.maxAmount = parseInt(process.env.MAX_AMOUNT) || 1000000; // 10000€ en centimes
  }

  /**
   * Crée un Payment Intent Stripe
   * @param {Object} paymentData - Données du paiement
   * @returns {Promise<Object>} Payment Intent créé
   */
  async createPaymentIntent(paymentData) {
    try {
      const {
        amount,
        customerId,
        eventId,
        ticketIds,
        metadata = {},
        paymentMethodTypes = ['card']
      } = paymentData;

      // Validation du montant
      if (amount < this.minAmount || amount > this.maxAmount) {
        throw new Error(`Le montant doit être entre ${this.minAmount/100}€ et ${this.maxAmount/100}€`);
      }

      const paymentIntentData = {
        amount,
        currency: this.currency,
        payment_method_types: paymentMethodTypes,
        metadata: {
          eventId,
          ticketIds: ticketIds.join(','),
          service: 'event-planner',
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true
        },
        description: `Paiement pour événement ${eventId}`
      };

      // Ajouter le client si spécifié
      if (customerId) {
        paymentIntentData.customer = customerId;
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

      logger.payment('Stripe Payment Intent created', {
        paymentIntentId: paymentIntent.id,
        amount: amount / 100,
        currency: this.currency,
        customerId,
        eventId
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          created: paymentIntent.created
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe Payment Intent', {
        error: error.message,
        amount: paymentData.amount,
        eventId: paymentData.eventId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_INTENT_CREATION_FAILED'
      };
    }
  }

  /**
   * Crée une Checkout Session Stripe
   * @param {Object} sessionData - Données de la session
   * @returns {Promise<Object>} Checkout Session créée
   */
  async createCheckoutSession(sessionData) {
    try {
      const {
        amount,
        customerId,
        eventId,
        ticketIds,
        successUrl,
        cancelUrl,
        metadata = {}
      } = sessionData;

      // Validation du montant
      if (amount < this.minAmount || amount > this.maxAmount) {
        throw new Error(`Le montant doit être entre ${this.minAmount/100}€ et ${this.maxAmount/100}€`);
      }

      const sessionDataStripe = {
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: this.currency,
            product_data: {
              name: `Billets pour événement ${eventId}`,
              description: `Achat de ${ticketIds.length} billet(s)`,
              metadata: {
                eventId,
                ticketIds: ticketIds.join(',')
              }
            },
            unit_amount: amount
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: successUrl || `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
        metadata: {
          eventId,
          ticketIds: ticketIds.join(','),
          service: 'event-planner',
          ...metadata
        }
      };

      // Ajouter le client si spécifié
      if (customerId) {
        sessionDataStripe.customer = customerId;
      }

      const session = await stripe.checkout.sessions.create(sessionDataStripe);

      logger.payment('Stripe Checkout Session created', {
        sessionId: session.id,
        amount: amount / 100,
        currency: this.currency,
        customerId,
        eventId
      });

      return {
        success: true,
        session: {
          id: session.id,
          url: session.url,
          paymentStatus: session.payment_status,
          amount: session.amount_total,
          currency: session.currency
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe Checkout Session', {
        error: error.message,
        amount: sessionData.amount,
        eventId: sessionData.eventId
      });

      return {
        success: false,
        error: error.message,
        type: 'CHECKOUT_SESSION_CREATION_FAILED'
      };
    }
  }

  /**
   * Récupère un Payment Intent
   * @param {string} paymentIntentId - ID du Payment Intent
   * @returns {Promise<Object>} Payment Intent
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          paymentMethod: paymentIntent.payment_method,
          customerId: paymentIntent.customer,
          metadata: paymentIntent.metadata,
          created: paymentIntent.created,
          charges: paymentIntent.charges?.data || []
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve Stripe Payment Intent', {
        error: error.message,
        paymentIntentId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_INTENT_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Confirme un Payment Intent
   * @param {string} paymentIntentId - ID du Payment Intent
   * @param {string} paymentMethodId - ID du Payment Method
   * @returns {Promise<Object>} Payment Intent confirmé
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });

      logger.payment('Stripe Payment Intent confirmed', {
        paymentIntentId,
        paymentMethodId,
        status: paymentIntent.status
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        }
      };
    } catch (error) {
      logger.error('Failed to confirm Stripe Payment Intent', {
        error: error.message,
        paymentIntentId,
        paymentMethodId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_INTENT_CONFIRMATION_FAILED'
      };
    }
  }

  /**
   * Annule un Payment Intent
   * @param {string} paymentIntentId - ID du Payment Intent
   * @param {string} reason - Raison de l'annulation
   * @returns {Promise<Object>} Payment Intent annulé
   */
  async cancelPaymentIntent(paymentIntentId, reason = 'requested_by_customer') {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: reason
      });

      logger.payment('Stripe Payment Intent cancelled', {
        paymentIntentId,
        reason,
        status: paymentIntent.status
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          cancellationReason: paymentIntent.cancellation_reason
        }
      };
    } catch (error) {
      logger.error('Failed to cancel Stripe Payment Intent', {
        error: error.message,
        paymentIntentId,
        reason
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_INTENT_CANCELLATION_FAILED'
      };
    }
  }

  /**
   * Crée un client Stripe
   * @param {Object} customerData - Données du client
   * @returns {Promise<Object>} Client créé
   */
  async createCustomer(customerData) {
    try {
      const {
        email,
        name,
        phone,
        metadata = {}
      } = customerData;

      const customer = await stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          service: 'event-planner',
          ...metadata
        }
      });

      logger.payment('Stripe Customer created', {
        customerId: customer.id,
        email,
        name
      });

      return {
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          created: customer.created
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe Customer', {
        error: error.message,
        email: customerData.email
      });

      return {
        success: false,
        error: error.message,
        type: 'CUSTOMER_CREATION_FAILED'
      };
    }
  }

  /**
   * Récupère un client Stripe
   * @param {string} customerId - ID du client
   * @returns {Promise<Object>} Client
   */
  async getCustomer(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);

      return {
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          created: customer.created,
          metadata: customer.metadata
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve Stripe Customer', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'CUSTOMER_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Met à jour un client Stripe
   * @param {string} customerId - ID du client
   * @param {Object} updateData - Données de mise à jour
   * @returns {Promise<Object>} Client mis à jour
   */
  async updateCustomer(customerId, updateData) {
    try {
      const customer = await stripe.customers.update(customerId, updateData);

      logger.payment('Stripe Customer updated', {
        customerId,
        updatedFields: Object.keys(updateData)
      });

      return {
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: customer.metadata
        }
      };
    } catch (error) {
      logger.error('Failed to update Stripe Customer', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'CUSTOMER_UPDATE_FAILED'
      };
    }
  }

  /**
   * Crée une méthode de paiement
   * @param {string} customerId - ID du client
   * @param {Object} paymentMethodData - Données de la méthode de paiement
   * @returns {Promise<Object>} Méthode de paiement créée
   */
  async createPaymentMethod(customerId, paymentMethodData) {
    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: paymentMethodData.type || 'card',
        card: paymentMethodData.card,
        billing_details: paymentMethodData.billing_details
      });

      // Attacher la méthode de paiement au client
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });

      logger.payment('Stripe Payment Method created', {
        paymentMethodId: paymentMethod.id,
        customerId,
        type: paymentMethod.type
      });

      return {
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card,
          billingDetails: paymentMethod.billing_details
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe Payment Method', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHOD_CREATION_FAILED'
      };
    }
  }

  /**
   * Liste les méthodes de paiement d'un client
   * @param {string} customerId - ID du client
   * @param {string} type - Type de méthode de paiement
   * @returns {Promise<Object>} Méthodes de paiement
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type
      });

      return {
        success: true,
        paymentMethods: paymentMethods.data.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card,
          billingDetails: pm.billing_details,
          created: pm.created
        }))
      };
    } catch (error) {
      logger.error('Failed to list Stripe Payment Methods', {
        error: error.message,
        customerId,
        type
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHODS_LIST_FAILED'
      };
    }
  }

  /**
   * Supprime une méthode de paiement
   * @param {string} paymentMethodId - ID de la méthode de paiement
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deletePaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

      logger.payment('Stripe Payment Method deleted', {
        paymentMethodId
      });

      return {
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          deleted: true
        }
      };
    } catch (error) {
      logger.error('Failed to delete Stripe Payment Method', {
        error: error.message,
        paymentMethodId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHOD_DELETION_FAILED'
      };
    }
  }

  /**
   * Traite un webhook Stripe
   * @param {string} payload - Payload du webhook
   * @param {string} signature - Signature du webhook
   * @returns {Promise<Object>} Événement traité
   */
  async processWebhook(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      logger.payment('Stripe webhook received', {
        eventId: event.id,
        type: event.type
      });

      return {
        success: true,
        event: {
          id: event.id,
          type: event.type,
          data: event.data,
          created: event.created
        }
      };
    } catch (error) {
      logger.error('Failed to process Stripe webhook', {
        error: error.message,
        signature
      });

      return {
        success: false,
        error: error.message,
        type: 'WEBHOOK_PROCESSING_FAILED'
      };
    }
  }

  /**
   * Récupère la liste des paiements d'un client
   * @param {string} customerId - ID du client
   * @param {Object} options - Options de pagination
   * @returns {Promise<Object>} Liste des paiements
   */
  async listCustomerPayments(customerId, options = {}) {
    try {
      const {
        limit = 10,
        startingAfter = null
      } = options;

      const params = {
        customer: customerId,
        limit,
        expand: ['data.payment_method']
      };

      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const paymentIntents = await stripe.paymentIntents.list(params);

      return {
        success: true,
        payments: paymentIntents.data.map(pi => ({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          created: pi.created,
          description: pi.description,
          metadata: pi.metadata,
          paymentMethod: pi.payment_method
        })),
        hasMore: paymentIntents.has_more
      };
    } catch (error) {
      logger.error('Failed to list customer payments', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENTS_LIST_FAILED'
      };
    }
  }

  /**
   * Vérifie la santé du service Stripe
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      // Tester une requête simple à l'API Stripe
      await stripe.accounts.retrieve();

      return {
        success: true,
        healthy: true,
        apiVersion: this.apiVersion,
        currency: this.currency
      };
    } catch (error) {
      logger.error('Stripe health check failed', {
        error: error.message
      });

      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Récupère les statistiques du service Stripe
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      apiVersion: this.apiVersion,
      currency: this.currency,
      limits: {
        minAmount: this.minAmount,
        maxAmount: this.maxAmount
      },
      configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
    };
  }
}

module.exports = new StripeService();
