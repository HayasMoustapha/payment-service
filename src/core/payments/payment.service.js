const gatewayManager = require('../providers/gateway.manager');
const { database } = require('../../config');

/**
 * Payment Service - Main payment processing service
 * Handles all payment operations with gateway abstraction
 */
class PaymentService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the payment service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      await gatewayManager.initialize();
      this.initialized = true;
    }
  }

  /**
   * Process a payment transaction
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    await this.initialize();

    const {
      userId,
      eventId,
      amount,
      currency = 'EUR',
      paymentMethod,
      description,
      metadata = {},
      customerEmail,
      returnUrl,
      preferredGateways = []
    } = paymentData;

    try {
      // Validate payment data
      this.validatePaymentData(paymentData);

      // Create transaction record
      const transaction = await this.createTransaction({
        user_id: userId,
        event_id: eventId,
        amount,
        currency,
        status: 'pending',
        payment_method: paymentMethod,
        metadata: {
          ...metadata,
          description,
          customerEmail,
          returnUrl: JSON.stringify(returnUrl),
          preferredGateways: JSON.stringify(preferredGateways)
        }
      });

      // Process payment with gateway manager
      const gatewayResult = await gatewayManager.processPayment({
        amount,
        currency,
        description,
        metadata: {
          ...metadata,
          transactionId: transaction.id,
          userId,
          eventId
        },
        customerEmail,
        returnUrl,
        preferredGateways
      }, {
        enableFallback: true
      });

      // Update transaction with gateway result
      await this.updateTransaction(transaction.id, {
        status: gatewayResult.status || 'pending',
        provider_transaction_id: gatewayResult.transactionId,
        provider_response: gatewayResult,
        metadata: {
          ...transaction.metadata,
          gateway: gatewayResult.gateway,
          fallback: gatewayResult.fallback || false
        }
      });

      // Create commission if payment successful
      if (gatewayResult.status === 'completed') {
        await this.createCommission(transaction.id, amount, 'ticket_sale');
      }

      return {
        success: true,
        transactionId: transaction.id,
        status: gatewayResult.status || 'pending',
        gateway: gatewayResult.gateway,
        amount,
        currency,
        clientSecret: gatewayResult.clientSecret,
        nextAction: gatewayResult.nextAction,
        requiresAction: !!gatewayResult.nextAction
      };

    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Process template purchase payment
   * @param {Object} templateData - Template purchase data
   * @returns {Promise<Object>} Payment result
   */
  async processTemplatePurchase(templateData) {
    const {
      userId,
      templateId,
      designerId,
      amount,
      currency = 'EUR',
      paymentMethod,
      customerEmail,
      metadata = {}
    } = templateData;

    try {
      // Process payment
      const paymentResult = await this.processPayment({
        userId,
        eventId: null, // Template purchase doesn't have event
        amount,
        currency,
        paymentMethod,
        description: `Template purchase - Template ${templateId}`,
        metadata: {
          ...metadata,
          type: 'template_purchase',
          templateId,
          designerId
        },
        customerEmail
      });

      // If payment successful, credit designer wallet
      if (paymentResult.status === 'completed') {
        await this.creditDesignerWallet(designerId, amount, 'template_sale', {
          templateId,
          transactionId: paymentResult.transactionId
        });
      }

      return paymentResult;

    } catch (error) {
      console.error('Template purchase payment failed:', error);
      throw error;
    }
  }

  /**
   * Verify and process webhook
   * @param {string} gatewayCode - Gateway code
   * @param {Object} webhookData - Webhook data
   * @returns {Promise<Object>} Webhook processing result
   */
  async processWebhook(gatewayCode, webhookData) {
    await this.initialize();

    try {
      // Verify webhook signature
      const isValid = await gatewayManager.verifyWebhook(gatewayCode, webhookData);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Parse webhook event
      const event = await gatewayManager.parseWebhookEvent(gatewayCode, webhookData);

      // Process event based on type
      let result;
      switch (event.eventType) {
        case 'payment_intent.succeeded':
          result = await this.handlePaymentSuccess(event.data);
          break;
        case 'payment_intent.payment_failed':
          result = await this.handlePaymentFailure(event.data);
          break;
        case 'payment_intent.canceled':
          result = await this.handlePaymentCancellation(event.data);
          break;
        default:
          result = { success: true, message: 'Event processed' };
      }

      return {
        success: true,
        eventId: event.eventId,
        eventType: event.eventType,
        processedAt: new Date().toISOString(),
        ...result
      };

    } catch (error) {
      console.error('Webhook processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle successful payment webhook
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentSuccess(eventData) {
    try {
      // Find transaction by provider transaction ID
      const transaction = await this.findTransactionByProviderId(eventData.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction status
      await this.updateTransaction(transaction.id, {
        status: 'completed',
        provider_response: eventData
      });

      // Create commission if not already created
      if (transaction.metadata.type === 'ticket_sale') {
        await this.createCommission(transaction.id, eventData.amount, 'ticket_sale');
      } else if (transaction.metadata.type === 'template_purchase') {
        await this.createCommission(transaction.id, eventData.amount, 'template_sale');
        
        // Credit designer wallet
        const designerId = transaction.metadata.designerId;
        if (designerId) {
          await this.creditDesignerWallet(designerId, eventData.amount, 'template_sale', {
            templateId: transaction.metadata.templateId,
            transactionId: transaction.id
          });
        }
      }

      return {
        success: true,
        transactionId: transaction.id,
        status: 'completed'
      };

    } catch (error) {
      console.error('Payment success handling failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment failure webhook
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentFailure(eventData) {
    try {
      const transaction = await this.findTransactionByProviderId(eventData.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      await this.updateTransaction(transaction.id, {
        status: 'failed',
        provider_response: eventData
      });

      return {
        success: true,
        transactionId: transaction.id,
        status: 'failed'
      };

    } catch (error) {
      console.error('Payment failure handling failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment cancellation webhook
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentCancellation(eventData) {
    try {
      const transaction = await this.findTransactionByProviderId(eventData.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      await this.updateTransaction(transaction.id, {
        status: 'canceled',
        provider_response: eventData
      });

      return {
        success: true,
        transactionId: transaction.id,
        status: 'canceled'
      };

    } catch (error) {
      console.error('Payment cancellation handling failed:', error);
      throw error;
    }
  }

  /**
   * Create transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(transactionData) {
    const query = `
      INSERT INTO transactions (
        user_id, event_id, amount, currency, status, 
        payment_method, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      transactionData.user_id,
      transactionData.event_id,
      transactionData.amount,
      transactionData.currency,
      transactionData.status,
      transactionData.payment_method,
      JSON.stringify(transactionData.metadata)
    ];

    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Update transaction record
   * @param {string} transactionId - Transaction ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransaction(transactionId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    fields.push(`updated_at = NOW()`);
    values.push(transactionId);

    const query = `
      UPDATE transactions 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Find transaction by provider transaction ID
   * @param {string} providerTransactionId - Provider transaction ID
   * @returns {Promise<Object|null>} Transaction
   */
  async findTransactionByProviderId(providerTransactionId) {
    const query = `
      SELECT * FROM transactions 
      WHERE provider_transaction_id = $1
    `;

    const result = await database.query(query, [providerTransactionId]);
    return result.rows[0] || null;
  }

  /**
   * Create commission record
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Transaction amount
   * @param {string} commissionType - Commission type
   * @returns {Promise<Object>} Created commission
   */
  async createCommission(transactionId, amount, commissionType) {
    // Get commission rate (could be from config or database)
    const commissionRate = this.getCommissionRate(commissionType);
    const commissionAmount = amount * commissionRate;

    const query = `
      INSERT INTO commissions (
        transaction_id, commission_rate, commission_amount, 
        commission_type, status, created_at
      )
      VALUES ($1, $2, $3, $4, 'completed', NOW())
      RETURNING *
    `;

    const values = [
      transactionId,
      commissionRate,
      commissionAmount,
      commissionType
    ];

    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Credit designer wallet
   * @param {string} designerId - Designer ID
   * @param {number} amount - Amount to credit
   * @param {string} transactionType - Transaction type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Wallet transaction
   */
  async creditDesignerWallet(designerId, amount, transactionType, metadata = {}) {
    // Get or create designer wallet
    const wallet = await this.getOrCreateWallet(designerId, 'designer');
    
    // Calculate new balance
    const newBalance = parseFloat(wallet.balance) + amount;

    // Create wallet transaction
    const query = `
      INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount, balance_before, 
        balance_after, reference_type, reference_id, 
        description, metadata, created_at
      )
      VALUES ($1, 'credit', $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const values = [
      wallet.id,
      amount,
      wallet.balance,
      newBalance,
      transactionType,
      metadata.transactionId || null,
      `Credit from ${transactionType}`,
      JSON.stringify(metadata)
    ];

    // Update wallet balance
    await this.updateWalletBalance(wallet.id, newBalance);

    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Get or create wallet for user
   * @param {string} userId - User ID
   * @param {string} userType - User type (designer, organizer)
   * @returns {Promise<Object>} Wallet
   */
  async getOrCreateWallet(userId, userType) {
    // Try to get existing wallet
    const getQuery = `
      SELECT * FROM wallets WHERE user_id = $1 AND user_type = $2
    `;
    
    const getResult = await database.query(getQuery, [userId, userType]);
    
    if (getResult.rows.length > 0) {
      return getResult.rows[0];
    }

    // Create new wallet
    const createQuery = `
      INSERT INTO wallets (user_id, user_type, balance, currency, created_at, updated_at)
      VALUES ($1, $2, 0.00, 'EUR', NOW(), NOW())
      RETURNING *
    `;

    const createResult = await database.query(createQuery, [userId, userType]);
    return createResult.rows[0];
  }

  /**
   * Update wallet balance
   * @param {string} walletId - Wallet ID
   * @param {number} newBalance - New balance
   * @returns {Promise<Object>} Updated wallet
   */
  async updateWalletBalance(walletId, newBalance) {
    const query = `
      UPDATE wallets 
      SET balance = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await database.query(query, [newBalance, walletId]);
    return result.rows[0];
  }

  /**
   * Get commission rate
   * @param {string} commissionType - Commission type
   * @returns {number} Commission rate
   */
  getCommissionRate(commissionType) {
    const rates = {
      'template_sale': 0.10, // 10%
      'ticket_sale': 0.05    // 5%
    };

    return rates[commissionType] || 0.05; // Default 5%
  }

  /**
   * Validate payment data
   * @param {Object} paymentData - Payment data
   * @throws {Error} If validation fails
   */
  validatePaymentData(paymentData) {
    const { userId, amount, currency } = paymentData;

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!currency || currency.length !== 3) {
      throw new Error('Valid currency code is required');
    }
  }

  /**
   * Get payment statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Payment statistics
   */
  async getStatistics(filters = {}) {
    const { userId, startDate, endDate, status } = filters;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (userId) {
      whereClause += ` AND user_id = $${paramCount}`;
      values.push(userId);
      paramCount++;
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    if (status) {
      whereClause += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    const query = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        status,
        currency
      FROM transactions 
      ${whereClause}
      GROUP BY status, currency
    `;

    const result = await database.query(query, values);
    
    return {
      transactions: result.rows,
      gatewayStats: gatewayManager.getStatistics()
    };
  }
}

module.exports = new PaymentService();
