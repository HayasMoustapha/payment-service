const HttpGateway = require('./http-gateway');

class PayGateGateway extends HttpGateway {
  constructor(config = {}) {
    const headers = {};
    if (process.env.PAYGATE_API_KEY) headers['X-Api-Key'] = process.env.PAYGATE_API_KEY;
    if (process.env.PAYGATE_TOKEN) headers['Authorization'] = `Bearer ${process.env.PAYGATE_TOKEN}`;

    super({
      code: 'paygate',
      name: 'PayGate',
      config,
      env: {
        baseUrl: process.env.PAYGATE_BASE_URL,
        initiatePath: process.env.PAYGATE_INITIATE_PATH,
        statusPath: process.env.PAYGATE_STATUS_PATH,
        cancelPath: process.env.PAYGATE_CANCEL_PATH,
        headers,
        timeout: process.env.PAYGATE_TIMEOUT_MS ? Number(process.env.PAYGATE_TIMEOUT_MS) : undefined
      }
    });
  }
}

module.exports = PayGateGateway;
