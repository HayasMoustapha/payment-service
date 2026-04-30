process.env.DB_NAME = process.env.DB_NAME || 'event_planner_payments';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'admin';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';

const axios = require('axios');

const DatabaseBootstrap = require('../../src/services/database-bootstrap.service');
const { query } = require('../../src/utils/database-wrapper');
const paymentService = require('../../src/core/payments/payment.service');
const paymentProcessingService = require('../../src/core/payments/payment-processing.service');
const commissionService = require('../../src/core/commissions/commission.service');
const walletService = require('../../src/core/wallets/wallet.service');
const withdrawalService = require('../../src/core/withdrawals/withdrawal.service');

describe('Designer payouts financial flow', () => {
  beforeAll(async () => {
    process.env.TEMPLATE_COMMISSION_RATE = '0.20';
    await DatabaseBootstrap.initialize();
  });

  beforeEach(async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { success: true } });
    await query('DELETE FROM wallet_transactions');
    await query('DELETE FROM commissions');
    await query('DELETE FROM withdrawals');
    await query('DELETE FROM payments');
    await query('DELETE FROM wallets');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function getGatewayId() {
    const result = await query(
      `SELECT id
         FROM payment_gateways
        WHERE code IN ('mock', 'stripe', 'paypal')
        ORDER BY CASE code WHEN 'mock' THEN 0 WHEN 'stripe' THEN 1 ELSE 2 END
        LIMIT 1`
    );

    expect(result.rows[0]?.id).toBeTruthy();
    return Number(result.rows[0].id);
  }

  test('completed template payments create one commission and one net wallet credit', async () => {
    const gatewayId = await getGatewayId();
    const payment = await paymentService.createPayment({
      user_id: 501,
      gateway_id: gatewayId,
      purchase_id: null,
      amount: 85.55,
      currency: 'EUR',
      payment_method: 'mock',
      transaction_id: 'designer-payout-payment-1',
      gateway_response: {
        metadata: {
          template_id: 'TEMPLATE-901',
          designer_id: 901,
          payment_type: 'template_purchase',
        },
      },
      status: 'pending',
    });

    const completedPayment = await paymentProcessingService.updatePaymentStatus(payment.id, 'completed');
    expect(completedPayment.status).toBe('completed');

    const commission = await commissionService.getCommissionByPayment(payment.id);
    expect(Number(commission.amount)).toBeCloseTo(17.11, 2);
    expect(Number(commission.rate)).toBeCloseTo(0.2, 4);

    const wallet = await walletService.getWalletByDesigner(901);
    expect(wallet).toBeTruthy();
    expect(Number(wallet.balance)).toBeCloseTo(68.44, 2);
    expect(Number(wallet.available_balance)).toBeCloseTo(68.44, 2);
    expect(Number(wallet.reserved_balance)).toBeCloseTo(0, 2);

    const transactions = await walletService.listWalletTransactions(wallet.id, {
      entryType: 'template_sale_credit',
      limit: 20,
    });
    expect(transactions).toHaveLength(1);
    expect(Number(transactions[0].amount)).toBeCloseTo(68.44, 2);

    const completedAgain = await paymentProcessingService.updatePaymentStatus(payment.id, 'completed');
    expect(completedAgain.status).toBe('completed');

    const transactionsAfterReplay = await walletService.listWalletTransactions(wallet.id, {
      entryType: 'template_sale_credit',
      limit: 20,
    });
    expect(transactionsAfterReplay).toHaveLength(1);

    const summary = await walletService.getDesignerPayoutSummary(901, { limit: 5 });
    expect(summary.aggregates.grossRevenue).toBeCloseTo(85.55, 2);
    expect(summary.aggregates.commissionTotal).toBeCloseTo(17.11, 2);
    expect(summary.aggregates.netRevenue).toBeCloseTo(68.44, 2);
    expect(summary.earnings).toHaveLength(1);
    expect(summary.earnings[0].template_id).toBe('TEMPLATE-901');
  });

  test('withdrawal completion consumes reserved funds and debits the wallet once', async () => {
    await walletService.inTransaction(async (client) => {
      await walletService.creditDesignerSale(
        902,
        {
          amount: 100,
          currency: 'EUR',
          paymentId: 'seed-payment-902',
          templateId: 'TEMPLATE-902',
          grossAmount: 120,
          commissionAmount: 20,
        },
        client
      );
    });

    const wallet = await walletService.getWalletByDesigner(902);
    const withdrawal = await withdrawalService.createWithdrawal({
      wallet_id: wallet.id,
      amount: 40,
    });

    let refreshedWallet = await walletService.getWallet(wallet.id);
    expect(Number(refreshedWallet.balance)).toBeCloseTo(100, 2);
    expect(Number(refreshedWallet.available_balance)).toBeCloseTo(60, 2);
    expect(Number(refreshedWallet.reserved_balance)).toBeCloseTo(40, 2);

    const completedWithdrawal = await withdrawalService.updateStatus(withdrawal.id, 'completed');
    expect(completedWithdrawal.status).toBe('completed');

    refreshedWallet = await walletService.getWallet(wallet.id);
    expect(Number(refreshedWallet.balance)).toBeCloseTo(60, 2);
    expect(Number(refreshedWallet.available_balance)).toBeCloseTo(60, 2);
    expect(Number(refreshedWallet.reserved_balance)).toBeCloseTo(0, 2);

    const summary = await walletService.getDesignerPayoutSummary(902, { limit: 5 });
    expect(summary.aggregates.availableBalance).toBeCloseTo(60, 2);
    expect(summary.aggregates.completedWithdrawals).toBeCloseTo(40, 2);
    expect(summary.aggregates.pendingWithdrawals).toBeCloseTo(0, 2);
  });

  test('failed withdrawals release reserved funds back to the available balance', async () => {
    await walletService.inTransaction(async (client) => {
      await walletService.creditDesignerSale(
        903,
        {
          amount: 50,
          currency: 'EUR',
          paymentId: 'seed-payment-903',
          templateId: 'TEMPLATE-903',
          grossAmount: 62.5,
          commissionAmount: 12.5,
        },
        client
      );
    });

    const wallet = await walletService.getWalletByDesigner(903);
    const withdrawal = await withdrawalService.createWithdrawal({
      wallet_id: wallet.id,
      amount: 20,
    });

    let refreshedWallet = await walletService.getWallet(wallet.id);
    expect(Number(refreshedWallet.available_balance)).toBeCloseTo(30, 2);
    expect(Number(refreshedWallet.reserved_balance)).toBeCloseTo(20, 2);

    const failedWithdrawal = await withdrawalService.updateStatus(withdrawal.id, 'failed');
    expect(failedWithdrawal.status).toBe('failed');

    refreshedWallet = await walletService.getWallet(wallet.id);
    expect(Number(refreshedWallet.balance)).toBeCloseTo(50, 2);
    expect(Number(refreshedWallet.available_balance)).toBeCloseTo(50, 2);
    expect(Number(refreshedWallet.reserved_balance)).toBeCloseTo(0, 2);

    const summary = await walletService.getDesignerPayoutSummary(903, { limit: 5 });
    expect(summary.aggregates.availableBalance).toBeCloseTo(50, 2);
    expect(summary.aggregates.pendingWithdrawals).toBeCloseTo(0, 2);
  });
});
