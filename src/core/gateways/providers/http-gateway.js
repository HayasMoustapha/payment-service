const axios = require('axios');
const BaseGateway = require('./base-gateway');

class HttpGateway extends BaseGateway {
  constructor({ code, name, config = {}, env = {} }) {
    super({ code, name, config });
    this.baseUrl = config.baseUrl || env.baseUrl || '';
    this.initiatePath = config.initiatePath || env.initiatePath || '';
    this.statusPath = config.statusPath || env.statusPath || '';
    this.cancelPath = config.cancelPath || env.cancelPath || '';
    this.headers = { ...(config.headers || {}), ...(env.headers || {}) };
    this.auth = config.auth || env.auth || null;
    this.timeout = config.timeout || env.timeout || 15000;
  }

  assertReady() {
    this.assertConfig(this.baseUrl, `${this.code.toUpperCase()}_BASE_URL`);
    this.assertConfig(this.initiatePath, `${this.code.toUpperCase()}_INITIATE_PATH`);
  }

  buildUrl(path) {
    return `${this.baseUrl}${path}`;
  }

  async initiatePayment({ amount, currency, description, metadata = {}, customer, returnUrl, cancelUrl, payload: payloadOverride }) {
    this.assertReady();

    const payload = payloadOverride || {
      amount,
      currency,
      description,
      metadata,
      customer,
      return_url: returnUrl,
      cancel_url: cancelUrl
    };

    const response = await axios.post(
      this.buildUrl(this.initiatePath),
      payload,
      {
        headers: this.headers,
        auth: this.auth || undefined,
        timeout: this.timeout
      }
    );

    const data = response.data || {};
    const transactionId = data.transaction_id || data.transactionId || data.id;
    const paymentUrl = data.payment_url || data.paymentUrl || data.checkout_url || data.checkoutUrl || null;
    const status = data.status || 'pending';

    return {
      provider: this.code,
      status,
      transactionId,
      paymentUrl,
      clientSecret: data.client_secret || null,
      raw: data
    };
  }

  async getPaymentStatus(transactionId) {
    if (!this.baseUrl || !this.statusPath) {
      return {
        provider: this.code,
        status: 'pending',
        transactionId,
        raw: null
      };
    }

    const response = await axios.get(
      this.buildUrl(this.statusPath.replace(':transactionId', transactionId)),
      { headers: this.headers, auth: this.auth || undefined, timeout: this.timeout }
    );

    const data = response.data || {};
    return {
      provider: this.code,
      status: data.status || 'pending',
      transactionId,
      raw: data
    };
  }

  async cancelPayment(transactionId) {
    if (!this.baseUrl || !this.cancelPath) {
      return {
        provider: this.code,
        status: 'failed',
        transactionId,
        raw: { reason: 'cancel_not_supported' }
      };
    }

    const response = await axios.post(
      this.buildUrl(this.cancelPath.replace(':transactionId', transactionId)),
      { transaction_id: transactionId },
      { headers: this.headers, auth: this.auth || undefined, timeout: this.timeout }
    );

    const data = response.data || {};
    return {
      provider: this.code,
      status: data.status || 'failed',
      transactionId,
      raw: data
    };
  }

  async verifyWebhook() {
    return { success: true };
  }

  async parseWebhook(payload) {
    return {
      eventType: payload?.event_type || payload?.type || 'unknown',
      provider: this.code,
      transactionId: payload?.transaction_id || payload?.transactionId || payload?.id,
      paymentId: payload?.metadata?.payment_id ? Number(payload.metadata.payment_id) : null,
      status: payload?.status || 'pending',
      raw: payload
    };
  }
}

module.exports = HttpGateway;
