const Stripe = require('stripe');
const BaseGateway = require('./base-gateway');

class StripeGateway extends BaseGateway {
  constructor(config = {}) {
    super({ code: 'stripe', name: 'Stripe', config });
    const apiKey = config.secretKey || process.env.STRIPE_SECRET_KEY;
    this.assertConfig(apiKey, 'STRIPE_SECRET_KEY');
    const apiVersion = config.apiVersion || process.env.STRIPE_API_VERSION || '2024-06-20';
    this.stripe = new Stripe(apiKey, { apiVersion });
    this.webhookSecret = config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
  }

  mapStatus(stripeStatus) {
    if (stripeStatus === 'succeeded') return 'completed';
    if (stripeStatus === 'requires_payment_method' || stripeStatus === 'requires_confirmation' || stripeStatus === 'requires_action') {
      return 'pending';
    }
    if (stripeStatus === 'canceled' || stripeStatus === 'requires_capture') {
      return 'failed';
    }
    return 'pending';
  }

  async initiatePayment({ amount, currency, description, metadata = {}, customer, paymentId, returnUrl, cancelUrl, useCheckout = false }) {
    const normalizedCurrency = (currency || 'EUR').toLowerCase();
    const amountInMinor = Math.round(Number(amount) * 100);

    if (useCheckout) {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: returnUrl || this.getConfigValue('successUrl') || 'http://localhost:3000/payment/success',
        cancel_url: cancelUrl || this.getConfigValue('cancelUrl') || 'http://localhost:3000/payment/cancel',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: normalizedCurrency,
              unit_amount: amountInMinor,
              product_data: {
                name: metadata?.label || description || 'Event payment'
              }
            }
          }
        ],
        metadata: {
          payment_id: String(paymentId || ''),
          ...metadata
        },
        customer_email: customer?.email
      });

      return {
        provider: 'stripe',
        status: 'pending',
        transactionId: session.id,
        paymentUrl: session.url,
        clientSecret: null,
        raw: session
      };
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: amountInMinor,
      currency: normalizedCurrency,
      description: description || metadata?.description || 'Event payment',
      metadata: {
        payment_id: String(paymentId || ''),
        ...metadata
      },
      automatic_payment_methods: { enabled: true },
      receipt_email: customer?.email
    });

    return {
      provider: 'stripe',
      status: this.mapStatus(intent.status),
      transactionId: intent.id,
      paymentUrl: null,
      clientSecret: intent.client_secret,
      raw: intent
    };
  }

  async getPaymentStatus(transactionId) {
    const intent = await this.stripe.paymentIntents.retrieve(transactionId);
    return {
      provider: 'stripe',
      status: this.mapStatus(intent.status),
      transactionId: intent.id,
      raw: intent
    };
  }

  async cancelPayment(transactionId) {
    const intent = await this.stripe.paymentIntents.cancel(transactionId);
    return {
      provider: 'stripe',
      status: this.mapStatus(intent.status),
      transactionId: intent.id,
      raw: intent
    };
  }

  async verifyWebhook({ rawBody, signature }) {
    if (!this.webhookSecret) {
      return { success: false, error: 'Stripe webhook secret not configured' };
    }
    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      return { success: true, event };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async parseWebhook(event) {
    const payload = event.data?.object || {};
    const metadata = payload.metadata || {};
    let status = this.mapStatus(payload.status);
    if (event.type === 'payment_intent.succeeded') {
      status = 'completed';
    } else if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      status = 'failed';
    }
    return {
      eventType: event.type,
      provider: 'stripe',
      transactionId: payload.id,
      paymentId: metadata.payment_id ? Number(metadata.payment_id) : null,
      status,
      raw: payload
    };
  }
}

module.exports = StripeGateway;
