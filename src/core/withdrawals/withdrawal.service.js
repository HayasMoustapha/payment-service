const { query } = require('../../utils/database-wrapper');
const walletService = require('../wallets/wallet.service');
const { roundMoney } = require('../../utils/money');

function normalizeAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return roundMoney(numericValue);
}

class WithdrawalService {
  async createWithdrawal({ wallet_id, amount, status = 'pending', requested_at = null, processed_at = null }) {
    const normalizedAmount = normalizeAmount(amount);
    if (normalizedAmount === null) {
      const error = new Error('Withdrawal amount must be greater than 0');
      error.code = 'INVALID_WITHDRAWAL_AMOUNT';
      throw error;
    }

    return walletService.inTransaction(async (client) => {
      const wallet = await walletService.lockWallet(wallet_id, client);
      if (!wallet) {
        const error = new Error(`Wallet ${wallet_id} not found`);
        error.code = 'WALLET_NOT_FOUND';
        throw error;
      }

      const availableBalance = Number(wallet.available_balance ?? wallet.balance);
      if (!Number.isFinite(availableBalance) || availableBalance < normalizedAmount) {
        const error = new Error('Insufficient available wallet balance for this withdrawal.');
        error.code = 'INSUFFICIENT_AVAILABLE_BALANCE';
        error.details = {
          walletId: Number(wallet_id),
          availableBalance: Number.isFinite(availableBalance) ? roundMoney(availableBalance) : 0,
          requestedAmount: normalizedAmount,
        };
        throw error;
      }

      const result = await client.query(
        `INSERT INTO withdrawals (wallet_id, amount, status, requested_at, processed_at)
         VALUES ($1, $2, $3, COALESCE($4, NOW()), $5)
         RETURNING *`,
        [wallet_id, normalizedAmount, status, requested_at, processed_at]
      );

      const withdrawal = result.rows[0];

      await walletService.reserveWithdrawalFunds(wallet_id, normalizedAmount, withdrawal.id, client);

      return withdrawal;
    });
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
    return walletService.inTransaction(async (client) => {
      const result = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [withdrawalId]);
      const withdrawal = result.rows[0] || null;

      if (!withdrawal) {
        return null;
      }

      const currentStatus = String(withdrawal.status || '').trim().toLowerCase();
      const nextStatus = String(status || '').trim().toLowerCase();

      if (!nextStatus || currentStatus === nextStatus) {
        return withdrawal;
      }

      if (nextStatus === 'processing' && currentStatus === 'pending') {
        const updated = await client.query(
          `UPDATE withdrawals
              SET status = $1,
                  processed_at = COALESCE($2, processed_at)
            WHERE id = $3
            RETURNING *`,
          [nextStatus, processed_at, withdrawalId]
        );
        return updated.rows[0] || null;
      }

      if (nextStatus === 'completed' && ['pending', 'processing'].includes(currentStatus)) {
        await walletService.completeWithdrawalFunds(
          withdrawal.wallet_id,
          withdrawal.amount,
          withdrawal.id,
          client
        );

        const updated = await client.query(
          `UPDATE withdrawals
              SET status = 'completed',
                  processed_at = COALESCE($1, NOW())
            WHERE id = $2
            RETURNING *`,
          [processed_at, withdrawalId]
        );

        return updated.rows[0] || null;
      }

      if (nextStatus === 'failed' && ['pending', 'processing'].includes(currentStatus)) {
        await walletService.releaseWithdrawalFunds(
          withdrawal.wallet_id,
          withdrawal.amount,
          withdrawal.id,
          client
        );

        const updated = await client.query(
          `UPDATE withdrawals
              SET status = 'failed',
                  processed_at = COALESCE($1, NOW())
            WHERE id = $2
            RETURNING *`,
          [processed_at, withdrawalId]
        );

        return updated.rows[0] || null;
      }

      if (currentStatus === 'completed' && nextStatus !== 'completed') {
        const error = new Error('Completed withdrawals are immutable.');
        error.code = 'WITHDRAWAL_TERMINAL_STATE';
        throw error;
      }

      if (currentStatus === 'failed' && nextStatus !== 'failed') {
        const error = new Error('Failed withdrawals cannot be reopened automatically.');
        error.code = 'WITHDRAWAL_TERMINAL_STATE';
        throw error;
      }

      const error = new Error(`Unsupported withdrawal status transition: ${currentStatus} -> ${nextStatus}`);
      error.code = 'INVALID_WITHDRAWAL_STATUS_TRANSITION';
      throw error;
    });
  }

  async updateWithdrawal(withdrawalId, { amount, status, processed_at, requested_at }) {
    return walletService.inTransaction(async (client) => {
      const result = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [withdrawalId]);
      const withdrawal = result.rows[0] || null;
      if (!withdrawal) {
        return null;
      }

      if (amount !== undefined && roundMoney(amount) !== roundMoney(withdrawal.amount)) {
        const error = new Error('Withdrawal amount cannot be edited after creation.');
        error.code = 'WITHDRAWAL_AMOUNT_IMMUTABLE';
        throw error;
      }

      if (status && String(status).trim().toLowerCase() !== String(withdrawal.status).trim().toLowerCase()) {
        const nextStatus = String(status).trim().toLowerCase();
        const currentStatus = String(withdrawal.status || '').trim().toLowerCase();

        if (nextStatus === 'processing' && currentStatus === 'pending') {
          const updated = await client.query(
            `UPDATE withdrawals
                SET status = $1,
                    processed_at = COALESCE($2, processed_at)
              WHERE id = $3
              RETURNING *`,
            [nextStatus, processed_at, withdrawalId]
          );
          return updated.rows[0] || null;
        }

        if (nextStatus === 'completed' && ['pending', 'processing'].includes(currentStatus)) {
          await walletService.completeWithdrawalFunds(
            withdrawal.wallet_id,
            withdrawal.amount,
            withdrawal.id,
            client
          );

          const updated = await client.query(
            `UPDATE withdrawals
                SET status = 'completed',
                    processed_at = COALESCE($1, NOW())
              WHERE id = $2
              RETURNING *`,
            [processed_at, withdrawalId]
          );
          return updated.rows[0] || null;
        }

        if (nextStatus === 'failed' && ['pending', 'processing'].includes(currentStatus)) {
          await walletService.releaseWithdrawalFunds(
            withdrawal.wallet_id,
            withdrawal.amount,
            withdrawal.id,
            client
          );

          const updated = await client.query(
            `UPDATE withdrawals
                SET status = 'failed',
                    processed_at = COALESCE($1, NOW())
              WHERE id = $2
              RETURNING *`,
            [processed_at, withdrawalId]
          );
          return updated.rows[0] || null;
        }

        const error = new Error(`Unsupported withdrawal status transition: ${currentStatus} -> ${nextStatus}`);
        error.code = 'INVALID_WITHDRAWAL_STATUS_TRANSITION';
        throw error;
      }

      const updated = await client.query(
        `UPDATE withdrawals
            SET requested_at = COALESCE($1, requested_at),
                processed_at = COALESCE($2, processed_at)
          WHERE id = $3
          RETURNING *`,
        [requested_at ?? null, processed_at ?? null, withdrawalId]
      );

      return updated.rows[0] || null;
    });
  }

  async deleteWithdrawal(withdrawalId) {
    return walletService.inTransaction(async (client) => {
      const result = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [withdrawalId]);
      const withdrawal = result.rows[0] || null;

      if (!withdrawal) {
        return null;
      }

      const currentStatus = String(withdrawal.status || '').trim().toLowerCase();
      if (currentStatus === 'pending' || currentStatus === 'processing') {
        await walletService.releaseWithdrawalFunds(
          withdrawal.wallet_id,
          withdrawal.amount,
          withdrawal.id,
          client
        );
      }

      const deleted = await client.query('DELETE FROM withdrawals WHERE id = $1 RETURNING *', [withdrawalId]);
      return deleted.rows[0] || null;
    });
  }
}

module.exports = new WithdrawalService();
