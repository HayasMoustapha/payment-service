const { query, connect } = require('../../utils/database-wrapper');
const { roundMoney } = require('../../utils/money');

function normalizePositiveAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return roundMoney(numericValue);
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function parseNumericColumn(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundMoney(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return roundMoney(parsed);
    }
  }

  return 0;
}

class WalletService {
  async listWallets({ designer_id, limit = 50, offset = 0 } = {}, client = null) {
    const executor = client ?? { query };
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
    const result = await executor.query(
      `SELECT * FROM wallets ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

  async createWallet({ designer_id, balance = 0, currency }, client = null) {
    const executor = client ?? { query };
    const openingBalance = roundMoney(Number(balance) || 0);
    const result = await executor.query(
      `INSERT INTO wallets (designer_id, balance, available_balance, reserved_balance, currency)
       VALUES ($1, $2, $2, 0, $3)
       RETURNING *`,
      [designer_id, openingBalance, currency]
    );
    return result.rows[0];
  }

  async getWallet(walletId, client = null) {
    const executor = client ?? { query };
    const result = await executor.query('SELECT * FROM wallets WHERE id = $1', [walletId]);
    return result.rows[0] || null;
  }

  async getWalletByDesigner(designerId, client = null) {
    const executor = client ?? { query };
    const result = await executor.query('SELECT * FROM wallets WHERE designer_id = $1', [designerId]);
    return result.rows[0] || null;
  }

  async getOrCreateWalletByDesigner(designerId, { currency = 'EUR', client = null } = {}) {
    const executor = client ?? { query };
    const existingWallet = await this.getWalletByDesigner(designerId, executor);
    if (existingWallet) {
      return existingWallet;
    }

    return this.createWallet(
      {
        designer_id: designerId,
        currency,
      },
      executor
    );
  }

  async lockWallet(walletId, client) {
    const result = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [walletId]);
    return result.rows[0] || null;
  }

  async findTransactionByReference({ walletId, entryType, referenceType, referenceId }, client) {
    if (!referenceType || !referenceId) {
      return null;
    }

    const result = await client.query(
      `SELECT *
         FROM wallet_transactions
        WHERE wallet_id = $1
          AND entry_type = $2
          AND reference_type = $3
          AND reference_id = $4
        LIMIT 1`,
      [walletId, entryType, String(referenceType), String(referenceId)]
    );

    return result.rows[0] || null;
  }

  async applyWalletMutation(
    walletId,
    {
      amount,
      direction,
      entryType,
      referenceType = null,
      referenceId = null,
      description = null,
      metadata = {},
      deltaBalance = 0,
      deltaAvailable = 0,
      deltaReserved = 0,
      idempotent = false,
    },
    client
  ) {
    const normalizedAmount = normalizePositiveAmount(amount);
    if (normalizedAmount === null) {
      const error = new Error('Amount must be greater than 0');
      error.code = 'INVALID_WALLET_AMOUNT';
      throw error;
    }

    if (idempotent && referenceType && referenceId) {
      const existingTransaction = await this.findTransactionByReference(
        { walletId, entryType, referenceType, referenceId },
        client
      );

      if (existingTransaction) {
        const wallet = await this.lockWallet(walletId, client);
        return {
          wallet,
          transaction: existingTransaction,
          applied: false,
        };
      }
    }

    const lockedWallet = await this.lockWallet(walletId, client);
    if (!lockedWallet) {
      const error = new Error(`Wallet ${walletId} not found`);
      error.code = 'WALLET_NOT_FOUND';
      throw error;
    }

    const balanceBefore = parseNumericColumn(lockedWallet.balance);
    const availableBefore = parseNumericColumn(lockedWallet.available_balance ?? lockedWallet.balance);
    const reservedBefore = parseNumericColumn(lockedWallet.reserved_balance);

    const balanceAfter = roundMoney(balanceBefore + deltaBalance);
    const availableAfter = roundMoney(availableBefore + deltaAvailable);
    const reservedAfter = roundMoney(reservedBefore + deltaReserved);

    if (balanceAfter < 0 || availableAfter < 0 || reservedAfter < 0) {
      const error = new Error('Wallet mutation would create a negative balance');
      error.code = 'NEGATIVE_WALLET_BALANCE';
      error.details = {
        walletId,
        balanceBefore,
        availableBefore,
        reservedBefore,
        balanceAfter,
        availableAfter,
        reservedAfter,
      };
      throw error;
    }

    const updatedWalletResult = await client.query(
      `UPDATE wallets
          SET balance = $1,
              available_balance = $2,
              reserved_balance = $3
        WHERE id = $4
        RETURNING *`,
      [balanceAfter, availableAfter, reservedAfter, walletId]
    );

    const transactionResult = await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id,
         amount,
         direction,
         entry_type,
         reference_type,
         reference_id,
         description,
         metadata,
         balance_before,
         balance_after,
         available_before,
         available_after,
         reserved_before,
         reserved_after
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        walletId,
        normalizedAmount,
        direction,
        entryType,
        normalizeOptionalText(referenceType),
        normalizeOptionalText(referenceId),
        normalizeOptionalText(description),
        JSON.stringify(metadata || {}),
        balanceBefore,
        balanceAfter,
        availableBefore,
        availableAfter,
        reservedBefore,
        reservedAfter,
      ]
    );

    return {
      wallet: updatedWalletResult.rows[0],
      transaction: transactionResult.rows[0],
      applied: true,
    };
  }

  async creditDesignerSale(
    designerId,
    {
      amount,
      currency = 'EUR',
      paymentId,
      templateId = null,
      commissionAmount = 0,
      grossAmount = null,
      description = null,
      metadata = {},
    },
    client
  ) {
    const wallet = await this.getOrCreateWalletByDesigner(designerId, { currency, client });
    return this.applyWalletMutation(
      wallet.id,
      {
        amount,
        direction: 'credit',
        entryType: 'template_sale_credit',
        referenceType: 'payment',
        referenceId: String(paymentId),
        description: description || 'Marketplace template sale credit',
        metadata: {
          ...(metadata || {}),
          currency,
          payment_id: paymentId,
          template_id: templateId,
          commission_amount: roundMoney(Number(commissionAmount) || 0),
          gross_amount: grossAmount !== null ? roundMoney(Number(grossAmount) || 0) : null,
          net_amount: roundMoney(Number(amount) || 0),
        },
        deltaBalance: roundMoney(Number(amount) || 0),
        deltaAvailable: roundMoney(Number(amount) || 0),
        deltaReserved: 0,
        idempotent: true,
      },
      client
    );
  }

  async reserveWithdrawalFunds(walletId, amount, withdrawalId, client) {
    return this.applyWalletMutation(
      walletId,
      {
        amount,
        direction: 'reserve',
        entryType: 'withdrawal_reserve',
        referenceType: 'withdrawal',
        referenceId: String(withdrawalId),
        description: 'Funds reserved for designer withdrawal',
        deltaBalance: 0,
        deltaAvailable: -roundMoney(Number(amount) || 0),
        deltaReserved: roundMoney(Number(amount) || 0),
        idempotent: true,
      },
      client
    );
  }

  async completeWithdrawalFunds(walletId, amount, withdrawalId, client) {
    return this.applyWalletMutation(
      walletId,
      {
        amount,
        direction: 'debit',
        entryType: 'withdrawal_complete',
        referenceType: 'withdrawal',
        referenceId: String(withdrawalId),
        description: 'Reserved funds paid out to the designer',
        deltaBalance: -roundMoney(Number(amount) || 0),
        deltaAvailable: 0,
        deltaReserved: -roundMoney(Number(amount) || 0),
        idempotent: true,
      },
      client
    );
  }

  async releaseWithdrawalFunds(walletId, amount, withdrawalId, client) {
    return this.applyWalletMutation(
      walletId,
      {
        amount,
        direction: 'release',
        entryType: 'withdrawal_reversal',
        referenceType: 'withdrawal',
        referenceId: String(withdrawalId),
        description: 'Reserved withdrawal released back to available funds',
        deltaBalance: 0,
        deltaAvailable: roundMoney(Number(amount) || 0),
        deltaReserved: -roundMoney(Number(amount) || 0),
        idempotent: true,
      },
      client
    );
  }

  async listWalletTransactions(walletId, { limit = 20, offset = 0, entryType } = {}, client = null) {
    const executor = client ?? { query };
    const clauses = ['wallet_id = $1'];
    const values = [walletId];
    let idx = 2;

    if (entryType) {
      clauses.push(`entry_type = $${idx++}`);
      values.push(entryType);
    }

    values.push(limit);
    values.push(offset);

    const result = await executor.query(
      `SELECT *
         FROM wallet_transactions
        WHERE ${clauses.join(' AND ')}
        ORDER BY id DESC
        LIMIT $${idx++}
       OFFSET $${idx++}`,
      values
    );

    return result.rows;
  }

  async getDesignerPayoutSummary(designerId, { limit = 10 } = {}, client = null) {
    const executor = client ?? { query };
    const wallet = await this.getWalletByDesigner(designerId, executor);

    if (!wallet) {
      return {
        wallet: null,
        aggregates: {
          totalBalance: 0,
          availableBalance: 0,
          reservedBalance: 0,
          grossRevenue: 0,
          commissionTotal: 0,
          netRevenue: 0,
          pendingWithdrawals: 0,
          completedWithdrawals: 0,
        },
        earnings: [],
        withdrawals: [],
        transactions: [],
      };
    }

    const [earningsResult, withdrawalsResult, totalsResult, transactions] = await Promise.all([
      executor.query(
        `SELECT
           id,
           amount,
           reference_id,
           metadata,
           created_at
         FROM wallet_transactions
         WHERE wallet_id = $1
           AND entry_type = 'template_sale_credit'
         ORDER BY id DESC
         LIMIT $2`,
        [wallet.id, limit]
      ),
      executor.query(
        `SELECT *
           FROM withdrawals
          WHERE wallet_id = $1
          ORDER BY id DESC
          LIMIT $2`,
        [wallet.id, limit]
      ),
      executor.query(
        `SELECT
           COALESCE(SUM(CASE WHEN entry_type = 'template_sale_credit' THEN (metadata->>'gross_amount')::numeric ELSE 0 END), 0) AS gross_revenue,
           COALESCE(SUM(CASE WHEN entry_type = 'template_sale_credit' THEN (metadata->>'commission_amount')::numeric ELSE 0 END), 0) AS commission_total,
           COALESCE(SUM(CASE WHEN entry_type = 'template_sale_credit' THEN amount ELSE 0 END), 0) AS net_revenue,
           COALESCE(SUM(CASE WHEN entry_type = 'withdrawal_complete' THEN amount ELSE 0 END), 0) AS completed_withdrawals
         FROM wallet_transactions
         WHERE wallet_id = $1`,
        [wallet.id]
      ),
      this.listWalletTransactions(wallet.id, { limit }, executor),
    ]);

    const pendingWithdrawals = withdrawalsResult.rows
      .filter((withdrawal) => withdrawal.status === 'pending' || withdrawal.status === 'processing')
      .reduce((sum, withdrawal) => sum + parseNumericColumn(withdrawal.amount), 0);

    return {
      wallet,
      aggregates: {
        totalBalance: parseNumericColumn(wallet.balance),
        availableBalance: parseNumericColumn(wallet.available_balance ?? wallet.balance),
        reservedBalance: parseNumericColumn(wallet.reserved_balance),
        grossRevenue: parseNumericColumn(totalsResult.rows[0]?.gross_revenue),
        commissionTotal: parseNumericColumn(totalsResult.rows[0]?.commission_total),
        netRevenue: parseNumericColumn(totalsResult.rows[0]?.net_revenue),
        pendingWithdrawals: roundMoney(pendingWithdrawals),
        completedWithdrawals: parseNumericColumn(totalsResult.rows[0]?.completed_withdrawals),
      },
      earnings: earningsResult.rows.map((entry) => ({
        id: entry.id,
        payment_id: normalizeOptionalText(entry.reference_id),
        amount: parseNumericColumn(entry.amount),
        gross_amount: parseNumericColumn(entry.metadata?.gross_amount),
        commission_amount: parseNumericColumn(entry.metadata?.commission_amount),
        net_amount: parseNumericColumn(entry.metadata?.net_amount ?? entry.amount),
        currency: normalizeOptionalText(entry.metadata?.currency) || wallet.currency,
        template_id: normalizeOptionalText(entry.metadata?.template_id),
        created_at: entry.created_at,
      })),
      withdrawals: withdrawalsResult.rows,
      transactions,
    };
  }

  async updateBalance(walletId, balance) {
    const result = await query(
      'UPDATE wallets SET balance = $1, available_balance = $1 WHERE id = $2 RETURNING *',
      [roundMoney(balance), walletId]
    );
    return result.rows[0] || null;
  }

  async updateWallet(walletId, { balance, currency }) {
    const nextBalance = balance !== undefined ? roundMoney(balance) : null;
    const result = await query(
      `UPDATE wallets
       SET balance = COALESCE($1, balance),
           available_balance = CASE
             WHEN $1 IS NULL THEN available_balance
             ELSE COALESCE($1, balance) - reserved_balance
           END,
           currency = COALESCE($2, currency)
       WHERE id = $3
       RETURNING *`,
      [nextBalance, currency ?? null, walletId]
    );
    return result.rows[0] || null;
  }

  async deleteWallet(walletId) {
    const result = await query('DELETE FROM wallets WHERE id = $1 RETURNING *', [walletId]);
    return result.rows[0] || null;
  }

  async inTransaction(work) {
    const client = await connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new WalletService();
