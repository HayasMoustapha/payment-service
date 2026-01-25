const BaseGateway = require('../providers/base.gateway');
const axios = require('axios');

/**
 * CinetPay Gateway Implementation
 * Handles payments via CinetPay (African payment provider)
 */
class CinetPayGateway extends BaseGateway {
  constructor(config) {
    super(config);
    this.apiKey = config.config?.api_key || process.env.CINETPAY_API_KEY;
    this.apiSecret = config.config?.api_secret || process.env.CINETPAY_API_SECRET;
    this.siteId = config.config?.site_id || process.env.CINETPAY_SITE_ID;
    this.baseUrl = config.config?.base_url || 'https://api.cinetpay.com/v1';
    this.notifyUrl = config.config?.notify_url || process.env.CINETPAY_NOTIFY_URL;
    this.returnUrl = config.config?.return_url || process.env.CINETPAY_RETURN_URL;
  }

  /**
   * Initialize CinetPay gateway
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      // Test API connection
      const response = await axios.get(`${this.baseUrl}/auth/check`, {
        headers: {
          'apikey': this.apiKey,
          'secretkey': this.apiSecret
        }
      });

      if (response.data.status !== 200) {
        throw new Error('CinetPay API authentication failed');
      }

      this.log('initialize', { status: 'success' });
      return true;
    } catch (error) {
      this.log('initialize', { error: error.message }, 'error');
      throw error;
    }
  }

  /**
   * Process payment with CinetPay
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    try {
      const {
        amount,
        currency = 'XOF', // CinetPay primarily uses XOF
        description,
        metadata = {},
        customerEmail,
        returnUrl,
        customerName,
        customerPhone
      } = paymentData;

      // Convert amount to XOF if needed (approximate rate)
      const amountInXOF = this.convertToXOF(amount, currency);

      const paymentDataForCinetPay = {
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: this.generateReference('CINET'),
        amount: amountInXOF,
        currency: 'XOF',
        description: description || 'Payment via CinetPay',
        customer_name: customerName || 'Customer',
        customer_surname: customerName || 'Customer',
        customer_email: customerEmail || '',
        customer_phone_number: customerPhone || '',
        customer_address: '',
        customer_city: '',
        customer_country: 'CI', // Default to Ivory Coast
        notify_url: this.notifyUrl,
        return_url: returnUrl?.success || this.returnUrl,
        channels: 'ALL',
        metadata: JSON.stringify({
          ...metadata,
          originalAmount: amount,
          originalCurrency: currency
        })
      };

      const response = await axios.post(
        `${this.baseUrl}/payment/check`,
        paymentDataForCinetPay
      );

      this.log('processPayment', {
        transactionId: paymentDataForCinetPay.transaction_id,
        amount: amountInXOF,
        currency: 'XOF',
        status: response.data.status
      });

      return {
        success: true,
        transactionId: paymentDataForCinetPay.transaction_id,
        status: response.data.status === '00' ? 'pending' : 'failed',
        paymentUrl: response.data.payment_url,
        amount: amountInXOF,
        currency: 'XOF',
        originalAmount: amount,
        originalCurrency: currency,
        metadata: JSON.parse(paymentDataForCinetPay.metadata)
      };

    } catch (error) {
      return this.handleError(error, 'processPayment');
    }
  }

  /**
   * Verify CinetPay webhook signature
   * @param {string} payload - Raw payload
   * @param {string} signature - Signature (CinetPay uses different method)
   * @param {string} secret - API secret
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature(payload, signature, secret) {
    try {
      // CinetPay uses API key verification instead of signature
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return data.apikey === this.apiKey && data.site_id === this.siteId;
    } catch (error) {
      this.log('verifyWebhookSignature', { error: error.message }, 'error');
      return false;
    }
  }

  /**
   * Parse CinetPay webhook event
   * @param {Object} webhookData - Webhook data
   * @returns {Promise<Object>} Parsed event
   */
  async parseWebhookEvent(webhookData) {
    try {
      const event = typeof webhookData === 'string' ? JSON.parse(webhookData) : webhookData;
      
      const parsedEvent = {
        eventType: this.mapCinetPayStatus(event.status),
        eventId: event.transaction_id,
        timestamp: new Date().toISOString(),
        data: {
          transactionId: event.transaction_id,
          status: this.mapCinetPayStatus(event.status),
          amount: this.parseAmount(event.amount, 'XOF'),
          currency: event.currency || 'XOF',
          paymentMethod: event.payment_method,
          operatorId: event.operator_id,
          metadata: event.metadata ? JSON.parse(event.metadata) : {}
        }
      };

      this.log('parseWebhookEvent', {
        transactionId: event.transaction_id,
        status: event.status,
        eventType: parsedEvent.eventType
      });

      return parsedEvent;

    } catch (error) {
      return this.handleError(error, 'parseWebhookEvent');
    }
  }

