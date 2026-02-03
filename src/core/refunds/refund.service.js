const { query } = require('../../utils/database-wrapper');

class RefundService {
  async createRefund({ payment_id, amount, reason = null, status = 'pending', processed_at = null }) {
    const result = await query(
      `INSERT INTO refunds (payment_id, amount, reason, status, processed_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [payment_id, amount, reason, status, processed_at]
    );
    return result.rows[0];
  }

  async getRefund(refundId) {
    const result = await query('SELECT * FROM refunds WHERE id = $1', [refundId]);
    return result.rows[0] || null;
  }

  async listRefunds({ payment_id, status, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (payment_id !== undefined) {
      clauses.push(`payment_id = $${idx++}`);
      values.push(payment_id);
    }
    if (status !== undefined) {
      clauses.push(`status = $${idx++}`);
      values.push(status);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM refunds ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }
}

module.exports = new RefundService();
