const { query } = require('../../utils/database-wrapper');

class PaymentService {
  async createPayment({
    user_id,
    gateway_id,
    purchase_id = null,
    amount,
    currency,
    payment_method,
    transaction_id = null,
    gateway_response = null,
    status = 'pending'
  }) {
    const result = await query(
      `INSERT INTO payments (
        user_id, gateway_id, purchase_id, amount, currency, status,
        payment_method, transaction_id, gateway_response
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        user_id,
        gateway_id,
        purchase_id,
        amount,
        currency,
        status,
        payment_method,
        transaction_id,
        gateway_response ? JSON.stringify(gateway_response) : null
      ]
    );
    return result.rows[0];
  }

  async getPayment(paymentId) {
    const result = await query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    return result.rows[0] || null;
  }

  async listPayments({ user_id, status, gateway_id, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (user_id !== undefined) {
      clauses.push(`user_id = $${idx++}`);
      values.push(user_id);
    }
    if (status !== undefined) {
      clauses.push(`status = $${idx++}`);
      values.push(status);
    }
    if (gateway_id !== undefined) {
      clauses.push(`gateway_id = $${idx++}`);
      values.push(gateway_id);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM payments ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

  async updatePaymentStatus(paymentId, status) {
    const result = await query(
      `UPDATE payments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, paymentId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new PaymentService();
