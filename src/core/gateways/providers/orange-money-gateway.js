const HttpGateway = require('./http-gateway');

class OrangeMoneyGateway extends HttpGateway {
  constructor(config = {}) {
    const headers = {};
    if (process.env.ORANGE_MONEY_API_KEY) headers['X-Api-Key'] = process.env.ORANGE_MONEY_API_KEY;
    if (process.env.ORANGE_MONEY_TOKEN) headers['Authorization'] = `Bearer ${process.env.ORANGE_MONEY_TOKEN}`;

    super({
      code: 'orange_money',
      name: 'Orange Money',
      config,
      env: {
        baseUrl: process.env.ORANGE_MONEY_BASE_URL,
        initiatePath: process.env.ORANGE_MONEY_INITIATE_PATH,
        statusPath: process.env.ORANGE_MONEY_STATUS_PATH,
        cancelPath: process.env.ORANGE_MONEY_CANCEL_PATH,
        headers,
        timeout: process.env.ORANGE_MONEY_TIMEOUT_MS ? Number(process.env.ORANGE_MONEY_TIMEOUT_MS) : undefined
      }
    });
  }
}

module.exports = OrangeMoneyGateway;
