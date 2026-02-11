const paymentGatewayService = require('./payment-gateway.service');
const StripeGateway = require('./providers/stripe-gateway');
const PayPalGateway = require('./providers/paypal-gateway');
const CinetPayGateway = require('./providers/cinetpay-gateway');
const PayDunyaGateway = require('./providers/paydunya-gateway');
const PayGateGateway = require('./providers/paygate-gateway');
const MTNMomoGateway = require('./providers/mtn-momo-gateway');
const OrangeMoneyGateway = require('./providers/orange-money-gateway');
const MyCoolPayGateway = require('./providers/mycoolpay-gateway');

class GatewayManager {
  constructor() {
    this.providers = {
      stripe: new StripeGateway(),
      paypal: new PayPalGateway(),
      cinetpay: new CinetPayGateway(),
      paydunya: new PayDunyaGateway(),
      paygate: new PayGateGateway(),
      mtn_momo: new MTNMomoGateway(),
      orange_money: new OrangeMoneyGateway(),
      mycoolpay: new MyCoolPayGateway()
    };
  }

  getProvider(code) {
    return this.providers[code];
  }

  async resolveGateway(code) {
    if (!code) {
      return null;
    }
    const gateway = await paymentGatewayService.getGatewayByCode(code);
    if (!gateway || !gateway.is_active) {
      return null;
    }
    return gateway;
  }

  async selectGateway({ preferredGateways = [], fallback = [] } = {}) {
    const candidates = [...preferredGateways, ...fallback].filter(Boolean);
    for (const code of candidates) {
      const gateway = await this.resolveGateway(code);
      if (gateway) {
        const provider = this.getProvider(gateway.code);
        if (provider && typeof provider.isReady === 'function') {
          if (provider.isReady(gateway.config || {})) {
            return gateway;
          }
          continue;
        }
        return gateway;
      }
    }
    return null;
  }

  async initiatePayment({ providerCode, amount, currency, description, metadata, customer, returnUrl, cancelUrl, paymentId, useCheckout = false, gatewayConfig = {} }) {
    const provider = this.getProvider(providerCode);
    if (!provider) {
      const error = new Error(`Unsupported payment provider: ${providerCode}`);
      error.code = 'PAYMENT_METHOD_NOT_AVAILABLE';
      throw error;
    }

    if (gatewayConfig && Object.keys(gatewayConfig).length > 0) {
      provider.config = { ...(provider.config || {}), ...gatewayConfig };
    }

    return provider.initiatePayment({
      amount,
      currency,
      description,
      metadata,
      customer,
      returnUrl,
      cancelUrl,
      paymentId,
      useCheckout
    });
  }

  async getPaymentStatus(providerCode, transactionId) {
    const provider = this.getProvider(providerCode);
    if (!provider) {
      return null;
    }
    return provider.getPaymentStatus(transactionId);
  }

  async cancelPayment(providerCode, transactionId) {
    const provider = this.getProvider(providerCode);
    if (!provider) {
      return null;
    }
    return provider.cancelPayment(transactionId);
  }

  async verifyWebhook(providerCode, { rawBody, signature, headers, body }) {
    const provider = this.getProvider(providerCode);
    if (!provider || !provider.verifyWebhook) {
      return { success: true };
    }
    return provider.verifyWebhook({ rawBody, signature, headers, body });
  }

  async parseWebhook(providerCode, event) {
    const provider = this.getProvider(providerCode);
    if (!provider || !provider.parseWebhook) {
      return null;
    }
    return provider.parseWebhook(event);
  }
}

module.exports = new GatewayManager();
