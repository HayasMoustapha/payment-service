const BaseGateway = require('./base.gateway');
const { database } = require('../../config');

/**
 * Gateway Manager - Manages multiple payment providers
 * Handles provider selection, fallback, and routing
 */
class GatewayManager {
  constructor() {
    this.gateways = new Map();
    this.defaultGateway = null;
    this.initialized = false;
  }

  /**
   * Initialize all active gateways from database
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      const gatewaysConfig = await this.loadGatewaysFromDatabase();
      
      for (const config of gatewaysConfig) {
        await this.registerGateway(config);
      }

      // Set default gateway (first active one)
      const activeGateways = Array.from(this.gateways.values()).filter(g => g.isActive);
      if (activeGateways.length > 0) {
        this.defaultGateway = activeGateways[0];
      }

      this.initialized = true;
      console.log(`Gateway Manager initialized with ${this.gateways.size} providers`);
      
    } catch (error) {
      console.error('Failed to initialize Gateway Manager:', error);
      throw error;
    }
  }

  /**
   * Load gateways configuration from database
   * @returns {Promise<Array>} Array of gateway configurations
   */
  async loadGatewaysFromDatabase() {
    const query = `
      SELECT * FROM payment_gateways 
      WHERE is_active = true 
      ORDER BY created_at ASC
    `;
    
    const result = await database.query(query);
    return result.rows;
  }

  /**
   * Register a gateway instance
   * @param {Object} config - Gateway configuration
   * @returns {Promise<void>}
   */
  async registerGateway(config) {
    try {
      const GatewayClass = this.getGatewayClass(config.code);
      const gateway = new GatewayClass(config);
      
      await gateway.initialize();
      
      this.gateways.set(config.code, gateway);
      console.log(`Gateway ${config.code} registered successfully`);
      
    } catch (error) {
      console.error(`Failed to register gateway ${config.code}:`, error);
      // Continue with other gateways
    }
  }

  /**
   * Get gateway class by code
   * @param {string} code - Gateway code
   * @returns {Class} Gateway class
   */
  getGatewayClass(code) {
    const gatewayClasses = {
      'stripe': require('../stripe/stripe.gateway'),
      'paypal': require('../paypal/paypal.gateway'),
      'paygate': require('../african/paygate.gateway'),
      'paydunya': require('../african/paydunya.gateway'),
      'cinetpay': require('../african/cinetpay.gateway'),
      'mtn_momo': require('../african/mtn-momo.gateway'),
      'orange_money': require('../african/orange-money.gateway'),
      'mycoolpay': require('../african/mycoolpay.gateway')
    };

    const GatewayClass = gatewayClasses[code];
    if (!GatewayClass) {
      throw new Error(`Unknown gateway code: ${code}`);
    }

    return GatewayClass;
  }

  /**
   * Get gateway by code
   * @param {string} code - Gateway code
   * @returns {BaseGateway|null} Gateway instance
   */
  getGateway(code) {
    return this.gateways.get(code) || null;
  }

  /**
   * Get all active gateways
   * @returns {BaseGateway[]} Array of active gateways
   */
  getActiveGateways() {
    return Array.from(this.gateways.values()).filter(g => g.isActive);
  }

  /**
   * Get default gateway
   * @returns {BaseGateway|null} Default gateway
   */
  getDefaultGateway() {
    return this.defaultGateway;
  }

  /**
   * Select best gateway for payment
   * @param {Object} criteria - Selection criteria
   * @param {number} criteria.amount - Payment amount
   * @param {string} criteria.currency - Currency code
   * @param {string} criteria.country - Country code
   * @param {string[]} criteria.preferredGateways - Preferred gateway codes
   * @returns {BaseGateway|null} Selected gateway
   */
  selectGateway(criteria) {
    const { amount, currency, country, preferredGateways = [] } = criteria;
    const activeGateways = this.getActiveGateways();

    // Filter gateways that support the requirements
    let suitableGateways = activeGateways.filter(gateway => {
      return gateway.isAmountValid(amount) &&
             gateway.isCurrencySupported(currency) &&
             gateway.isCountrySupported(country);
    });

    // If preferred gateways specified, prioritize them
    if (preferredGateways.length > 0) {
      const preferred = suitableGateways.filter(g => preferredGateways.includes(g.code));
      if (preferred.length > 0) {
        suitableGateways = preferred;
      }
    }

    // Return the first suitable gateway or default
    return suitableGateways.length > 0 ? suitableGateways[0] : this.defaultGateway;
  }

