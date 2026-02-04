class BaseGateway {
  constructor({ code, name, config = {} } = {}) {
    this.code = code;
    this.name = name || code;
    this.config = config || {};
  }

  getConfigValue(key, fallback = null) {
    if (this.config && this.config[key] !== undefined) {
      return this.config[key];
    }
    return fallback;
  }

  assertConfig(value, label) {
    if (!value) {
      const error = new Error(`${this.code} configuration missing: ${label}`);
      error.code = 'CONFIGURATION_ERROR';
      throw error;
    }
  }

  async initiatePayment() {
    throw new Error(`${this.code} initiatePayment not implemented`);
  }

  async getPaymentStatus() {
    throw new Error(`${this.code} getPaymentStatus not implemented`);
  }

  async cancelPayment() {
    throw new Error(`${this.code} cancelPayment not implemented`);
  }

  async verifyWebhook() {
    return { success: true };
  }

  async parseWebhook() {
    throw new Error(`${this.code} parseWebhook not implemented`);
  }
}

module.exports = BaseGateway;
