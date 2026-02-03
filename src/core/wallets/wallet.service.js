const { query } = require('../../utils/database-wrapper');

class WalletService {
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
}

module.exports = new WalletService();
