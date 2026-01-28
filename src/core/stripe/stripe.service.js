const logger = require('../../utils/logger');

// Initialiser Stripe
let stripe = null;
const isValidStripeKey = process.env.STRIPE_SECRET_KEY && 
                       process.env.STRIPE_SECRET_KEY !== 'sk_test_51234567890abcdef';

if (isValidStripeKey) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    logger.info('Stripe initialized successfully');
  } catch (error) {
    logger.warn('Stripe initialization failed:', error.message);
  }
} else {
  logger.warn('Stripe disabled - using mock mode');
}

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
    this.mockMode = !stripe || !isValidStripeKey; // Mode mock si Stripe n'est pas valide
  }

  /**
   * Crée un Payment Intent Stripe
   * @param {Object} paymentData - Données du paiement
   * @returns {Promise<Object>} Payment Intent créé
   */
  async createPaymentIntent(paymentData) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        paymentIntentId: 'pi_mock_' + Date.now(),
        amount: paymentData.amount,
        currency: paymentData.currency || this.currency,
        status: 'requires_payment_method',
        clientSecret: 'pi_mock_secret_' + Date.now(),
        message: 'Payment Intent created (mock mode)'
      };
    }

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
   * Get a Payment Intent
   * @param {string} paymentIntentId - Payment Intent ID
   * @returns {Promise<Object>} Payment Intent
   */
  async getPaymentIntent(paymentIntentId) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        paymentIntent: {
          id: paymentIntentId,
          amount: 2500,
          currency: 'eur',
          status: 'requires_payment_method',
          clientSecret: 'pi_mock_secret_' + Date.now(),
          created: Math.floor(Date.now() / 1000),
          metadata: {}
        },
        message: 'Payment Intent retrieved (mock mode)'
      };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      logger.payment('Stripe Payment Intent retrieved', {
        paymentIntentId,
        status: paymentIntent.status
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          clientSecret: paymentIntent.client_secret,
          created: paymentIntent.created,
          metadata: paymentIntent.metadata
        }
      };
    } catch (error) {
      logger.error('Failed to get Stripe Payment Intent', {
        error: error.message,
        paymentIntentId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_INTENT_NOT_FOUND'
      };
    }
  }

  /**
   * Confirm a Payment Intent
   * @param {string} paymentIntentId - Payment Intent ID
   * @param {string} paymentMethodId - Payment Method ID
   * @returns {Promise<Object>} Confirmed Payment Intent
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        paymentIntent: {
          id: paymentIntentId,
          amount: 2500,
          currency: 'eur',
          status: 'succeeded',
          clientSecret: 'pi_mock_secret_' + Date.now(),
          created: Math.floor(Date.now() / 1000),
          metadata: {}
        },
        message: 'Payment Intent confirmed (mock mode)'
      };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });

      logger.payment('Stripe Payment Intent confirmed', {
        paymentIntentId,
        status: paymentIntent.status
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          created: paymentIntent.created
        }
      };
    } catch (error) {
      logger.error('Failed to confirm Stripe Payment Intent', {
        error: error.message,
        paymentIntentId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_INTENT_CONFIRM_FAILED'
      };
    }
  }

  /**
   * Create a Customer
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>} Created customer
   */
  async createCustomer(customerData) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        customerId: 'cus_mock_' + Date.now(),
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        message: 'Customer created (mock mode)'
      };
    }

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
        metadata
      });

      logger.payment('Stripe Customer created', {
        customerId: customer.id,
        email
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
   * Get a Customer
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Customer
   */
  async getCustomer(customerId) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        customer: {
          id: customerId,
          email: 'test@example.com',
          name: 'Test Customer',
          phone: '+1234567890',
          created: Math.floor(Date.now() / 1000),
          metadata: {}
        },
        message: 'Customer retrieved (mock mode)'
      };
    }

    try {
      const customer = await stripe.customers.retrieve(customerId);

      logger.payment('Stripe Customer retrieved', {
        customerId,
        email: customer.email
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
      logger.error('Failed to get Stripe Customer', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'CUSTOMER_NOT_FOUND'
      };
    }
  }

  /**
   * Create a Payment Method
   * @param {Object} paymentMethodData - Payment Method data
   * @returns {Promise<Object>} Created Payment Method
   */
  async createPaymentMethod(paymentMethodData) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        paymentMethod: {
          id: 'pm_mock_' + Date.now(),
          type: paymentMethodData.type || 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025
          },
          created: Math.floor(Date.now() / 1000),
          metadata: paymentMethodData.metadata || {}
        },
        message: 'Payment Method created (mock mode)'
      };
    }

    try {
      const {
        customerId,
        paymentMethodId,
        isDefault = false
      } = paymentMethodData;

      // Attach payment method to customer
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      // Set as default if requested
      if (isDefault) {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      }

      logger.payment('Stripe Payment Method created', {
        paymentMethodId,
        customerId,
        isDefault
      });

      return {
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          customerId,
          isDefault,
          created: paymentMethod.created
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe Payment Method', {
        error: error.message,
        customerId: paymentMethodData.customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHOD_CREATION_FAILED'
      };
    }
  }

  /**
   * Get Customer Payment Methods
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Payment Methods
   */
  async getCustomerPaymentMethods(customerId) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        paymentMethods: [
          {
            id: 'pm_mock_1',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025
            },
            created: Math.floor(Date.now() / 1000)
          }
        ],
        message: 'Customer payment methods retrieved (mock mode)'
      };
    }

    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      logger.payment('Stripe Customer Payment Methods retrieved', {
        customerId,
        count: paymentMethods.data.length
      });

      return {
        success: true,
        paymentMethods: paymentMethods.data.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year
          },
          created: pm.created
        }))
      };
    } catch (error) {
      logger.error('Failed to get Stripe Customer Payment Methods', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHODS_NOT_FOUND'
      };
    }
  }

  /**
   * Create a Refund
   * @param {Object} refundData - Refund data
   * @returns {Promise<Object>} Created refund
   */
  async createRefund(refundData) {
    try {
      const {
        paymentIntentId,
        amount,
        reason = 'requested_by_customer',
        metadata = {}
      } = refundData;

      const refundParams = {
        payment_intent: paymentIntentId,
        reason,
        metadata
      };

      // Add amount if specified (partial refund)
      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await stripe.refunds.create(refundParams);

      logger.payment('Stripe Refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          created: refund.created
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe Refund', {
        error: error.message,
        paymentIntentId: refundData.paymentIntentId
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_CREATION_FAILED'
      };
    }
  }

  /**
   * Get a Refund
   * @param {string} refundId - Refund ID
   * @returns {Promise<Object>} Refund
   */
  async getRefund(refundId) {
    try {
      const refund = await stripe.refunds.retrieve(refundId);

      logger.payment('Stripe Refund retrieved', {
        refundId,
        status: refund.status
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          created: refund.created
        }
      };
    } catch (error) {
      logger.error('Failed to get Stripe Refund', {
        error: error.message,
        refundId
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_NOT_FOUND'
      };
    }
  }

  /**
   * List Refunds
   * @param {Object} options - List options
   * @returns {Promise<Object>} Refunds list
   */
  async listRefunds(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status
      } = options;

      const params = {
        limit,
        starting_after: page > 1 ? (page - 1) * limit : undefined
      };

      if (status) {
        params.status = status;
      }

      const refunds = await stripe.refunds.list(params);

      logger.payment('Stripe Refunds listed', {
        count: refunds.data.length,
        page,
        limit
      });

      return {
        success: true,
        refunds: refunds.data.map(refund => ({
          id: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          created: refund.created
        }))
      };
    } catch (error) {
      logger.error('Failed to list Stripe Refunds', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUNDS_LIST_FAILED'
      };
    }
  }

  /**
   * Get User Payment Methods
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Payment Methods
   */
  async getUserPaymentMethods(userId) {
    try {
      // This would typically query your database to get the customer ID
      // For now, return a mock response
      return {
        success: true,
        paymentMethods: []
      };
    } catch (error) {
      logger.error('Failed to get User Payment Methods', {
        error: error.message,
        userId
      });

      return {
        success: false,
        error: error.message,
        type: 'USER_PAYMENT_METHODS_NOT_FOUND'
      };
    }
  }

  /**
   * Update Payment Method
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated Payment Method
   */
  async updatePaymentMethod(updateData) {
    try {
      const {
        paymentMethodId,
        isDefault,
        metadata,
        userId
      } = updateData;

      // Update payment method logic here
      return {
        success: true,
        paymentMethod: {
          id: paymentMethodId,
          isDefault,
          metadata
        }
      };
    } catch (error) {
      logger.error('Failed to update Payment Method', {
        error: error.message,
        paymentMethodId: updateData.paymentMethodId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHOD_UPDATE_FAILED'
      };
    }
  }

  /**
   * Delete Payment Method
   * @param {Object} deleteData - Delete data
   * @returns {Promise<Object>} Delete result
   */
  async deletePaymentMethod(deleteData) {
    try {
      const {
        paymentMethodId,
        userId
      } = deleteData;

      // Delete payment method logic here
      return {
        success: true,
        deleted: true
      };
    } catch (error) {
      logger.error('Failed to delete Payment Method', {
        error: error.message,
        paymentMethodId: deleteData.paymentMethodId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_METHOD_DELETE_FAILED'
      };
    }
  }

  /**
   * Get Transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction
   */
  async getTransaction(transactionId) {
    try {
      // Get transaction logic here
      return {
        success: true,
        transaction: {
          id: transactionId,
          status: 'completed'
        }
      };
    } catch (error) {
      logger.error('Failed to get Transaction', {
        error: error.message,
        transactionId
      });

      return {
        success: false,
        error: error.message,
        type: 'TRANSACTION_NOT_FOUND'
      };
    }
  }

  /**
   * Get Invoice
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice
   */
  async getInvoice(invoiceId) {
    try {
      // Get invoice logic here
      return {
        success: true,
        invoice: {
          id: invoiceId,
          status: 'paid'
        }
      };
    } catch (error) {
      logger.error('Failed to get Invoice', {
        error: error.message,
        invoiceId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_NOT_FOUND'
      };
    }
  }

  /**
   * Get Invoice PDF
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice PDF
   */
  async getInvoicePdf(invoiceId) {
    try {
      // Get invoice PDF logic here
      return {
        success: true,
        pdfBuffer: Buffer.from('mock pdf content')
      };
    } catch (error) {
      logger.error('Failed to get Invoice PDF', {
        error: error.message,
        invoiceId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_PDF_NOT_FOUND'
      };
    }
  }

  /**
   * List Invoices
   * @param {Object} options - List options
   * @returns {Promise<Object>} Invoices list
   */
  async listInvoices(options = {}) {
    try {
      // List invoices logic here
      return {
        success: true,
        invoices: []
      };
    } catch (error) {
      logger.error('Failed to list Invoices', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICES_LIST_FAILED'
      };
    }
  }

  /**
   * Health Check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Simple health check - try to retrieve account info
      await stripe.accounts.retrieve();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'stripe'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        service: 'stripe'
      };
    }
  }

  /**
   * Get service configuration
   * @returns {Object} Service configuration
   */
  getConfig() {
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
