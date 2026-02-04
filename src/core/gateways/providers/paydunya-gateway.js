const HttpGateway = require('./http-gateway');

class PayDunyaGateway extends HttpGateway {
  constructor(config = {}) {
    const headers = {};
    if (process.env.PAYDUNYA_MASTER_KEY) headers['PAYDUNYA-MASTER-KEY'] = process.env.PAYDUNYA_MASTER_KEY;
    if (process.env.PAYDUNYA_PRIVATE_KEY) headers['PAYDUNYA-PRIVATE-KEY'] = process.env.PAYDUNYA_PRIVATE_KEY;
    if (process.env.PAYDUNYA_PUBLIC_KEY) headers['PAYDUNYA-PUBLIC-KEY'] = process.env.PAYDUNYA_PUBLIC_KEY;
    if (process.env.PAYDUNYA_TOKEN) headers['PAYDUNYA-TOKEN'] = process.env.PAYDUNYA_TOKEN;

    super({
      code: 'paydunya',
      name: 'PayDunya',
      config,
      env: {
        baseUrl: process.env.PAYDUNYA_BASE_URL,
        initiatePath: process.env.PAYDUNYA_INITIATE_PATH,
        statusPath: process.env.PAYDUNYA_STATUS_PATH,
        cancelPath: process.env.PAYDUNYA_CANCEL_PATH,
        headers,
        timeout: process.env.PAYDUNYA_TIMEOUT_MS ? Number(process.env.PAYDUNYA_TIMEOUT_MS) : undefined
      }
    });
  }
}

module.exports = PayDunyaGateway;
