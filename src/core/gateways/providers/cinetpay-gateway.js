const HttpGateway = require('./http-gateway');

class CinetPayGateway extends HttpGateway {
  constructor(config = {}) {
    const envHeaders = {};
    if (process.env.CINETPAY_API_KEY) {
      envHeaders['X-Api-Key'] = process.env.CINETPAY_API_KEY;
    }

    super({
      code: 'cinetpay',
      name: 'CinetPay',
      config,
      env: {
        baseUrl: process.env.CINETPAY_BASE_URL,
        initiatePath: process.env.CINETPAY_INITIATE_PATH,
        statusPath: process.env.CINETPAY_STATUS_PATH,
        cancelPath: process.env.CINETPAY_CANCEL_PATH,
        headers: envHeaders,
        timeout: process.env.CINETPAY_TIMEOUT_MS ? Number(process.env.CINETPAY_TIMEOUT_MS) : undefined
      }
    });
    this.siteId = config.siteId || process.env.CINETPAY_SITE_ID;
    this.apiKey = config.apiKey || process.env.CINETPAY_API_KEY;
  }

  async initiatePayment({ amount, currency, description, metadata = {}, customer, returnUrl, cancelUrl }) {
    this.assertReady();
    const payload = {
      amount,
      currency,
      description,
      metadata,
      customer,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      apikey: this.apiKey,
      site_id: this.siteId
    };

    return super.initiatePayment({ amount, currency, description, metadata, customer, returnUrl, cancelUrl, payload });
  }
}

module.exports = CinetPayGateway;
