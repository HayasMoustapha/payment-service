const { query } = require("../../utils/database-wrapper");

/**
 * Wallet Service - Manages user wallets and transactions
 * Handles wallet creation, balance management, and transaction history
 */
class WalletService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the wallet service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      this.initialized = true;
    }
  }

  /**
   * Get or create wallet for user
   * @param {string} userId - User ID
   * @param {string} userType - User type (designer, organizer)
   * @returns {Promise<Object>} Wallet
   */
  async getOrCreateWallet(userId, userType) {
    await this.initialize();

    try {
      // Try to get existing wallet
      const getQuery = `
        SELECT * FROM wallets 
        WHERE user_id = $1 AND user_type = $2 AND is_active = true
      `;
      
      const getResult = await query(getQuery, [userId, userType]);
      
      if (getResult.rows.length > 0) {
        return {
          success: true,
          wallet: getResult.rows[0]
        };
      }

      // Create new wallet
      const createQuery = `
        INSERT INTO wallets (user_id, user_type, balance, currency, is_active, created_at, updated_at)
        VALUES ($1, $2, 0.00, 'EUR', true, NOW(), NOW())
        RETURNING *
      `;

      const createResult = await query(createQuery, [userId, userType]);
      
      return {
        success: true,
        wallet: createResult.rows[0]
      };

    } catch (error) {
      console.error('Get or create wallet failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get wallet balance
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @returns {Promise<Object>} Wallet balance
   */
  async getWalletBalance(userId, userType) {
    await this.initialize();

    try {
      const query = `
        SELECT id, balance, currency, is_active, updated_at
        FROM wallets 
        WHERE user_id = $1 AND user_type = $2 AND is_active = true
      `;
      
      const result = await query(query, [userId, userType]);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Wallet not found'
        };
      }

      return {
        success: true,
        balance: parseFloat(result.rows[0].balance),
        currency: result.rows[0].currency,
        walletId: result.rows[0].id,
        lastUpdated: result.rows[0].updated_at
      };

    } catch (error) {
      console.error('Get wallet balance failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Credit wallet (add money)
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @param {number} amount - Amount to credit
   * @param {string} referenceType - Reference type
   * @param {string} referenceId - Reference ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Transaction result
   */
  async creditWallet(userId, userType, amount, referenceType, referenceId, metadata = {}) {
    await this.initialize();

    try {
      // Validate amount
      if (amount <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than 0'
        };
      }

      // Get wallet
      const walletResult = await this.getOrCreateWallet(userId, userType);
      if (!walletResult.success) {
        return walletResult;
      }

      const wallet = walletResult.wallet;
      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      // Start transaction
      await query('BEGIN');

      try {
        // Update wallet balance
        const updateQuery = `
          UPDATE wallets 
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await query(updateQuery, [balanceAfter, wallet.id]);

        // Create wallet transaction
        const transactionQuery = `
          INSERT INTO wallet_transactions (
            wallet_id, transaction_type, amount, balance_before, 
            balance_after, reference_type, reference_id, 
            description, metadata, created_at
          )
          VALUES ($1, 'credit', $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *
        `;

        const description = this.generateTransactionDescription('credit', referenceType, metadata);
        const transactionResult = await query(transactionQuery, [
          wallet.id,
          amount,
          balanceBefore,
          balanceAfter,
          referenceType,
          referenceId,
          description,
          JSON.stringify(metadata)
        ]);

        await query('COMMIT');

        return {
          success: true,
          transactionId: transactionResult.rows[0].id,
          walletId: wallet.id,
          amount,
          balanceBefore,
          balanceAfter,
          transactionType: 'credit',
          referenceType,
          referenceId,
          description,
          createdAt: transactionResult.rows[0].created_at
        };

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Credit wallet failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Debit wallet (remove money)
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @param {number} amount - Amount to debit
   * @param {string} referenceType - Reference type
   * @param {string} referenceId - Reference ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Transaction result
   */
  async debitWallet(userId, userType, amount, referenceType, referenceId, metadata = {}) {
    await this.initialize();

    try {
      // Validate amount
      if (amount <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than 0'
        };
      }

      // Get wallet
      const walletResult = await this.getOrCreateWallet(userId, userType);
      if (!walletResult.success) {
        return walletResult;
      }

      const wallet = walletResult.wallet;
      const balanceBefore = parseFloat(wallet.balance);

      // Check sufficient balance
      if (balanceBefore < amount) {
        return {
          success: false,
          error: 'Insufficient balance',
          balance: balanceBefore,
          requested: amount
        };
      }

      const balanceAfter = balanceBefore - amount;

      // Start transaction
      await query('BEGIN');

      try {
        // Update wallet balance
        const updateQuery = `
          UPDATE wallets 
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await query(updateQuery, [balanceAfter, wallet.id]);

        // Create wallet transaction
        const transactionQuery = `
          INSERT INTO wallet_transactions (
            wallet_id, transaction_type, amount, balance_before, 
            balance_after, reference_type, reference_id, 
            description, metadata, created_at
          )
          VALUES ($1, 'debit', $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *
        `;

        const description = this.generateTransactionDescription('debit', referenceType, metadata);
        const transactionResult = await query(transactionQuery, [
          wallet.id,
          amount,
          balanceBefore,
          balanceAfter,
          referenceType,
          referenceId,
          description,
          JSON.stringify(metadata)
        ]);

        await query('COMMIT');

        return {
          success: true,
          transactionId: transactionResult.rows[0].id,
          walletId: wallet.id,
          amount,
          balanceBefore,
          balanceAfter,
          transactionType: 'debit',
          referenceType,
          referenceId,
          description,
          createdAt: transactionResult.rows[0].created_at
        };

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Debit wallet failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get wallet transaction history
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transaction history
   */
  async getWalletTransactions(userId, userType, options = {}) {
    await this.initialize();

    try {
      const { 
        page = 1, 
        limit = 20, 
        transactionType, 
        referenceType,
        startDate,
        endDate 
      } = options;

      // Get wallet first
      const walletResult = await this.getOrCreateWallet(userId, userType);
      if (!walletResult.success) {
        return walletResult;
      }

      const wallet = walletResult.wallet;
      const offset = (page - 1) * limit;

      // Build query
      let query = `
        SELECT 
          id, transaction_type, amount, balance_before, balance_after,
          reference_type, reference_id, description, metadata, created_at
        FROM wallet_transactions 
        WHERE wallet_id = $1
      `;
      
      const values = [wallet.id];
      let paramCount = 1;

      // Add filters
      if (transactionType) {
        paramCount++;
        query += ` AND transaction_type = $${paramCount}`;
        values.push(transactionType);
      }

      if (referenceType) {
        paramCount++;
        query += ` AND reference_type = $${paramCount}`;
        values.push(referenceType);
      }

      if (startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        values.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        values.push(endDate);
      }

      // Add ordering and pagination
      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      values.push(limit, offset);

      const result = await query(query, values);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM wallet_transactions 
        WHERE wallet_id = $1
      `;
      
      const countValues = [wallet.id];
      let countParamCount = 1;

      if (transactionType) {
        countParamCount++;
        countQuery += ` AND transaction_type = $${countParamCount}`;
        countValues.push(transactionType);
      }

      if (referenceType) {
        countParamCount++;
        countQuery += ` AND reference_type = $${countParamCount}`;
        countValues.push(referenceType);
      }

      if (startDate) {
        countParamCount++;
        countQuery += ` AND created_at >= $${countParamCount}`;
        countValues.push(startDate);
      }

      if (endDate) {
        countParamCount++;
        countQuery += ` AND created_at <= $${countParamCount}`;
        countValues.push(endDate);
      }

      const countResult = await query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].total);

      return {
        success: true,
        transactions: result.rows.map(transaction => ({
          id: transaction.id,
          transactionType: transaction.transaction_type,
          amount: parseFloat(transaction.amount),
          balanceBefore: parseFloat(transaction.balance_before),
          balanceAfter: parseFloat(transaction.balance_after),
          referenceType: transaction.reference_type,
          referenceId: transaction.reference_id,
          description: transaction.description,
          metadata: transaction.metadata,
          createdAt: transaction.created_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        },
        wallet: {
          id: wallet.id,
          balance: parseFloat(wallet.balance),
          currency: wallet.currency
        }
      };

    } catch (error) {
      console.error('Get wallet transactions failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get wallet statistics
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Wallet statistics
   */
  async getWalletStatistics(userId, userType, filters = {}) {
    await this.initialize();

    try {
      // Get wallet
      const walletResult = await this.getOrCreateWallet(userId, userType);
      if (!walletResult.success) {
        return walletResult;
      }

      const wallet = walletResult.wallet;
      const { startDate, endDate } = filters;

      // Build statistics query
      let query = `
        SELECT 
          transaction_type,
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as total_credits,
          SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as total_debits
        FROM wallet_transactions 
        WHERE wallet_id = $1
      `;
      
      const values = [wallet.id];
      let paramCount = 1;

      if (startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        values.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        values.push(endDate);
      }

      query += ` GROUP BY transaction_type`;

      const result = await query(query, values);

      // Calculate statistics
      let totalCredits = 0;
      let totalDebits = 0;
      let creditCount = 0;
      let debitCount = 0;

      result.rows.forEach(row => {
        if (row.transaction_type === 'credit') {
          totalCredits = parseFloat(row.total_amount);
          creditCount = parseInt(row.transaction_count);
        } else if (row.transaction_type === 'debit') {
          totalDebits = parseFloat(row.total_amount);
          debitCount = parseInt(row.transaction_count);
        }
      });

      return {
        success: true,
        wallet: {
          id: wallet.id,
          balance: parseFloat(wallet.balance),
          currency: wallet.currency
        },
        statistics: {
          totalTransactions: creditCount + debitCount,
          creditTransactions: creditCount,
          debitTransactions: debitCount,
          totalCredits,
          totalDebits,
          netAmount: totalCredits - totalDebits,
          period: {
            startDate,
            endDate
          }
        }
      };

    } catch (error) {
      console.error('Get wallet statistics failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate transaction description
   * @param {string} transactionType - Transaction type
   * @param {string} referenceType - Reference type
   * @param {Object} metadata - Metadata
   * @returns {string} Description
   */
  generateTransactionDescription(transactionType, referenceType, metadata) {
    const descriptions = {
      credit: {
        sale: `Credit from ${referenceType} sale`,
        refund: `Refund for ${referenceType}`,
        bonus: `Bonus credit`,
        adjustment: `Balance adjustment (credit)`
      },
      debit: {
        withdrawal: `Withdrawal to ${metadata.method || 'bank account'}`,
        fee: `Fee deduction`,
        adjustment: `Balance adjustment (debit)`,
        transfer: `Transfer to ${metadata.recipient || 'external account'}`
      }
    };

    return descriptions[transactionType]?.[referenceType] || 
           `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} - ${referenceType}`;
  }

  /**
   * Transfer between wallets
   * @param {string} fromUserId - Source user ID
   * @param {string} fromUserType - Source user type
   * @param {string} toUserId - Destination user ID
   * @param {string} toUserType - Destination user type
   * @param {number} amount - Amount to transfer
   * @param {Object} metadata - Transfer metadata
   * @returns {Promise<Object>} Transfer result
   */
  async transferBetweenWallets(fromUserId, fromUserType, toUserId, toUserType, amount, metadata = {}) {
    await this.initialize();

    try {
      // Validate amount
      if (amount <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than 0'
        };
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Debit source wallet
        const debitResult = await this.debitWallet(
          fromUserId, 
          fromUserType, 
          amount, 
          'transfer', 
          null, 
          {
            ...metadata,
            toUserId,
            toUserType,
            transferType: 'sent'
          }
        );

        if (!debitResult.success) {
          await query('ROLLBACK');
          return debitResult;
        }

        // Credit destination wallet
        const creditResult = await this.creditWallet(
          toUserId, 
          toUserType, 
          amount, 
          'transfer', 
          debitResult.transactionId, 
          {
            ...metadata,
            fromUserId,
            fromUserType,
            transferType: 'received'
          }
        );

        if (!creditResult.success) {
          await query('ROLLBACK');
          return creditResult;
        }

        await query('COMMIT');

        return {
          success: true,
          transferId: debitResult.transactionId,
          amount,
          from: {
            userId: fromUserId,
            userType: fromUserType,
            transactionId: debitResult.transactionId
          },
          to: {
            userId: toUserId,
            userType: toUserType,
            transactionId: creditResult.transactionId
          },
          createdAt: debitResult.createdAt
        };

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Transfer between wallets failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new WalletService();