  /**
   * Process payment with automatic gateway selection
   * @param {Object} paymentData - Payment data
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { amount, currency = 'EUR', country = 'FR', preferredGateways } = paymentData;
    
    // Select appropriate gateway
    const gateway = this.selectGateway({
      amount,
      currency,
      country,
      preferredGateways
    });

    if (!gateway) {
      throw new Error('No suitable payment gateway available');
    }

    try {
      // Process payment with selected gateway
      const result = await gateway.processPayment(paymentData);
      
      return {
        success: true,
        gateway: gateway.code,
        ...result
      };

    } catch (error) {
      // Try fallback gateways if configured
      if (options.enableFallback && preferredGateways.length > 1) {
        const fallbackGateways = preferredGateways.filter(code => code !== gateway.code);
        
        for (const fallbackCode of fallbackGateways) {
          const fallbackGateway = this.getGateway(fallbackCode);
          if (fallbackGateway && fallbackGateway.isAmountValid(amount)) {
            try {
              const result = await fallbackGateway.processPayment(paymentData);
              return {
                success: true,
                gateway: fallbackGateway.code,
                fallback: true,
                originalGateway: gateway.code,
                ...result
              };
            } catch (fallbackError) {
              console.warn(`Fallback gateway ${fallbackCode} also failed:`, fallbackError.message);
              continue;
            }
          }
        }
      }

      throw error;
    }
  }

  /**
   * Verify webhook with appropriate gateway
   * @param {string} gatewayCode - Gateway code
   * @param {Object} webhookData - Webhook data
   * @returns {Promise<Object>} Verification result
   */
  async verifyWebhook(gatewayCode, webhookData) {
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Unknown gateway: ${gatewayCode}`);
    }

    return await gateway.verifyWebhookSignature(
      webhookData.payload,
      webhookData.signature,
      webhookData.secret
    );
  }

  /**
   * Parse webhook event
   * @param {string} gatewayCode - Gateway code
   * @param {Object} webhookData - Webhook data
   * @returns {Promise<Object>} Parsed event
   */
  async parseWebhookEvent(gatewayCode, webhookData) {
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Unknown gateway: ${gatewayCode}`);
    }

    return await gateway.parseWebhookEvent(webhookData);
  }

  /**
   * Get payment status from appropriate gateway
   * @param {string} gatewayCode - Gateway code
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(gatewayCode, transactionId) {
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Unknown gateway: ${gatewayCode}`);
    }

    return await gateway.getPaymentStatus(transactionId);
  }

  /**
   * Refund payment with appropriate gateway
   * @param {string} gatewayCode - Gateway code
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(gatewayCode, transactionId, amount, reason) {
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Unknown gateway: ${gatewayCode}`);
    }

    return await gateway.refundPayment(transactionId, amount, reason);
  }

  /**
   * Create payout with appropriate gateway
   * @param {string} gatewayCode - Gateway code
   * @param {Object} payoutData - Payout data
   * @returns {Promise<Object>} Payout result
   */
  async createPayout(gatewayCode, payoutData) {
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Unknown gateway: ${gatewayCode}`);
    }

    return await gateway.createPayout(payoutData);
  }

  /**
   * Get gateway statistics
   * @returns {Object} Gateway statistics
   */
  getStatistics() {
    const gateways = Array.from(this.gateways.values());
    
    return {
      total: gateways.length,
      active: gateways.filter(g => g.isActive).length,
      default: this.defaultGateway?.code || null,
      gateways: gateways.map(g => ({
        code: g.code,
        name: g.name,
        active: g.isActive,
        currencies: g.getSupportedCurrencies(),
        countries: g.getSupportedCountries(),
        minAmount: g.getMinimumAmount(),
        maxAmount: g.getMaximumAmount()
      }))
    };
  }

  /**
   * Reload gateway configurations from database
   * @returns {Promise<void>}
   */
  async reload() {
    this.gateways.clear();
    this.defaultGateway = null;
    this.initialized = false;
    await this.initialize();
  }
}

// Singleton instance
const gatewayManager = new GatewayManager();

module.exports = gatewayManager;
