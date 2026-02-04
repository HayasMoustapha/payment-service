const HttpGateway = require('./http-gateway');

class MTNMomoGateway extends HttpGateway {
  constructor(config = {}) {
    const headers = {};
    if (process.env.MTN_MOMO_API_KEY) headers['X-Api-Key'] = process.env.MTN_MOMO_API_KEY;
    if (process.env.MTN_MOMO_SUBSCRIPTION_KEY) headers['Ocp-Apim-Subscription-Key'] = process.env.MTN_MOMO_SUBSCRIPTION_KEY;

    super({
      code: 'mtn_momo',
      name: 'MTN Mobile Money',
      config,
      env: {
        baseUrl: process.env.MTN_MOMO_BASE_URL,
        initiatePath: process.env.MTN_MOMO_INITIATE_PATH,
        statusPath: process.env.MTN_MOMO_STATUS_PATH,
        cancelPath: process.env.MTN_MOMO_CANCEL_PATH,
        headers,
        timeout: process.env.MTN_MOMO_TIMEOUT_MS ? Number(process.env.MTN_MOMO_TIMEOUT_MS) : undefined
      }
    });
  }
}

module.exports = MTNMomoGateway;
