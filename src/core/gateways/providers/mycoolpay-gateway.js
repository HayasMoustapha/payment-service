const HttpGateway = require('./http-gateway');

class MyCoolPayGateway extends HttpGateway {
  constructor(config = {}) {
    const headers = {};
    if (process.env.MYCOOLPAY_API_KEY) headers['X-Api-Key'] = process.env.MYCOOLPAY_API_KEY;
    if (process.env.MYCOOLPAY_TOKEN) headers['Authorization'] = `Bearer ${process.env.MYCOOLPAY_TOKEN}`;

    super({
      code: 'mycoolpay',
      name: 'MyCoolPay',
      config,
      env: {
        baseUrl: process.env.MYCOOLPAY_BASE_URL,
        initiatePath: process.env.MYCOOLPAY_INITIATE_PATH,
        statusPath: process.env.MYCOOLPAY_STATUS_PATH,
        cancelPath: process.env.MYCOOLPAY_CANCEL_PATH,
        headers,
        timeout: process.env.MYCOOLPAY_TIMEOUT_MS ? Number(process.env.MYCOOLPAY_TIMEOUT_MS) : undefined
      }
    });
  }
}

module.exports = MyCoolPayGateway;
