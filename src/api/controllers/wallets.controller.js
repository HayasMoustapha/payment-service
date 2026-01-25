const walletService = require('../../core/wallets/wallet.service');
const commissionService = require('../../core/commissions/commission.service');
const { 
  successResponse, 
  createdResponse, 
  notFoundResponse,
  errorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Contrôleur pour les wallets et commissions
 * Gère la gestion des portefeuilles utilisateurs et des commissions plateforme
 */
class WalletsController {
  /**
   * Get wallet balance
   */
  async getWalletBalance(req, res) {
    try {
      const { userType = 'designer' } = req.query;
      
      logger.wallet('Getting wallet balance', {
        userId: req.user?.id,
        userType
      });

      const result = await walletService.getWalletBalance(req.user?.id, userType);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Wallet not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Wallet balance retrieved', result)
      );

    } catch (error) {
      logger.error('Get wallet balance failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get wallet balance failed', error.message)
      );
    }
  }

  /**
   * Get wallet transactions
   */
  async getWalletTransactions(req, res) {
    try {
      const { 
        userType = 'designer',
        page = 1,
        limit = 20,
        transactionType,
        referenceType,
        startDate,
        endDate
      } = req.query;
      
      logger.wallet('Getting wallet transactions', {
        userId: req.user?.id,
        userType,
        page,
        limit
      });

      const result = await walletService.getWalletTransactions(req.user?.id, userType, {
        page: parseInt(page),
        limit: parseInt(limit),
        transactionType,
        referenceType,
        startDate,
        endDate
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Get wallet transactions failed', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Wallet transactions retrieved', result)
      );

    } catch (error) {
      logger.error('Get wallet transactions failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get wallet transactions failed', error.message)
      );
    }
  }

  /**
   * Get wallet statistics
   */
  async getWalletStatistics(req, res) {
    try {
      const { userType = 'designer', startDate, endDate } = req.query;
      
      logger.wallet('Getting wallet statistics', {
        userId: req.user?.id,
        userType,
        startDate,
        endDate
      });

      const result = await walletService.getWalletStatistics(req.user?.id, userType, {
        startDate,
        endDate
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Get wallet statistics failed', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Wallet statistics retrieved', result)
      );

    } catch (error) {
      logger.error('Get wallet statistics failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get wallet statistics failed', error.message)
      );
    }
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawal(req, res) {
    try {
      const {
        amount,
        withdrawalMethod,
        withdrawalDetails,
        userType = 'designer'
      } = req.body;
      
      logger.wallet('Creating withdrawal request', {
        userId: req.user?.id,
        amount,
        withdrawalMethod,
        userType
      });

      // Validate withdrawal details
      if (!amount || amount <= 0) {
        return res.status(400).json(
          errorResponse('Invalid amount', 'Amount must be greater than 0')
        );
      }

      if (!withdrawalMethod) {
        return res.status(400).json(
          errorResponse('Withdrawal method required', 'withdrawal_method is required')
        );
      }

      if (!withdrawalDetails) {
        return res.status(400).json(
          errorResponse('Withdrawal details required', 'withdrawal_details is required')
        );
      }

      // Check wallet balance
      const balanceResult = await walletService.getWalletBalance(req.user?.id, userType);
      if (!balanceResult.success) {
        return res.status(404).json(
          notFoundResponse('Wallet not found', balanceResult.error)
        );
      }

      if (balanceResult.balance < amount) {
        return res.status(400).json(
          errorResponse('Insufficient balance', `Available balance: ${balanceResult.balance}`)
        );
      }

      // Debit wallet for withdrawal
      const debitResult = await walletService.debitWallet(
        req.user?.id,
        userType,
        amount,
        'withdrawal',
        null,
        {
          withdrawalMethod,
          withdrawalDetails,
          status: 'pending'
        }
      );

      if (!debitResult.success) {
        return res.status(400).json(
          errorResponse('Withdrawal failed', debitResult.error)
        );
      }

      // Create withdrawal record in database
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

      const { database } = require('../../config');
      const withdrawalResult = await database.query(withdrawalQuery, [
        req.user?.id,
        userType,
        amount,
        withdrawalMethod,
        JSON.stringify(withdrawalDetails)
      ]);

      return res.status(201).json(
        createdResponse('Withdrawal request created', {
          withdrawalId: withdrawalResult.rows[0].id,
          amount,
          withdrawalMethod,
          status: 'pending',
          requestedAt: withdrawalResult.rows[0].requested_at,
          walletTransaction: debitResult
        })
      );

    } catch (error) {
      logger.error('Create withdrawal failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Create withdrawal failed', error.message)
      );
    }
  }

  /**
   * Get withdrawals
   */
  async getWithdrawals(req, res) {
    try {
      const { 
        userType = 'designer',
        page = 1,
        limit = 20,
        status
      } = req.query;
      
      logger.wallet('Getting withdrawals', {
        userId: req.user?.id,
        userType,
        page,
        limit
      });

      const { database } = require('../../config');
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          w.id, w.amount, w.status, w.withdrawal_method,
          w.withdrawal_details, w.requested_at, w.processed_at,
          w.provider_withdrawal_id, w.provider_response, w.rejection_reason
        FROM withdrawals w
        INNER JOIN wallets wa ON w.wallet_id = wa.id
        WHERE wa.user_id = $1 AND wa.user_type = $2
      `;
      
      const values = [req.user?.id, userType];
      let paramCount = 2;

      if (status) {
        paramCount++;
        query += ` AND w.status = $${paramCount}`;
        values.push(status);
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
      
      const countValues = [req.user?.id, userType];
      let countParamCount = 2;

      if (status) {
        countParamCount++;
        countQuery += ` AND w.status = $${countParamCount}`;
        countValues.push(status);
      }

      const countResult = await database.query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].total);

      return res.status(200).json(
        successResponse('Withdrawals retrieved', {
          withdrawals: result.rows.map(row => ({
            id: row.id,
            amount: parseFloat(row.amount),
            status: row.status,
            withdrawalMethod: row.withdrawal_method,
            withdrawalDetails: row.withdrawal_details,
            requestedAt: row.requested_at,
            processedAt: row.processed_at,
            providerWithdrawalId: row.provider_withdrawal_id,
            providerResponse: row.provider_response,
            rejectionReason: row.rejection_reason
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        })
      );

    } catch (error) {
      logger.error('Get withdrawals failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get withdrawals failed', error.message)
      );
    }
  }

  /**
   * Get commission statistics
   */
  async getCommissionStatistics(req, res) {
    try {
      const { startDate, endDate, commissionType, status } = req.query;
      
      logger.commission('Getting commission statistics', {
        userId: req.user?.id,
        startDate,
        endDate,
        commissionType,
        status
      });

      const result = await commissionService.getCommissionStatistics({
        startDate,
        endDate,
        commissionType,
        status
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Get commission statistics failed', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Commission statistics retrieved', result)
      );

    } catch (error) {
      logger.error('Get commission statistics failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get commission statistics failed', error.message)
      );
    }
  }

  /**
   * Get user commissions
   */
  async getUserCommissions(req, res) {
    try {
      const { 
        page = 1,
        limit = 20,
        commissionType,
        status,
        startDate,
        endDate
      } = req.query;
      
      logger.commission('Getting user commissions', {
        userId: req.user?.id,
        page,
        limit
      });

      const result = await commissionService.getCommissionsByUser(req.user?.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        commissionType,
        status,
        startDate,
        endDate
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Get user commissions failed', result.error)
        );
      }

      return res.status(200).json(
        successResponse('User commissions retrieved', result)
      );

    } catch (error) {
      logger.error('Get user commissions failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get user commissions failed', error.message)
      );
    }
  }

  /**
   * Get commission rates
   */
  async getCommissionRates(req, res) {
    try {
      logger.commission('Getting commission rates');
      
      const rates = commissionService.getCommissionRates();

      return res.status(200).json(
        successResponse('Commission rates retrieved', {
          rates: Object.keys(rates).map(type => ({
            type,
            rate: rates[type],
            percentage: rates[type] * 100
          }))
        })
      );

    } catch (error) {
      logger.error('Get commission rates failed', {
        error: error.message
      });
      
      return res.status(500).json(
        errorResponse('Get commission rates failed', error.message)
      );
    }
  }

  /**
   * Calculate projected commissions
   */
  async calculateProjectedCommissions(req, res) {
    try {
      const {
        templateSales,
        ticketSales,
        serviceFees,
        withdrawals
      } = req.body;
      
      logger.commission('Calculating projected commissions', {
        templateSales,
        ticketSales,
        serviceFees,
        withdrawals
      });

      const projections = commissionService.calculateProjectedCommissions({
        templateSales: parseFloat(templateSales) || 0,
        ticketSales: parseFloat(ticketSales) || 0,
        serviceFees: parseFloat(serviceFees) || 0,
        withdrawals: parseFloat(withdrawals) || 0
      });

      return res.status(200).json(
        successResponse('Projected commissions calculated', projections)
      );

    } catch (error) {
      logger.error('Calculate projected commissions failed', {
        error: error.message
      });
      
      return res.status(500).json(
        errorResponse('Calculate projected commissions failed', error.message)
      );
    }
  }

  /**
   * Transfer between wallets (admin only)
   */
  async transferBetweenWallets(req, res) {
    try {
      const {
        fromUserId,
        fromUserType,
        toUserId,
        toUserType,
        amount,
        metadata = {}
      } = req.body;
      
      logger.wallet('Transferring between wallets', {
        fromUserId,
        fromUserType,
        toUserId,
        toUserType,
        amount,
        requestedBy: req.user?.id
      });

      // Validate admin permissions
      if (!req.user?.permissions?.includes('admin.wallet.transfer')) {
        return res.status(403).json(
          errorResponse('Insufficient permissions', 'Admin access required')
        );
      }

      const result = await walletService.transferBetweenWallets(
        fromUserId,
        fromUserType,
        toUserId,
        toUserType,
        parseFloat(amount),
        metadata
      );

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Transfer failed', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Transfer completed', result)
      );

    } catch (error) {
      logger.error('Transfer between wallets failed', {
        error: error.message,
        requestedBy: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Transfer between wallets failed', error.message)
      );
    }
  }
}

module.exports = new WalletsController();
