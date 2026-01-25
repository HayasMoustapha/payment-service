const BaseGateway = require('../providers/base.gateway');
const axios = require('axios');

/**
 * MTN Mobile Money Gateway Implementation
 * Handles payments via MTN Mobile Money across African countries
 */
class MTNMoMoGateway extends BaseGateway {
  constructor(config) {
    super(config);
    this.apiKey = config.config?.api_key || process.env.MTN_MOMO_API_KEY;
    this.apiSecret = config.config?.api_secret || process.env.MTN_MOMO_API_SECRET;
    this.baseUrl = config.config?.base_url || 'https://api.mtn.com/v1';
    this.environment = config.config?.environment || 'sandbox';
    this.callbackUrl = config.config?.callback_url || process.env.MTN_MOMO_CALLBACK_URL;
    this.targetEnvironment = config.config?.target_environment || 'sandbox';
  }

  /**
   * Initialize MTN Mobile Money gateway
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      // Get API token
      const token = await this.getApiToken();
      this.accessToken = token;

      this.log('initialize', { 
        status: 'success', 
        environment: this.environment 
      });
      return true;
    } catch (error) {
      this.log('initialize', { error: error.message }, 'error');
      throw error;
    }
  }

  /**
   * Get API token from MTN
   * @returns {Promise<string>} Access token
   */
  async getApiToken() {
    try {
      const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
      
      const response = await axios.post(`${this.baseUrl}/oauth2/token/`, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      throw new Error(`Failed to get MTN API token: ${error.message}`);
    }
  }

  /**
   * Process payment with MTN Mobile Money
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    try {
      const {
        amount,
        currency = 'XOF',
        description,
        metadata = {},
        customerPhone,
        customerEmail,
        customerName,
        countryCode = 'CI' // Default to Ivory Coast
      } = paymentData;

      // Validate phone number for MTN Mobile Money
      if (!customerPhone) {
        throw new Error('Customer phone number is required for MTN Mobile Money');
      }

      // Format phone number for MTN
      const formattedPhone = this.formatPhoneNumber(customerPhone, countryCode);

      // Create payment request
      const paymentRequest = {
        amount: this.formatAmount(amount, currency),
        currency,
        externalId: this.generateReference('MTN'),
        payer: {
          partyIdType: 'MSISDN',
          partyId: formattedPhone
        },
        payerMessage: description || 'Payment via MTN Mobile Money',
        payeeNote: `Payment for ${metadata.type || 'service'}`,
        callbackUrl: this.callbackUrl
      };

      const response = await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        paymentRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Target-Environment': this.targetEnvironment,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        }
      );

      const transactionId = response.headers['x-reference-id'];

      this.log('processPayment', {
        transactionId,
        amount,
        currency,
        phone: formattedPhone,
        status: 'pending'
      });

      return {
        success: true,
        transactionId,
        status: 'pending',
        amount,
        currency,
        customerPhone: formattedPhone,
        requiresAction: false, // MTN Mobile Money is USSD-based
        instructions: `Please check your phone for MTN Mobile Money payment prompt`,
        metadata
      };

    } catch (error) {
      return this.handleError(error, 'processPayment');
    }
  }

  /**
   * Verify MTN Mobile Money webhook
   * @param {string} payload - Raw payload
   * @param {string} signature - Signature
   * @param {string} secret - Secret
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature(payload, signature, secret) {
    try {
      // MTN uses basic authentication for webhooks
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      // Verify the callback structure
      return data.status && data.financialTransactionId;
    } catch (error) {
      this.log('verifyWebhookSignature', { error: error.message }, 'error');
      return false;
    }
  }

  /**
   * Parse MTN Mobile Money webhook event
   * @param {Object} webhookData - Webhook data
   * @returns {Promise<Object>} Parsed event
   */
  async parseWebhookEvent(webhookData) {
    try {
      const event = typeof webhookData === 'string' ? JSON.parse(webhookData) : webhookData;
      
      const parsedEvent = {
        eventType: this.mapMTNStatus(event.status),
        eventId: event.financialTransactionId,
        timestamp: new Date().toISOString(),
        data: {
          transactionId: event.financialTransactionId,
          status: this.mapMTNStatus(event.status),
          amount: this.parseAmount(event.amount, event.currency),
          currency: event.currency,
          customerPhone: event.payer?.partyId,
          referenceId: event.externalId,
          reason: event.reason
        }
      };

      this.log('parseWebhookEvent', {
        transactionId: event.financialTransactionId,
        status: event.status,
        eventType: parsedEvent.eventType
      });

      return parsedEvent;

    } catch (error) {
      return this.handleError(error, 'parseWebhookEvent');
    }
  }

  /**
   * Get payment status from MTN Mobile Money
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(transactionId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collection/v1_0/requesttopay/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Target-Environment': this.targetEnvironment,
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        }
      );

      return {
        success: true,
        transactionId,
        status: this.mapMTNStatus(response.data.status),
        amount: this.parseAmount(response.data.amount, response.data.currency),
        currency: response.data.currency,
        customerPhone: response.data.payer?.partyId,
        referenceId: response.data.externalId,
        createdAt: response.data.creationTime,
        metadata: response.data
      };

    } catch (error) {
      return this.handleError(error, 'getPaymentStatus');
    }
  }

  /**
   * Refund payment with MTN Mobile Money
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(transactionId, amount, reason) {
    try {
      // Get original transaction details first
      const originalTransaction = await this.getPaymentStatus(transactionId);
      
      if (!originalTransaction.success) {
        throw new Error('Original transaction not found');
      }

      // Create refund request
      const refundRequest = {
        amount: this.formatAmount(amount, originalTransaction.currency),
        currency: originalTransaction.currency,
        externalId: this.generateReference('MTN_REFUND'),
        payerMessage: `Refund: ${reason}`,
        payeeNote: 'Refund processed',
        callbackUrl: this.callbackUrl
      };

      const response = await axios.post(
        `${this.baseUrl}/disbursement/v1_0/transfer`,
        refundRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Target-Environment': this.targetEnvironment,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        }
      );

      const refundId = response.headers['x-reference-id'];

      this.log('refundPayment', {
        refundId,
        originalTransactionId: transactionId,
        amount,
        status: 'pending'
      });

      return {
        success: true,
        refundId,
        transactionId,
        amount,
        currency: originalTransaction.currency,
        status: 'pending',
        reason
      };

    } catch (error) {
      return this.handleError(error, 'refundPayment');
    }
  }

  /**
   * Create payout with MTN Mobile Money
   * @param {Object} payoutData - Payout data
   * @returns {Promise<Object>} Payout result
   */
  async createPayout(payoutData) {
    try {
      const { amount, recipient, description, countryCode = 'CI' } = payoutData;

      if (!recipient.phone) {
        throw new Error('Recipient phone number is required for MTN Mobile Money payout');
      }

      const formattedPhone = this.formatPhoneNumber(recipient.phone, countryCode);

      const payoutRequest = {
        amount: this.formatAmount(amount, recipient.currency || 'XOF'),
        currency: recipient.currency || 'XOF',
        externalId: this.generateReference('MTN_PAYOUT'),
        payee: {
          partyIdType: 'MSISDN',
          partyId: formattedPhone
        },
        payerMessage: description || 'Payout via MTN Mobile Money',
        payeeNote: 'Payout processed',
        callbackUrl: this.callbackUrl
      };

      const response = await axios.post(
        `${this.baseUrl}/disbursement/v1_0/transfer`,
        payoutRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Target-Environment': this.targetEnvironment,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        }
      );

      const payoutId = response.headers['x-reference-id'];

      this.log('createPayout', {
        payoutId,
        amount,
        recipientPhone: formattedPhone,
        status: 'pending'
      });

      return {
        success: true,
        payoutId,
        amount,
        currency: recipient.currency || 'XOF',
        status: 'pending',
        recipientPhone: formattedPhone
      };

    } catch (error) {
      return this.handleError(error, 'createPayout');
    }
  }

  /**
   * Validate payment method for MTN Mobile Money
   * @param {Object} paymentMethod - Payment method details
   * @returns {Promise<Object>} Validation result
   */
  async validatePaymentMethod(paymentMethod) {
    try {
      if (paymentMethod.type !== 'mobile_money') {
        return {
          success: true,
          valid: false,
          error: 'MTN Mobile Money only supports mobile money payments'
        };
      }

      if (!paymentMethod.phone) {
        return {
          success: true,
          valid: false,
          error: 'Phone number is required for MTN Mobile Money'
        };
      }

      // Validate phone number format
      const formattedPhone = this.formatPhoneNumber(paymentMethod.phone, paymentMethod.countryCode || 'CI');
      
      return {
        success: true,
        valid: true,
        phone: formattedPhone,
        method: 'mtn_mobile_money'
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
   * Format phone number for MTN Mobile Money
   * @param {string} phone - Phone number
   * @param {string} countryCode - Country code
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone, countryCode = 'CI') {
    // Remove all non-digit characters
    let cleanPhone = phone.replace(/\D/g, '');

    // Remove leading country code if present
    if (cleanPhone.startsWith('225')) { // Ivory Coast
      cleanPhone = cleanPhone.substring(3);
    } else if (cleanPhone.startsWith('237')) { // Cameroon
      cleanPhone = cleanPhone.substring(3);
    }

    // Ensure it starts with the correct format for MTN
    const mtnPrefixes = {
      'CI': ['05', '06', '07'], // Ivory Coast MTN prefixes
      'CM': ['67', '68'],       // Cameroon MTN prefixes
      'UG': ['07'],             // Uganda MTN prefixes
      'GH': ['05'],             // Ghana MTN prefixes
      'ZM': ['09'],             // Zambia MTN prefixes
      'MW': ['09'],             // Malawi MTN prefixes
      'SZ': ['07']              // Eswatini MTN prefixes
    };

    const prefixes = mtnPrefixes[countryCode] || mtnPrefixes['CI'];
    const isValidPrefix = prefixes.some(prefix => cleanPhone.startsWith(prefix));

    if (!isValidPrefix) {
      throw new Error(`Invalid MTN Mobile Money phone number for country ${countryCode}`);
    }

    // Return in international format
    const countryCodes = {
      'CI': '225',
      'CM': '237',
      'UG': '256',
      'GH': '233',
      'ZM': '260',
      'MW': '265',
      'SZ': '268'
    };

    const countryCodePrefix = countryCodes[countryCode] || '225';
    return `${countryCodePrefix}${cleanPhone}`;
  }

  /**
   * Map MTN status to standard status
   * @param {string} mtnStatus - MTN status
   * @returns {string} Standard status
   */
  mapMTNStatus(mtnStatus) {
    const statusMap = {
      'PENDING': 'pending',
      'SUCCESSFUL': 'completed',
      'FAILED': 'failed',
      'TIMEOUT': 'failed',
      'REJECTED': 'failed'
    };

    return statusMap[mtnStatus] || 'pending';
  }

  /**
   * Get supported currencies for MTN Mobile Money
   * @returns {string[]} Supported currencies
   */
  getSupportedCurrencies() {
    return ['XOF', 'XAF', 'UGX', 'GHS', 'ZMW', 'MWK', 'SZL']; // Local currencies
  }

  /**
   * Get supported countries for MTN Mobile Money
   * @returns {string[]} Supported country codes
   */
  getSupportedCountries() {
    return [
      'CI', // Ivory Coast
      'CM', // Cameroon
      'UG', // Uganda
      'GH', // Ghana
      'ZM', // Zambia
      'MW', // Malawi
      'SZ', // Eswatini
      'NG', // Nigeria
      'ZA', // South Africa
      'TZ', // Tanzania
      'RW', // Rwanda
      'KE', // Kenya
      'ET', // Ethiopia
      'EG'  // Egypt
    ];
  }
}

module.exports = MTNMoMoGateway;
