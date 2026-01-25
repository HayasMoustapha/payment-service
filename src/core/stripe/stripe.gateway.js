const BaseGateway = require('../providers/base.gateway');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe Payment Gateway Implementation
 * Handles Stripe-specific payment processing
 */
class StripeGateway extends BaseGateway {
  constructor(config) {
    super(config);
    this.stripe = stripe;
    this.webhookSecret = config.config?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Initialize Stripe gateway
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      // Test Stripe connection
      await this.stripe.accounts.retrieve();
      this.log('initialize', { status: 'success' });
      return true;
    } catch (error) {
      this.log('initialize', { error: error.message }, 'error');
      throw error;
    }
  }

  /**
   * Process payment with Stripe
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    try {
      const {
        amount,
        currency = 'eur',
        description,
        metadata = {},
        customerEmail,
        returnUrl,
        paymentMethodId
      } = paymentData;

      // Create or get customer
      let customerId;
      if (customerEmail) {
        const customers = await this.stripe.customers.list({ email: customerEmail, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        } else {
          const customer = await this.stripe.customers.create({
            email: customerEmail,
            metadata
          });
          customerId = customer.id;
        }
      }

      // Create payment intent
      const paymentIntentParams = {
        amount: this.formatAmount(amount, currency),
        currency,
        description,
        metadata: {
          ...metadata,
          gateway_reference: this.generateReference('STRIPE')
        },
        automatic_payment_methods: {
          enabled: true
        }
      };

      if (customerId) {
        paymentIntentParams.customer = customerId;
      }

      if (returnUrl) {
        paymentIntentParams.confirmation_method = 'manual';
        paymentIntentParams.return_url = returnUrl.success || returnUrl.cancel;
      }

      if (paymentMethodId) {
        paymentIntentParams.payment_method = paymentMethodId;
        paymentIntentParams.confirmation_method = 'manual';
        paymentIntentParams.confirm = true;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

      this.log('processPayment', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status
      });

      return {
        success: true,
        transactionId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        clientSecret: paymentIntent.client_secret,
        nextAction: paymentIntent.next_action,
        amount: this.parseAmount(paymentIntent.amount, currency),
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata
      };

    } catch (error) {
      return this.handleError(error, 'processPayment');
    }
  }

  /**
   * Verify Stripe webhook signature
   * @param {string} payload - Raw payload
   * @param {string} signature - Stripe signature
   * @param {string} secret - Webhook secret
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature(payload, signature, secret) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret || this.webhookSecret);
    } catch (error) {
      this.log('verifyWebhookSignature', { error: error.message }, 'error');
      return false;
    }
  }

  /**
   * Parse Stripe webhook event
   * @param {Object} webhookData - Webhook data
   * @returns {Promise<Object>} Parsed event
   */
  async parseWebhookEvent(webhookData) {
    try {
      const event = typeof webhookData === 'string' ? JSON.parse(webhookData) : webhookData;
      
      const parsedEvent = {
        eventType: event.type,
        eventId: event.id,
        timestamp: new Date(event.created * 1000).toISOString(),
        data: null
      };

      switch (event.type) {
        case 'payment_intent.succeeded':
          parsedEvent.data = {
            transactionId: event.data.object.id,
            status: 'completed',
            amount: this.parseAmount(event.data.object.amount, event.data.object.currency),
            currency: event.data.object.currency,
            metadata: event.data.object.metadata,
            customer: event.data.object.customer
          };
          break;

        case 'payment_intent.payment_failed':
          parsedEvent.data = {
            transactionId: event.data.object.id,
            status: 'failed',
            amount: this.parseAmount(event.data.object.amount, event.data.object.currency),
            currency: event.data.object.currency,
            metadata: event.data.object.metadata,
            lastPaymentError: event.data.object.last_payment_error
          };
          break;

        case 'payment_intent.canceled':
          parsedEvent.data = {
            transactionId: event.data.object.id,
            status: 'canceled',
            amount: this.parseAmount(event.data.object.amount, event.data.object.currency),
            currency: event.data.object.currency,
            metadata: event.data.object.metadata
          };
          break;

        case 'charge.dispute.created':
          parsedEvent.data = {
            chargeId: event.data.object.id,
            disputeId: event.data.object.id,
            status: 'disputed',
            amount: this.parseAmount(event.data.object.amount, event.data.object.currency),
            currency: event.data.object.currency,
            reason: event.data.object.reason
          };
          break;

        default:
          parsedEvent.data = event.data.object;
      }

      this.log('parseWebhookEvent', {
        eventType: event.type,
        eventId: event.id
      });

      return parsedEvent;

    } catch (error) {
      return this.handleError(error, 'parseWebhookEvent');
    }
  }

  /**
   * Get payment status from Stripe
   * @param {string} transactionId - Payment Intent ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(transactionId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

      return {
        success: true,
        transactionId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        amount: this.parseAmount(paymentIntent.amount, paymentIntent.currency),
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
        charges: paymentIntent.charges.data.map(charge => ({
          id: charge.id,
          status: charge.status,
          amount: this.parseAmount(charge.amount, charge.currency),
          currency: charge.currency,
          paymentMethod: charge.payment_method,
          created: new Date(charge.created * 1000).toISOString()
        }))
      };

    } catch (error) {
      return this.handleError(error, 'getPaymentStatus');
    }
  }

  /**
   * Refund payment with Stripe
   * @param {string} transactionId - Payment Intent ID
   * @param {number} amount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(transactionId, amount, reason) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);
      
      if (!paymentIntent.charges.data.length) {
        throw new Error('No charges found for this payment intent');
      }

      const chargeId = paymentIntent.charges.data[0].id;
      
      const refundParams = {
        charge: chargeId,
        reason: this.mapRefundReason(reason)
      };

      // Partial refund if amount specified
      if (amount && amount < this.parseAmount(paymentIntent.amount, paymentIntent.currency)) {
        refundParams.amount = this.formatAmount(amount, paymentIntent.currency);
      }

      const refund = await this.stripe.refunds.create(refundParams);

      this.log('refundPayment', {
        refundId: refund.id,
        chargeId,
        amount: this.parseAmount(refund.amount, refund.currency),
        status: refund.status
      });

      return {
        success: true,
        refundId: refund.id,
        transactionId,
        amount: this.parseAmount(refund.amount, refund.currency),
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        created: new Date(refund.created * 1000).toISOString()
      };

    } catch (error) {
      return this.handleError(error, 'refundPayment');
    }
  }

  /**
   * Create payout with Stripe
   * @param {Object} payoutData - Payout data
   * @returns {Promise<Object>} Payout result
   */
  async createPayout(payoutData) {
    try {
      const { amount, currency = 'eur', recipient, description } = payoutData;

      const payoutParams = {
        amount: this.formatAmount(amount, currency),
        currency,
        description: description || `Payout to ${recipient.email || recipient.account}`
      };

      // Add destination if specified
      if (recipient.stripeAccountId) {
        payoutParams.destination = recipient.stripeAccountId;
      }

      const payout = await this.stripe.payouts.create(payoutParams);

      this.log('createPayout', {
        payoutId: payout.id,
        amount: this.parseAmount(payout.amount, payout.currency),
        status: payout.status
      });

      return {
        success: true,
        payoutId: payout.id,
        amount: this.parseAmount(payout.amount, payout.currency),
        currency: payout.currency,
        status: payout.status,
        arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
        created: new Date(payout.created * 1000).toISOString()
      };

    } catch (error) {
      return this.handleError(error, 'createPayout');
    }
  }

  /**
   * Validate payment method
   * @param {Object} paymentMethod - Payment method details
   * @returns {Promise<Object>} Validation result
   */
  async validatePaymentMethod(paymentMethod) {
    try {
      if (paymentMethod.type === 'card') {
        // Validate card using Stripe's token creation
        const token = await this.stripe.tokens.create({
          card: {
            number: paymentMethod.card.number,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
            cvc: paymentMethod.card.cvc
          }
        });

        return {
          success: true,
          valid: true,
          token: token.id,
          card: {
            brand: token.card.brand,
            last4: token.card.last4,
            exp_month: token.card.exp_month,
            exp_year: token.card.exp_year
          }
        };
      }

      return {
        success: true,
        valid: false,
        error: 'Unsupported payment method type'
      };

    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Map Stripe status to standard status
   * @param {string} stripeStatus - Stripe status
   * @returns {string} Standard status
   */
  mapStripeStatus(stripeStatus) {
    const statusMap = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'processing': 'processing',
      'succeeded': 'completed',
      'canceled': 'canceled',
      'requires_capture': 'pending'
    };

    return statusMap[stripeStatus] || 'pending';
  }

  /**
   * Map refund reason to Stripe reason
   * @param {string} reason - Custom reason
   * @returns {string} Stripe reason
   */
  mapRefundReason(reason) {
    const reasonMap = {
      'duplicate': 'duplicate',
      'fraudulent': 'fraudulent',
      'requested_by_customer': 'requested_by_customer'
    };

    return reasonMap[reason] || 'requested_by_customer';
  }
}

module.exports = StripeGateway;
