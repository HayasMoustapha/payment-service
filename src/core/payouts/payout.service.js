const gatewayManager = require('../providers/gateway.manager');
const walletService = require('../wallets/wallet.service');
const commissionService = require('../commissions/commission.service');
const { database } = require('../../config');

/**
 * Payout Service - Manages outgoing payments to users
 * Handles withdrawal processing, provider integration, and compliance
 */
class PayoutService {
  constructor() {
    this.initialized = false;
    this.payoutLimits = {
      minimum: 10.00,      // Minimum payout amount
      maximum: 50000.00,   // Maximum payout amount
      daily: 5000.00,      // Daily limit
      monthly: 50000.00    // Monthly limit
    };
    this.processingFees = {
      bank_transfer: 0.02,  // 2% fee
      mobile_money: 0.01,   // 1% fee
      paypal: 0.03         // 3% fee
    };
  }

  /**
   * Initialize the payout service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      await gatewayManager.initialize();
      this.initialized = true;
    }
  }

  /**
   * Create payout request
   * @param {string} userId - User ID
   * @param {string} userType - User type (designer, organizer)
   * @param {number} amount - Payout amount
   * @param {Object} payoutDetails - Payout details
   * @returns {Promise<Object>} Payout result
   */
  async createPayoutRequest(userId, userType, amount, payoutDetails) {
    await this.initialize();

    try {
      // Validate amount
      if (!this.validatePayoutAmount(amount)) {
        return {
          success: false,
          error: 'Invalid payout amount',
          limits: this.payoutLimits
        };
      }

      // Check user limits
      const limitCheck = await this.checkUserLimits(userId, amount);
      if (!limitCheck.allowed) {
        return {
          success: false,
          error: limitCheck.reason,
          currentUsage: limitCheck.currentUsage,
          limits: limitCheck.limits
        };
      }

      // Get wallet and check balance
      const walletResult = await walletService.getWalletBalance(userId, userType);
      if (!walletResult.success) {
        return {
          success: false,
          error: 'Wallet not found'
        };
      }

      // Calculate processing fee
      const processingFee = this.calculateProcessingFee(amount, payoutDetails.method);
      const totalAmount = amount + processingFee;

      if (walletResult.balance < totalAmount) {
        return {
          success: false,
          error: 'Insufficient balance',
          required: totalAmount,
          available: walletResult.balance,
          processingFee
        };
      }

      // Start transaction
      await database.query('BEGIN');

      try {
        // Debit wallet for total amount (payout + fee)
        const debitResult = await walletService.debitWallet(
          userId,
          userType,
          totalAmount,
          'withdrawal',
          null,
          {
            type: 'payout_request',
            method: payoutDetails.method,
            processingFee,
            payoutAmount: amount
          }
        );

        if (!debitResult.success) {
          await database.query('ROLLBACK');
          return debitResult;
        }

        // Create withdrawal record
        const withdrawalQuery = `
          INSERT INTO withdrawals (
            wallet_id, amount, status, withdrawal_method,
            withdrawal_details, requested_at, created_at
          )
          VALUES (
            (SELECT id FROM wallets WHERE user_id = $1 AND user_type = $2),
            $3, 'pending', $4, $5, NOW(), NOW()
          )
          RETURNING *
        `;

        const withdrawalResult = await database.query(withdrawalQuery, [
          userId,
          userType,
          amount,
          payoutDetails.method,
          JSON.stringify({
            ...payoutDetails,
            processingFee,
            totalAmount,
            walletTransactionId: debitResult.transactionId
          })
        ]);

        await database.query('COMMIT');

        // Process payout asynchronously
        this.processPayout(withdrawalResult.rows[0].id).catch(error => {
          console.error('Async payout processing failed:', error);
        });

        return {
          success: true,
          payoutId: withdrawalResult.rows[0].id,
          amount,
          processingFee,
          totalAmount,
          status: 'pending',
          requestedAt: withdrawalResult.rows[0].requested_at,
          estimatedProcessingTime: this.getEstimatedProcessingTime(payoutDetails.method)
        };

      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Create payout request failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process payout
   * @param {string} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} Processing result
   */
  async processPayout(withdrawalId) {
    await this.initialize();

    try {
      // Get withdrawal details
      const withdrawalQuery = `
        SELECT 
          w.*,
          wa.user_id, wa.user_type
        FROM withdrawals w
        INNER JOIN wallets wa ON w.wallet_id = wa.id
        WHERE w.id = $1
      `;
      
      const withdrawalResult = await database.query(withdrawalQuery, [withdrawalId]);
      
      if (withdrawalResult.rows.length === 0) {
        return {
          success: false,
          error: 'Withdrawal not found',
          details: {
            field: 'withdrawalId',
            message: 'Withdrawal not found',
            withdrawalId
          }
        };
      }

      const withdrawal = withdrawalResult.rows[0];

      // Update status to processing
      await this.updateWithdrawalStatus(withdrawalId, 'processing');

      // Parse withdrawal details
      const details = JSON.parse(withdrawal.withdrawal_details);
      const payoutMethod = withdrawal.withdrawal_method;

      // Select appropriate gateway
      const gateway = this.selectPayoutGateway(payoutMethod, details);
      if (!gateway) {
        await this.updateWithdrawalStatus(withdrawalId, 'failed', 'No suitable gateway available');
        return {
          success: false,
          error: 'No suitable gateway available',
          details: {
            field: 'gateway',
            message: 'No suitable gateway available for this payout method',
            payoutMethod
          }
        };
      }

      // Prepare payout data
      const payoutData = {
        amount: withdrawal.amount,
        currency: withdrawal.currency || 'EUR',
        recipient: details.recipient || {
          name: details.recipientName,
          email: details.recipientEmail,
          phone: details.recipientPhone,
          account: details.bankAccount || details.mobileAccount
        },
        description: `Payout for ${withdrawal.user_type} - Withdrawal ${withdrawal.id}`,
        metadata: {
          withdrawalId,
          userId: withdrawal.user_id,
          userType: withdrawal.user_type
        }
      };

      // Process payout with gateway
      const gatewayResult = await gatewayManager.createPayout(gateway.code, payoutData);

      if (!gatewayResult.success) {
        await this.updateWithdrawalStatus(withdrawalId, 'failed', gatewayResult.error);
        
        // Refund wallet if payout failed
        await this.refundFailedPayout(withdrawal, gatewayResult.error);
        
        return {
          success: false,
          error: 'Payout processing failed',
          details: {
            message: gatewayResult.error,
            withdrawalId,
            gateway: gatewayResult.gateway
          }
        };
      }

      // Update withdrawal with provider details
      await this.updateWithdrawalStatus(withdrawalId, 'completed', null, {
        providerWithdrawalId: gatewayResult.payoutId,
        providerResponse: gatewayResult,
        processedAt: new Date().toISOString()
      });

      return {
        success: true,
        withdrawalId,
        providerWithdrawalId: gatewayResult.payoutId,
        status: 'completed',
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Process payout failed:', error);
      
      try {
        await this.updateWithdrawalStatus(withdrawalId, 'failed', error.message);
      } catch (updateError) {
        console.error('Failed to update withdrawal status:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Get payout status
   * @param {string} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} Payout status
   */
  async getPayoutStatus(withdrawalId) {
    await this.initialize();

    try {
      const query = `
        SELECT 
          w.*,
          wa.user_id, wa.user_type,
          u.email as user_email
        FROM withdrawals w
        INNER JOIN wallets wa ON w.wallet_id = wa.id
        LEFT JOIN users u ON wa.user_id = u.id
        WHERE w.id = $1
      `;
      
      const result = await database.query(query, [withdrawalId]);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Payout not found'
        };
      }

      const withdrawal = result.rows[0];

      // Get status from provider if pending
      let providerStatus = null;
      if (withdrawal.status === 'processing' && withdrawal.provider_withdrawal_id) {
        try {
          const gateway = this.selectPayoutGateway(withdrawal.withdrawal_method, JSON.parse(withdrawal.withdrawal_details));
          if (gateway) {
            providerStatus = await gatewayManager.getPayoutStatus(gateway.code, withdrawal.provider_withdrawal_id);
          }
        } catch (error) {
          console.warn('Failed to get provider status:', error.message);
        }
      }

      return {
        success: true,
        payout: {
          id: withdrawal.id,
          amount: parseFloat(withdrawal.amount),
          status: withdrawal.status,
          withdrawalMethod: withdrawal.withdrawal_method,
          withdrawalDetails: JSON.parse(withdrawal.withdrawal_details),
          requestedAt: withdrawal.requested_at,
          processedAt: withdrawal.processed_at,
          providerWithdrawalId: withdrawal.provider_withdrawal_id,
          providerResponse: withdrawal.provider_response,
          rejectionReason: withdrawal.rejection_reason,
          estimatedProcessingTime: this.getEstimatedProcessingTime(withdrawal.withdrawal_method),
          providerStatus
        },
        user: {
          id: withdrawal.user_id,
          type: withdrawal.user_type,
          email: withdrawal.user_email
        }
      };

    } catch (error) {
      console.error('Get payout status failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user payouts
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User payouts
   */
  async getUserPayouts(userId, userType, options = {}) {
    await this.initialize();

    try {
      const { page = 1, limit = 20, status, startDate, endDate } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          w.id, w.amount, w.status, w.withdrawal_method,
          w.withdrawal_details, w.requested_at, w.processed_at,
          w.provider_withdrawal_id, w.rejection_reason
        FROM withdrawals w
        INNER JOIN wallets wa ON w.wallet_id = wa.id
        WHERE wa.user_id = $1 AND wa.user_type = $2
      `;
      
      const values = [userId, userType];
      let paramCount = 2;

      if (status) {
        paramCount++;
        query += ` AND w.status = $${paramCount}`;
        values.push(status);
      }

      if (startDate) {
        paramCount++;
        query += ` AND w.requested_at >= $${paramCount}`;
        values.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND w.requested_at <= $${paramCount}`;
        values.push(endDate);
      }

      query += ` ORDER BY w.requested_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      values.push(limit, offset);

      const result = await database.query(query, values);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM withdrawals w
        INNER JOIN wallets wa ON w.wallet_id = wa.id
        WHERE wa.user_id = $1 AND wa.user_type = $2
      `;
      
      const countValues = [userId, userType];
      let countParamCount = 2;

      if (status) {
        countParamCount++;
        countQuery += ` AND w.status = $${countParamCount}`;
        countValues.push(status);
      }

      if (startDate) {
        countParamCount++;
        countQuery += ` AND w.requested_at >= $${countParamCount}`;
        countValues.push(startDate);
      }

      if (endDate) {
        countParamCount++;
        countQuery += ` AND w.requested_at <= $${countParamCount}`;
        countValues.push(endDate);
      }

      const countResult = await database.query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].total);

      return {
        success: true,
        payouts: result.rows.map(row => ({
          id: row.id,
          amount: parseFloat(row.amount),
          status: row.status,
          withdrawalMethod: row.withdrawal_method,
          withdrawalDetails: JSON.parse(row.withdrawal_details),
          requestedAt: row.requested_at,
          processedAt: row.processed_at,
          providerWithdrawalId: row.provider_withdrawal_id,
          rejectionReason: row.rejection_reason,
          estimatedProcessingTime: this.getEstimatedProcessingTime(row.withdrawal_method)
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('Get user payouts failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate payout amount
   * @param {number} amount - Amount to validate
   * @returns {boolean} True if valid
   */
  validatePayoutAmount(amount) {
    return amount >= this.payoutLimits.minimum && amount <= this.payoutLimits.maximum;
  }

  /**
   * Check user limits
   * @param {string} userId - User ID
   * @param {number} amount - Amount to check
   * @returns {Object} Limit check result
   */
  async checkUserLimits(userId, amount) {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const query = `
        SELECT 
          COUNT(*) as daily_count,
          COALESCE(SUM(amount), 0) as daily_total,
          COUNT(*) FILTER (WHERE requested_at >= $2) as monthly_count,
          COALESCE(SUM(amount) FILTER (WHERE requested_at >= $3), 0) as monthly_total
        FROM withdrawals 
        WHERE user_id = $1 AND status IN ('pending', 'processing', 'completed')
      `;

      const result = await database.query(query, [userId, dayStart, monthStart]);
      const usage = result.rows[0];

      const dailyLimitCheck = usage.daily_total + amount <= this.payoutLimits.daily;
      const monthlyLimitCheck = usage.monthly_total + amount <= this.payoutLimits.monthly;

      return {
        allowed: dailyLimitCheck && monthlyLimitCheck,
        reason: !dailyLimitCheck ? 'Daily limit exceeded' : 
                !monthlyLimitCheck ? 'Monthly limit exceeded' : null,
        currentUsage: {
          daily: {
            count: parseInt(usage.daily_count),
            total: parseFloat(usage.daily_total),
            limit: this.payoutLimits.daily
          },
          monthly: {
            count: parseInt(usage.monthly_count),
            total: parseFloat(usage.monthly_total),
            limit: this.payoutLimits.monthly
          }
        },
        limits: this.payoutLimits
      };

    } catch (error) {
      console.error('Check user limits failed:', error);
      return {
        allowed: false,
        reason: 'Failed to check limits'
      };
    }
  }

  /**
   * Calculate processing fee
   * @param {number} amount - Payout amount
   * @param {string} method - Payout method
   * @returns {number} Processing fee
   */
  calculateProcessingFee(amount, method) {
    const feeRate = this.processingFees[method] || 0.02;
    return Math.round(amount * feeRate * 100) / 100;
  }

  /**
   * Select payout gateway
   * @param {string} method - Payout method
   * @param {Object} details - Payout details
   * @returns {Object|null} Selected gateway
   */
  selectPayoutGateway(method, details) {
    const gatewayMap = {
      'bank_transfer': 'stripe',
      'mobile_money': details.provider === 'mtn' ? 'mtn_momo' : 'cinetpay',
      'paypal': 'paypal'
    };

    const gatewayCode = gatewayMap[method];
    return gatewayManager.getGateway(gatewayCode);
  }

  /**
   * Get estimated processing time
   * @param {string} method - Payout method
   * @returns {string} Estimated time
   */
  getEstimatedProcessingTime(method) {
    const processingTimes = {
      'bank_transfer': '3-5 business days',
      'mobile_money': '1-2 business hours',
      'paypal': '1-2 business days'
    };

    return processingTimes[method] || '2-5 business days';
  }

  /**
   * Update withdrawal status
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async updateWithdrawalStatus(withdrawalId, status, reason = null, metadata = {}) {
    const query = `
      UPDATE withdrawals 
      SET status = $1, 
          processed_at = CASE 
            WHEN $1 IN ('completed', 'failed') THEN NOW() 
            ELSE processed_at 
          END,
          rejection_reason = $2,
          provider_response = COALESCE($3, provider_response),
          updated_at = NOW()
      WHERE id = $4
    `;

    await database.query(query, [status, reason, JSON.stringify(metadata), withdrawalId]);
  }

  /**
   * Refund failed payout
   * @param {Object} withdrawal - Withdrawal details
   * @param {string} reason - Failure reason
   * @returns {Promise<void>}
   */
  async refundFailedPayout(withdrawal, reason) {
    try {
      const details = JSON.parse(withdrawal.withdrawal_details);
      
      await walletService.creditWallet(
        withdrawal.user_id,
        withdrawal.user_type,
        details.totalAmount,
        'withdrawal',
        withdrawal.id,
        {
          type: 'payout_refund',
          reason,
          originalWithdrawalId: withdrawal.id,
          processingFee: details.processingFee
        }
      );

      console.log(`Refunded failed payout ${withdrawal.id} to user ${withdrawal.user_id}`);
    } catch (error) {
      console.error('Failed to refund payout:', error);
    }
  }
}

module.exports = new PayoutService();
