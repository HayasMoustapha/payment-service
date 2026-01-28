const { query } = require("../../utils/database-wrapper");

/**
 * Commission Service - Manages platform commissions
 * Handles commission calculation, processing, and tracking
 */
class CommissionService {
  constructor() {
    this.initialized = false;
    this.commissionRates = {
      'template_sale': 0.10,    // 10% for template sales
      'ticket_sale': 0.05,      // 5% for ticket sales
      'service_fee': 0.02,      // 2% for service fees
      'withdrawal_fee': 0.01    // 1% for withdrawals
    };
  }

  /**
   * Initialize the commission service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      // Load commission rates from database if available
      await this.loadCommissionRates();
      this.initialized = true;
    }
  }

  /**
   * Load commission rates from database
   * @returns {Promise<void>}
   */
  async loadCommissionRates() {
    try {
      const query = `
        SELECT commission_type, rate, is_active
        FROM commission_rates 
        WHERE is_active = true
      `;
      
      const result = await query(query);
      
      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          this.commissionRates[row.commission_type] = parseFloat(row.rate);
        });
      }
    } catch (error) {
      console.warn('Failed to load commission rates from database, using defaults:', error.message);
    }
  }

  /**
   * Calculate commission amount
   * @param {number} amount - Original amount
   * @param {string} commissionType - Commission type
   * @param {Object} options - Additional options
   * @returns {Object} Commission calculation result
   */
  calculateCommission(amount, commissionType, options = {}) {
    const rate = this.getCommissionRate(commissionType, options);
    const commissionAmount = amount * rate;
    const netAmount = amount - commissionAmount;

    return {
      originalAmount: amount,
      commissionRate: rate,
      commissionAmount,
      netAmount,
      commissionType,
      percentage: rate * 100
    };
  }

  /**
   * Get commission rate for type
   * @param {string} commissionType - Commission type
   * @param {Object} options - Additional options
   * @returns {number} Commission rate
   */
  getCommissionRate(commissionType, options = {}) {
    // Check for custom rate in options
    if (options.customRate) {
      return options.customRate;
    }

    // Check for user-specific rates
    if (options.userType === 'premium_designer' && commissionType === 'template_sale') {
      return 0.05; // Reduced rate for premium designers
    }

    if (options.userType === 'enterprise_organizer' && commissionType === 'ticket_sale') {
      return 0.03; // Reduced rate for enterprise organizers
    }

    // Return default rate
    return this.commissionRates[commissionType] || 0.05;
  }

  /**
   * Create commission for transaction
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Transaction amount
   * @param {string} commissionType - Commission type
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Commission result
   */
  async createCommission(transactionId, amount, commissionType, options = {}) {
    await this.initialize();

    try {
      // Calculate commission
      const calculation = this.calculateCommission(amount, commissionType, options);

      // Create commission record
      const query = `
        INSERT INTO commissions (
          transaction_id, commission_rate, commission_amount, 
          commission_type, status, processed_at, created_at
        )
        VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
        RETURNING *
      `;

      const values = [
        transactionId,
        calculation.commissionRate,
        calculation.commissionAmount,
        commissionType
      ];

      const result = await query(query, values);
      const commission = result.rows[0];

      return {
        success: true,
        commission: {
          id: commission.id,
          transactionId: commission.transaction_id,
          commissionRate: parseFloat(commission.commission_rate),
          commissionAmount: parseFloat(commission.commission_amount),
          commissionType: commission.commission_type,
          status: commission.status,
          processedAt: commission.processed_at,
          createdAt: commission.created_at
        },
        calculation
      };

    } catch (error) {
      console.error('Create commission failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get commission by transaction ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Commission
   */
  async getCommissionByTransaction(transactionId) {
    await this.initialize();

    try {
      const query = `
        SELECT * FROM commissions 
        WHERE transaction_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await query(query, [transactionId]);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Commission not found'
        };
      }

      const commission = result.rows[0];

      return {
        success: true,
        commission: {
          id: commission.id,
          transactionId: commission.transaction_id,
          commissionRate: parseFloat(commission.commission_rate),
          commissionAmount: parseFloat(commission.commission_amount),
          commissionType: commission.commission_type,
          status: commission.status,
          processedAt: commission.processed_at,
          createdAt: commission.created_at
        }
      };

    } catch (error) {
      console.error('Get commission by transaction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get commissions statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Statistics
   */
  async getCommissionStatistics(filters = {}) {
    await this.initialize();

    try {
      const { startDate, endDate, commissionType, status } = filters;

      // Build query
      let query = `
        SELECT 
          commission_type,
          status,
          COUNT(*) as commission_count,
          SUM(commission_amount) as total_commission,
          AVG(commission_amount) as average_commission,
          SUM(
            CASE 
              WHEN status = 'completed' THEN commission_amount 
              ELSE 0 
            END
          ) as collected_commission,
          SUM(
            CASE 
              WHEN status = 'pending' THEN commission_amount 
              ELSE 0 
            END
          ) as pending_commission
        FROM commissions 
        WHERE 1=1
      `;
      
      const values = [];
      let paramCount = 0;

      // Add filters
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

      if (commissionType) {
        paramCount++;
        query += ` AND commission_type = $${paramCount}`;
        values.push(commissionType);
      }

      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        values.push(status);
      }

      query += ` GROUP BY commission_type, status ORDER BY commission_type, status`;

      const result = await query(query, values);

      // Calculate totals
      let totalCommissions = 0;
      let totalAmount = 0;
      let totalCollected = 0;
      let totalPending = 0;

      result.rows.forEach(row => {
        totalCommissions += parseInt(row.commission_count);
        totalAmount += parseFloat(row.total_commission);
        totalCollected += parseFloat(row.collected_commission);
        totalPending += parseFloat(row.pending_commission);
      });

      return {
        success: true,
        statistics: {
          totalCommissions,
          totalAmount,
          totalCollected,
          totalPending,
          collectionRate: totalAmount > 0 ? (totalCollected / totalAmount) * 100 : 0,
          details: result.rows.map(row => ({
            commissionType: row.commission_type,
            status: row.status,
            count: parseInt(row.commission_count),
            totalAmount: parseFloat(row.total_commission),
            averageAmount: parseFloat(row.average_commission),
            collectedAmount: parseFloat(row.collected_commission),
            pendingAmount: parseFloat(row.pending_commission)
          }))
        },
        period: {
          startDate,
          endDate
        }
      };

    } catch (error) {
      console.error('Get commission statistics failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get commissions by user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} User commissions
   */
  async getCommissionsByUser(userId, filters = {}) {
    await this.initialize();

    try {
      const { page = 1, limit = 20, commissionType, status, startDate, endDate } = filters;
      const offset = (page - 1) * limit;

      // Build query with transaction join
      let query = `
        SELECT 
          c.id, c.transaction_id, c.commission_rate, c.commission_amount,
          c.commission_type, c.status, c.processed_at, c.created_at,
          t.user_id, t.amount as transaction_amount, t.currency
        FROM commissions c
        INNER JOIN transactions t ON c.transaction_id = t.id
        WHERE t.user_id = $1
      `;
      
      const values = [userId];
      let paramCount = 1;

      // Add filters
      if (commissionType) {
        paramCount++;
        query += ` AND c.commission_type = $${paramCount}`;
        values.push(commissionType);
      }

      if (status) {
        paramCount++;
        query += ` AND c.status = $${paramCount}`;
        values.push(status);
      }

      if (startDate) {
        paramCount++;
        query += ` AND c.created_at >= $${paramCount}`;
        values.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND c.created_at <= $${paramCount}`;
        values.push(endDate);
      }

      // Add ordering and pagination
      query += ` ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      values.push(limit, offset);

      const result = await query(query, values);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM commissions c
        INNER JOIN transactions t ON c.transaction_id = t.id
        WHERE t.user_id = $1
      `;
      
      const countValues = [userId];
      let countParamCount = 1;

      if (commissionType) {
        countParamCount++;
        countQuery += ` AND c.commission_type = $${countParamCount}`;
        countValues.push(commissionType);
      }

      if (status) {
        countParamCount++;
        countQuery += ` AND c.status = $${countParamCount}`;
        countValues.push(status);
      }

      if (startDate) {
        countParamCount++;
        countQuery += ` AND c.created_at >= $${countParamCount}`;
        countValues.push(startDate);
      }

      if (endDate) {
        countParamCount++;
        countQuery += ` AND c.created_at <= $${countParamCount}`;
        countValues.push(endDate);
      }

      const countResult = await query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].total);

      return {
        success: true,
        commissions: result.rows.map(row => ({
          id: row.id,
          transactionId: row.transaction_id,
          commissionRate: parseFloat(row.commission_rate),
          commissionAmount: parseFloat(row.commission_amount),
          commissionType: row.commission_type,
          status: row.status,
          transactionAmount: parseFloat(row.transaction_amount),
          currency: row.currency,
          processedAt: row.processed_at,
          createdAt: row.created_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('Get commissions by user failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update commission status
   * @param {string} commissionId - Commission ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Update result
   */
  async updateCommissionStatus(commissionId, status, metadata = {}) {
    await this.initialize();

    try {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          error: 'Invalid status'
        };
      }

      const query = `
        UPDATE commissions 
        SET status = $1, processed_at = CASE 
          WHEN $1 IN ('completed', 'failed') THEN NOW() 
          ELSE processed_at 
        END, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await query(query, [status, commissionId]);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Commission not found'
        };
      }

      return {
        success: true,
        commission: {
          id: result.rows[0].id,
          transactionId: result.rows[0].transaction_id,
          status: result.rows[0].status,
          processedAt: result.rows[0].processed_at,
          updatedAt: result.rows[0].updated_at
        }
      };

    } catch (error) {
      console.error('Update commission status failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get commission rates configuration
   * @returns {Object} Commission rates
   */
  getCommissionRates() {
    return { ...this.commissionRates };
  }

  /**
   * Update commission rate
   * @param {string} commissionType - Commission type
   * @param {number} rate - New rate
   * @returns {Promise<Object>} Update result
   */
  async updateCommissionRate(commissionType, rate) {
    await this.initialize();

    try {
      if (rate < 0 || rate > 1) {
        return {
          success: false,
          error: 'Rate must be between 0 and 1'
        };
      }

      // Update in memory
      this.commissionRates[commissionType] = rate;

      // Update in database if table exists
      try {
        const query = `
          INSERT INTO commission_rates (commission_type, rate, is_active, created_at, updated_at)
          VALUES ($1, $2, true, NOW(), NOW())
          ON CONFLICT (commission_type) 
          DO UPDATE SET 
            rate = $2, 
            is_active = true, 
            updated_at = NOW()
          RETURNING *
        `;

        await query(query, [commissionType, rate]);
      } catch (dbError) {
        console.warn('Failed to update commission rate in database:', dbError.message);
      }

      return {
        success: true,
        commissionType,
        rate,
        percentage: rate * 100
      };

    } catch (error) {
      console.error('Update commission rate failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate projected commissions
   * @param {Object} projections - Projection data
   * @returns {Object} Projection results
   */
  calculateProjectedCommissions(projections) {
    const { templateSales, ticketSales, serviceFees, withdrawals } = projections;

    const templateCommission = this.calculateCommission(templateSales || 0, 'template_sale');
    const ticketCommission = this.calculateCommission(ticketSales || 0, 'ticket_sale');
    const serviceCommission = this.calculateCommission(serviceFees || 0, 'service_fee');
    const withdrawalCommission = this.calculateCommission(withdrawals || 0, 'withdrawal_fee');

    return {
      templateSales: {
        amount: templateSales || 0,
        commission: templateCommission
      },
      ticketSales: {
        amount: ticketSales || 0,
        commission: ticketCommission
      },
      serviceFees: {
        amount: serviceFees || 0,
        commission: serviceCommission
      },
      withdrawals: {
        amount: withdrawals || 0,
        commission: withdrawalCommission
      },
      total: {
        grossRevenue: (templateSales || 0) + (ticketSales || 0) + (serviceFees || 0),
        totalCommission: templateCommission.commissionAmount + ticketCommission.commissionAmount + serviceCommission.commissionAmount + withdrawalCommission.commissionAmount,
        netRevenue: (templateSales || 0) + (ticketSales || 0) + (serviceFees || 0) - (templateCommission.commissionAmount + ticketCommission.commissionAmount + serviceCommission.commissionAmount)
      }
    };
  }
}

module.exports = new CommissionService();
