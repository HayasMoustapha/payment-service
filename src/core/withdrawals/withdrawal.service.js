const { query } = require('../../utils/database-wrapper');

class WithdrawalService {
  async createWithdrawal({ wallet_id, amount, status = 'pending', requested_at = null, processed_at = null }) {
    const result = await query(
      `INSERT INTO withdrawals (wallet_id, amount, status, requested_at, processed_at)
       VALUES ($1, $2, $3, COALESCE($4, NOW()), $5)
       RETURNING *`,
      [wallet_id, amount, status, requested_at, processed_at]
    );
    return result.rows[0];
  }

  async getWithdrawal(withdrawalId) {
    const result = await query('SELECT * FROM withdrawals WHERE id = $1', [withdrawalId]);
    return result.rows[0] || null;
  }

  async listWithdrawals({ wallet_id, status, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (wallet_id !== undefined) {
      clauses.push(`wallet_id = $${idx++}`);
      values.push(wallet_id);
    }
    if (status !== undefined) {
      clauses.push(`status = $${idx++}`);
      values.push(status);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM withdrawals ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

  async updateStatus(withdrawalId, status, processed_at = null) {
    const result = await query(
      `UPDATE withdrawals
       SET status = $1, processed_at = COALESCE($2, processed_at)
       WHERE id = $3
       RETURNING *`,
      [status, processed_at, withdrawalId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new WithdrawalService();
