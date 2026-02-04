const paypalSdk = require('@paypal/checkout-server-sdk');
const axios = require('axios');
const BaseGateway = require('./base-gateway');

class PayPalGateway extends BaseGateway {
  constructor(config = {}) {
    super({ code: 'paypal', name: 'PayPal', config });
    this.clientId = config.clientId || process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.PAYPAL_CLIENT_SECRET;
    this.mode = config.mode || process.env.PAYPAL_MODE || 'sandbox';
    this.webhookId = config.webhookId || process.env.PAYPAL_WEBHOOK_ID;

    this.assertConfig(this.clientId, 'PAYPAL_CLIENT_ID');
    this.assertConfig(this.clientSecret, 'PAYPAL_CLIENT_SECRET');

    const environment = this.mode === 'live'
      ? new paypalSdk.core.LiveEnvironment(this.clientId, this.clientSecret)
      : new paypalSdk.core.SandboxEnvironment(this.clientId, this.clientSecret);

    this.client = new paypalSdk.core.PayPalHttpClient(environment);
    this.baseUrl = this.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  mapStatus(paypalStatus) {
    if (!paypalStatus) return 'pending';
    const status = paypalStatus.toUpperCase();
    if (status === 'COMPLETED' || status === 'APPROVED') return 'completed';
    if (status === 'CREATED' || status === 'PAYER_ACTION_REQUIRED') return 'pending';
    if (status === 'CANCELLED' || status === 'VOIDED' || status === 'FAILED' || status === 'DENIED') return 'failed';
    return 'pending';
  }

  async initiatePayment({ amount, currency, description, metadata = {}, returnUrl, cancelUrl, customer }) {
    const request = new paypalSdk.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency || 'EUR',
            value: Number(amount).toFixed(2)
          },
          description: description || metadata?.description || 'Event payment',
          custom_id: metadata.payment_id ? String(metadata.payment_id) : undefined
        }
      ],
      application_context: {
        return_url: returnUrl || this.getConfigValue('returnUrl') || 'http://localhost:3000/payment/success',
        cancel_url: cancelUrl || this.getConfigValue('cancelUrl') || 'http://localhost:3000/payment/cancel',
        user_action: 'PAY_NOW'
      },
      payer: customer?.email ? { email_address: customer.email } : undefined
    });

    const response = await this.client.execute(request);
    const order = response.result;
    const approvalLink = order.links?.find((link) => link.rel === 'approve');

    return {
      provider: 'paypal',
      status: this.mapStatus(order.status),
      transactionId: order.id,
      paymentUrl: approvalLink?.href || null,
      clientSecret: null,
      raw: order
    };
  }

  async captureOrder(orderId) {
    const request = new paypalSdk.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const response = await this.client.execute(request);
    const order = response.result;
    return {
      provider: 'paypal',
      status: this.mapStatus(order.status),
      transactionId: order.id,
      raw: order
    };
  }

  async getPaymentStatus(orderId) {
    const request = new paypalSdk.orders.OrdersGetRequest(orderId);
    const response = await this.client.execute(request);
    const order = response.result;
    return {
      provider: 'paypal',
      status: this.mapStatus(order.status),
      transactionId: order.id,
      raw: order
    };
  }

  async cancelPayment(orderId) {
    // PayPal does not have direct cancel for order; mark as failed
    return {
      provider: 'paypal',
      status: 'failed',
      transactionId: orderId,
      raw: { reason: 'cancelled_by_user' }
    };
  }

  async verifyWebhook({ headers, body }) {
    if (!this.webhookId) {
      return { success: false, error: 'PayPal webhook ID not configured' };
    }

    try {
      const payload = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: body
      };

      const response = await axios.post(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        payload,
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret
          }
        }
      );

      const verification = response.data;
      if (verification.verification_status === 'SUCCESS') {
        return { success: true };
      }

      return { success: false, error: 'Invalid PayPal webhook signature' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async parseWebhook(event) {
    const resource = event.resource || {};
    const customId = resource.custom_id || resource.invoice_id || null;
    let status = this.mapStatus(resource.status || event.summary);
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      status = 'completed';
    }
    if (event.event_type === 'PAYMENT.CAPTURE.DENIED' || event.event_type === 'CHECKOUT.ORDER.CANCELLED') {
      status = 'failed';
    }
    return {
      eventType: event.event_type,
      provider: 'paypal',
      transactionId: resource.id || event.id,
      paymentId: customId && /^\d+$/.test(customId) ? Number(customId) : null,
      status,
      raw: resource
    };
  }
}

module.exports = PayPalGateway;
