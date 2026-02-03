const { query } = require('../../utils/database-wrapper');

class CommissionService {
  async createCommission({ payment_id, rate, amount, type }) {
    const result = await query(
      `INSERT INTO commissions (payment_id, rate, amount, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payment_id, rate, amount, type]
    );
    return result.rows[0];
  }

  async getCommission(commissionId) {
    const result = await query('SELECT * FROM commissions WHERE id = $1', [commissionId]);
    return result.rows[0] || null;
  }

  async getCommissionByPayment(paymentId) {
    const result = await query('SELECT * FROM commissions WHERE payment_id = $1', [paymentId]);
    return result.rows[0] || null;
  }
}

module.exports = new CommissionService();
