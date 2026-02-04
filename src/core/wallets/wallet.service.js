const { query } = require('../../utils/database-wrapper');

class WalletService {
  async listWallets({ designer_id, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (designer_id !== undefined) {
      clauses.push(`designer_id = $${idx++}`);
      values.push(designer_id);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM wallets ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

  async createWallet({ designer_id, balance = 0, currency }) {
    const result = await query(
      `INSERT INTO wallets (designer_id, balance, currency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [designer_id, balance, currency]
    );
    return result.rows[0];
  }

  async getWallet(walletId) {
    const result = await query('SELECT * FROM wallets WHERE id = $1', [walletId]);
    return result.rows[0] || null;
  }

  async getWalletByDesigner(designerId) {
    const result = await query('SELECT * FROM wallets WHERE designer_id = $1', [designerId]);
    return result.rows[0] || null;
  }

  async updateBalance(walletId, balance) {
    const result = await query(
      'UPDATE wallets SET balance = $1 WHERE id = $2 RETURNING *',
      [balance, walletId]
    );
    return result.rows[0] || null;
  }

  async updateWallet(walletId, { balance, currency }) {
    const result = await query(
      `UPDATE wallets
       SET balance = COALESCE($1, balance),
           currency = COALESCE($2, currency)
       WHERE id = $3
       RETURNING *`,
      [balance ?? null, currency ?? null, walletId]
    );
    return result.rows[0] || null;
  }

  async deleteWallet(walletId) {
    const result = await query('DELETE FROM wallets WHERE id = $1 RETURNING *', [walletId]);
    return result.rows[0] || null;
  }
}

module.exports = new WalletService();
