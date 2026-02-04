const { query } = require('../../utils/database-wrapper');

class CommissionService {
  async listCommissions({ payment_id, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (payment_id !== undefined) {
      clauses.push(`payment_id = $${idx++}`);
      values.push(payment_id);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM commissions ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

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

  async updateCommission(commissionId, { rate, amount, type }) {
    const result = await query(
      `UPDATE commissions
       SET rate = COALESCE($1, rate),
           amount = COALESCE($2, amount),
           type = COALESCE($3, type)
       WHERE id = $4
       RETURNING *`,
      [rate ?? null, amount ?? null, type ?? null, commissionId]
    );
    return result.rows[0] || null;
  }

  async deleteCommission(commissionId) {
    const result = await query(
      'DELETE FROM commissions WHERE id = $1 RETURNING *',
      [commissionId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new CommissionService();
