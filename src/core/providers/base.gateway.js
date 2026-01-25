/**
 * Base Gateway Class - Abstraction for Payment Providers
 * All payment providers must extend this class
 */
class BaseGateway {
  constructor(config) {
    this.config = config;
    this.name = config.name;
    this.code = config.code;
    this.isActive = config.is_active || false;
  }

  /**
   * Initialize the gateway with provider-specific configuration
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    throw new Error('initialize() method must be implemented by provider');
  }

  /**
   * Process a payment
   * @param {Object} paymentData - Payment information
   * @param {number} paymentData.amount - Amount in smallest currency unit
   * @param {string} paymentData.currency - Currency code (ISO 4217)
   * @param {string} paymentData.description - Payment description
   * @param {Object} paymentData.metadata - Additional metadata
   * @param {string} paymentData.customerEmail - Customer email
   * @param {Object} paymentData.returnUrl - Return URLs for success/cancel
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    throw new Error('processPayment() method must be implemented by provider');
  }

  /**
   * Verify a payment/webhook signature
   * @param {string} payload - Raw payload
   * @param {string} signature - Signature to verify
   * @param {string} secret - Webhook secret
   * @returns {Promise<boolean>} True if signature valid
   */
  async verifyWebhookSignature(payload, signature, secret) {
    throw new Error('verifyWebhookSignature() method must be implemented by provider');
  }

  /**
   * Parse webhook event
   * @param {Object} webhookData - Raw webhook data
   * @returns {Promise<Object>} Parsed event data
   */
  async parseWebhookEvent(webhookData) {
    throw new Error('parseWebhookEvent() method must be implemented by provider');
  }

  /**
   * Get payment status
   * @param {string} transactionId - Provider transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(transactionId) {
    throw new Error('getPaymentStatus() method must be implemented by provider');
  }

  /**
   * Refund a payment
   * @param {string} transactionId - Original transaction ID
   * @param {number} amount - Amount to refund (in smallest currency unit)
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(transactionId, amount, reason) {
    throw new Error('refundPayment() method must be implemented by provider');
  }

  /**
   * Create payout/withdrawal
   * @param {Object} payoutData - Payout information
   * @param {number} payoutData.amount - Amount in smallest currency unit
   * @param {string} payoutData.currency - Currency code
   * @param {Object} payoutData.recipient - Recipient information
   * @param {string} payoutData.description - Payout description
   * @returns {Promise<Object>} Payout result
   */
  async createPayout(payoutData) {
    throw new Error('createPayout() method must be implemented by provider');
  }

  /**
   * Get payout status
   * @param {string} payoutId - Provider payout ID
   * @returns {Promise<Object>} Payout status
   */
  async getPayoutStatus(payoutId) {
    throw new Error('getPayoutStatus() method must be implemented by provider');
  }

  /**
   * Validate payment method details
   * @param {Object} paymentMethod - Payment method details
   * @returns {Promise<Object>} Validation result
   */
  async validatePaymentMethod(paymentMethod) {
    throw new Error('validatePaymentMethod() method must be implemented by provider');
  }

  /**
   * Get supported currencies
   * @returns {string[]} Array of supported currency codes
   */
  getSupportedCurrencies() {
    return this.config.supported_currencies || ['EUR'];
  }

  /**
   * Get supported countries
   * @returns {string[]} Array of supported country codes
   */
  getSupportedCountries() {
    return this.config.supported_countries || [];
  }

  /**
   * Get minimum amount
   * @returns {number} Minimum amount in smallest currency unit
   */
  getMinimumAmount() {
    return this.config.min_amount || 50; // 0.50 EUR
  }

  /**
   * Get maximum amount
   * @returns {number} Maximum amount in smallest currency unit
   */
  getMaximumAmount() {
    return this.config.max_amount || 10000000; // 100,000 EUR
  }

  /**
   * Check if amount is within limits
   * @param {number} amount - Amount to check
   * @returns {boolean} True if amount is valid
   */
  isAmountValid(amount) {
    return amount >= this.getMinimumAmount() && amount <= this.getMaximumAmount();
  }

  /**
   * Check if currency is supported
   * @param {string} currency - Currency code
   * @returns {boolean} True if currency is supported
   */
  isCurrencySupported(currency) {
    return this.getSupportedCurrencies().includes(currency);
  }

  /**
   * Check if country is supported
   * @param {string} country - Country code
   * @returns {boolean} True if country is supported
   */
  isCountrySupported(country) {
    const supportedCountries = this.getSupportedCountries();
    return supportedCountries.length === 0 || supportedCountries.includes(country);
  }

  /**
   * Format amount for provider (cents vs decimal)
   * @param {number} amount - Amount in decimal
   * @param {string} currency - Currency code
   * @returns {number} Formatted amount
   */
  formatAmount(amount, currency = 'EUR') {
    // Most providers use cents (smallest currency unit)
    return Math.round(amount * 100);
  }

  /**
   * Parse amount from provider format
   * @param {number} amount - Amount in provider format
   * @param {string} currency - Currency code
   * @returns {number} Amount in decimal
   */
  parseAmount(amount, currency = 'EUR') {
    // Most providers use cents (smallest currency unit)
    return amount / 100;
  }

  /**
   * Generate unique reference for tracking
   * @param {string} prefix - Reference prefix
   * @returns {string} Unique reference
   */
  generateReference(prefix = 'PAY') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Log gateway operation
   * @param {string} operation - Operation type
   * @param {Object} data - Operation data
   * @param {string} level - Log level (info, warn, error)
   */
  log(operation, data, level = 'info') {
    const logData = {
      gateway: this.code,
      operation,
      timestamp: new Date().toISOString(),
      ...data
    };

    console[level](`[PAYMENT_GATEWAY:${this.code}]`, JSON.stringify(logData, null, 2));
  }

  /**
   * Handle gateway errors consistently
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @returns {Object} Standardized error response
   */
  handleError(error, operation) {
    this.log(operation, {
      error: error.message,
      stack: error.stack
    }, 'error');

    return {
      success: false,
      error: {
        code: error.code || 'GATEWAY_ERROR',
        message: error.message || 'Payment gateway error',
        operation,
        gateway: this.code
      }
    };
  }
}

module.exports = BaseGateway;