  /**
   * Get payment status from CinetPay
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(transactionId) {
    try {
      const response = await axios.post(`${this.baseUrl}/payment/check`, {
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: transactionId
      });

      return {
        success: true,
        transactionId,
        status: this.mapCinetPayStatus(response.data.status),
        amount: this.parseAmount(response.data.amount, 'XOF'),
        currency: response.data.currency || 'XOF',
        paymentMethod: response.data.payment_method,
        operatorId: response.data.operator_id,
        createdAt: response.data.created_at,
        metadata: response.data.metadata ? JSON.parse(response.data.metadata) : {}
      };

    } catch (error) {
      return this.handleError(error, 'getPaymentStatus');
    }
  }

  /**
   * Refund payment with CinetPay
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(transactionId, amount, reason) {
    try {
      // CinetPay refund process
      const response = await axios.post(`${this.baseUrl}/payment/refund`, {
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: transactionId,
        amount: this.convertToXOF(amount),
        reason: reason || 'Customer refund'
      });

      this.log('refundPayment', {
        transactionId,
        amount,
        status: response.data.status
      });

      return {
        success: response.data.status === '00',
        refundId: response.data.refund_id || transactionId,
        transactionId,
        amount: this.parseAmount(response.data.amount || this.convertToXOF(amount), 'XOF'),
        currency: 'XOF',
        status: response.data.status === '00' ? 'completed' : 'failed',
        reason
      };

    } catch (error) {
      return this.handleError(error, 'refundPayment');
    }
  }

  /**
   * Create payout with CinetPay
   * @param {Object} payoutData - Payout data
   * @returns {Promise<Object>} Payout result
   */
  async createPayout(payoutData) {
    try {
      const { amount, recipient, description } = payoutData;

      const payoutParams = {
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: this.generateReference('PAYOUT'),
        amount: this.convertToXOF(amount),
        currency: 'XOF',
        description: description || 'Payout via CinetPay',
        recipient_phone: recipient.phone,
        recipient_name: recipient.name,
        notify_url: this.notifyUrl
      };

      const response = await axios.post(
        `${this.baseUrl}/transfer/check`,
        payoutParams
      );

      this.log('createPayout', {
        payoutId: payoutParams.transaction_id,
        amount: payoutParams.amount,
        status: response.data.status
      });

      return {
        success: response.data.status === '00',
        payoutId: payoutParams.transaction_id,
        amount: this.parseAmount(payoutParams.amount, 'XOF'),
        currency: 'XOF',
        status: response.data.status === '00' ? 'pending' : 'failed',
        transferUrl: response.data.transfer_url
      };

    } catch (error) {
      return this.handleError(error, 'createPayout');
    }
  }

  /**
   * Validate payment method for CinetPay
   * @param {Object} paymentMethod - Payment method details
   * @returns {Promise<Object>} Validation result
   */
  async validatePaymentMethod(paymentMethod) {
    try {
      // CinetPay supports various African payment methods
      const supportedMethods = [
        'mtn_money', 'orange_money', 'wave', 'moov_money',
        'card', 'bank_transfer'
      ];

      if (supportedMethods.includes(paymentMethod.type)) {
        return {
          success: true,
          valid: true,
          method: paymentMethod.type,
          supported: true
        };
      }

      return {
        success: true,
        valid: false,
        error: `Payment method ${paymentMethod.type} not supported`,
        supportedMethods
      };

    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Map CinetPay status to standard status
   * @param {string} cinetPayStatus - CinetPay status
   * @returns {string} Standard status
   */
  mapCinetPayStatus(cinetPayStatus) {
    const statusMap = {
      '00': 'completed',    // Transaction successful
      '01': 'failed',       // Transaction failed
      '02': 'pending',      // Transaction pending
      '03': 'canceled',     // Transaction canceled
      '04': 'refunded'      // Transaction refunded
    };

    return statusMap[cinetPayStatus] || 'pending';
  }

  /**
   * Convert amount to XOF (CFA Franc)
   * @param {number} amount - Original amount
   * @param {string} fromCurrency - Original currency
   * @returns {number} Amount in XOF
   */
  convertToXOF(amount, fromCurrency = 'EUR') {
    // Approximate conversion rates (should use real API in production)
    const rates = {
      'EUR': 655.96,  // 1 EUR = 655.96 XOF
      'USD': 600.00,  // 1 USD = 600 XOF (approximate)
      'XOF': 1.00     // No conversion needed
    };

    const rate = rates[fromCurrency] || 655.96;
    return Math.round(amount * rate);
  }

  /**
   * Parse amount from XOF to original currency
   * @param {number} amount - Amount in XOF
   * @param {string} currency - Target currency
   * @returns {number} Parsed amount
   */
  parseAmount(amount, currency = 'XOF') {
    if (currency === 'XOF') {
      return amount;
    }

    // Convert back from XOF
    const rates = {
      'EUR': 655.96,
      'USD': 600.00,
      'XOF': 1.00
    };

    const rate = rates[currency] || 655.96;
    return Math.round((amount / rate) * 100) / 100;
  }

  /**
   * Get supported currencies for CinetPay
   * @returns {string[]} Supported currencies
   */
  getSupportedCurrencies() {
    return ['XOF', 'XAF', 'EUR', 'USD']; // CFA Francs and major currencies
  }

  /**
   * Get supported countries for CinetPay
   * @returns {string[]} Supported country codes
   */
  getSupportedCountries() {
    return [
      'CI', // Ivory Coast
      'SN', // Senegal
      'ML', // Mali
      'BF', // Burkina Faso
      'NE', // Niger
      'TG', // Togo
      'BJ', // Benin
      'CM', // Cameroon
      'CF', // Central African Republic
      'TD', // Chad
      'GA', // Gabon
      'CG', // Congo
      'CD', // Democratic Republic of Congo
      'GQ'  // Equatorial Guinea
    ];
  }
}

module.exports = CinetPayGateway;
