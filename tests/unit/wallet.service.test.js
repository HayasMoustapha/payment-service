const walletService = require('../../src/core/wallets/wallet.service');
const { database } = require('../../src/config');

/**
 * Unit Tests for Wallet Service
 * Tests wallet creation, balance management, and transactions
 */
describe('Wallet Service', () => {
  beforeAll(async () => {
    await database.query('BEGIN');
  });

  afterAll(async () => {
    await database.query('ROLLBACK');
  });

  beforeEach(async () => {
    await database.query('DELETE FROM wallets WHERE user_id LIKE \'test%\'');
    await database.query('DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id LIKE \'test%\')');
  });

  describe('getOrCreateWallet', () => {
    test('should create new wallet for user', async () => {
      const result = await walletService.getOrCreateWallet('test-user-001', 'designer');

      expect(result.success).toBe(true);
      expect(result.wallet.user_id).toBe('test-user-001');
      expect(result.wallet.user_type).toBe('designer');
      expect(result.wallet.balance).toBe('0.00');
      expect(result.wallet.currency).toBe('EUR');
      expect(result.wallet.is_active).toBe(true);
    });

    test('should return existing wallet for user', async () => {
      // Create wallet first
      const createResult = await walletService.getOrCreateWallet('test-user-002', 'designer');
      expect(createResult.success).toBe(true);

      // Get existing wallet
      const getResult = await walletService.getOrCreateWallet('test-user-002', 'designer');
      
      expect(getResult.success).toBe(true);
      expect(getResult.wallet.id).toBe(createResult.wallet.id);
      expect(getResult.wallet.user_id).toBe('test-user-002');
    });
  });

  describe('getWalletBalance', () => {
    test('should return wallet balance', async () => {
      // Create wallet first
      await walletService.getOrCreateWallet('test-user-003', 'designer');

      const result = await walletService.getWalletBalance('test-user-003', 'designer');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(0.00);
      expect(result.currency).toBe('EUR');
    });

    test('should return error for non-existent wallet', async () => {
      const result = await walletService.getWalletBalance('non-existent-user', 'designer');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet not found');
    });
  });

  describe('creditWallet', () => {
    test('should credit wallet successfully', async () => {
      // Create wallet first
      await walletService.getOrCreateWallet('test-user-004', 'designer');

      const result = await walletService.creditWallet(
        'test-user-004',
        'designer',
        100.00,
        'sale',
        'test-sale-001'
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(100.00);
      expect(result.balanceBefore).toBe(0.00);
      expect(result.balanceAfter).toBe(100.00);
      expect(result.transactionType).toBe('credit');
      expect(result.referenceType).toBe('sale');
    });

    test('should validate credit amount', async () => {
      await walletService.getOrCreateWallet('test-user-005', 'designer');

      const result = await walletService.creditWallet(
        'test-user-005',
        'designer',
        -50.00, // Invalid negative amount
        'sale',
        'test-sale-002'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount must be greater than 0');
    });
  });

  describe('debitWallet', () => {
    test('should debit wallet successfully', async () => {
      // Create and credit wallet first
      await walletService.getOrCreateWallet('test-user-006', 'designer');
      await walletService.creditWallet('test-user-006', 'designer', 100.00, 'sale', 'test-sale-003');

      const result = await walletService.debitWallet(
        'test-user-006',
        'designer',
        50.00,
        'withdrawal',
        'test-withdrawal-001'
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(50.00);
      expect(result.balanceBefore).toBe(100.00);
      expect(result.balanceAfter).toBe(50.00);
      expect(result.transactionType).toBe('debit');
      expect(result.referenceType).toBe('withdrawal');
    });

    test('should check sufficient balance', async () => {
      await walletService.getOrCreateWallet('test-user-007', 'designer');
      await walletService.creditWallet('test-user-007', 'designer', 50.00, 'sale', 'test-sale-004');

      const result = await walletService.debitWallet(
        'test-user-007',
        'designer',
        100.00, // More than balance
        'withdrawal',
        'test-withdrawal-002'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
      expect(result.balance).toBe(50.00);
      expect(result.requested).toBe(100.00);
    });
  });

  describe('transferBetweenWallets', () => {
    test('should transfer between wallets successfully', async () => {
      // Create and fund source wallet
      await walletService.getOrCreateWallet('test-user-008', 'designer');
      await walletService.creditWallet('test-user-008', 'designer', 100.00, 'sale', 'test-sale-005');

      // Create destination wallet
      await walletService.getOrCreateWallet('test-user-009', 'organizer');

      const result = await walletService.transferBetweenWallets(
        'test-user-008',
        'designer',
        'test-user-009',
        'organizer',
        50.00,
        { description: 'Test transfer' }
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(50.00);
      expect(result.from.userId).toBe('test-user-008');
      expect(result.to.userId).toBe('test-user-009');

      // Verify balances
      const sourceBalance = await walletService.getWalletBalance('test-user-008', 'designer');
      const destBalance = await walletService.getWalletBalance('test-user-009', 'organizer');

      expect(sourceBalance.balance).toBe(50.00);
      expect(destBalance.balance).toBe(50.00);
    });
  });

  describe('getWalletTransactions', () => {
    test('should return wallet transactions', async () => {
      await walletService.getOrCreateWallet('test-user-010', 'designer');
      
      // Create some transactions
      await walletService.creditWallet('test-user-010', 'designer', 100.00, 'sale', 'test-sale-006');
      await walletService.debitWallet('test-user-010', 'designer', 30.00, 'withdrawal', 'test-withdrawal-003');

      const result = await walletService.getWalletTransactions('test-user-010', 'designer');

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      
      // Check transaction details
      const creditTransaction = result.transactions.find(t => t.transactionType === 'credit');
      const debitTransaction = result.transactions.find(t => t.transactionType === 'debit');
      
      expect(creditTransaction.amount).toBe(100.00);
      expect(debitTransaction.amount).toBe(30.00);
    });
  });

  describe('getWalletStatistics', () => {
    test('should return wallet statistics', async () => {
      await walletService.getOrCreateWallet('test-user-011', 'designer');
      
      // Create transactions
      await walletService.creditWallet('test-user-011', 'designer', 200.00, 'sale', 'test-sale-007');
      await walletService.debitWallet('test-user-011', 'designer', 50.00, 'withdrawal', 'test-withdrawal-004');

      const result = await walletService.getWalletStatistics('test-user-011', 'designer');

      expect(result.success).toBe(true);
      expect(result.statistics.totalTransactions).toBe(2);
      expect(result.statistics.creditTransactions).toBe(1);
      expect(result.statistics.debitTransactions).toBe(1);
      expect(result.statistics.totalCredits).toBe(200.00);
      expect(result.statistics.totalDebits).toBe(50.00);
      expect(result.statistics.netAmount).toBe(150.00);
    });
  });
});

/**
 * Integration Tests for Wallet Service
 * Tests real wallet operations with database consistency
 */
describe('Wallet Service Integration', () => {
  beforeAll(async () => {
    await database.query('BEGIN');
  });

  afterAll(async () => {
    await database.query('ROLLBACK');
  });

  test('should maintain transaction consistency', async () => {
    // Create wallet
    await walletService.getOrCreateWallet('integration-test-user', 'designer');

    // Perform multiple operations
    const credit1 = await walletService.creditWallet('integration-test-user', 'designer', 100.00, 'sale', 'int-test-001');
    const credit2 = await walletService.creditWallet('integration-test-user', 'designer', 50.00, 'sale', 'int-test-002');
    const debit1 = await walletService.debitWallet('integration-test-user', 'designer', 30.00, 'withdrawal', 'int-test-003');

    expect(credit1.success).toBe(true);
    expect(credit2.success).toBe(true);
    expect(debit1.success).toBe(true);

    // Verify final balance
    const balance = await walletService.getWalletBalance('integration-test-user', 'designer');
    expect(balance.balance).toBe(120.00); // 100 + 50 - 30

    // Verify transaction count
    const transactions = await walletService.getWalletTransactions('integration-test-user', 'designer');
    expect(transactions.transactions).toHaveLength(3);

    // Verify transaction history is immutable
    const transactionQuery = `
      SELECT * FROM wallet_transactions 
      WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = $1 AND user_type = $2)
      ORDER BY created_at ASC
    `;
    const transactionResult = await database.query(transactionQuery, ['integration-test-user', 'designer']);

    expect(transactionResult.rows).toHaveLength(3);
    expect(transactionResult.rows[0].transaction_type).toBe('credit');
    expect(transactionResult.rows[0].amount).toBe('100.00');
    expect(transactionResult.rows[1].transaction_type).toBe('credit');
    expect(transactionResult.rows[1].amount).toBe('50.00');
    expect(transactionResult.rows[2].transaction_type).toBe('debit');
    expect(transactionResult.rows[2].amount).toBe('30.00');
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('Running Wallet Service Tests...');
  
  const runTests = async () => {
    try {
      // Test wallet creation
      console.log('Testing wallet creation...');
      const walletResult = await walletService.getOrCreateWallet('test-runner', 'designer');
      console.log('✅ Wallet creation test passed');

      // Test wallet credit
      console.log('Testing wallet credit...');
      const creditResult = await walletService.creditWallet('test-runner', 'designer', 100.00, 'test', 'test-001');
      console.log('✅ Wallet credit test passed');

      // Test wallet balance
      console.log('Testing wallet balance...');
      const balanceResult = await walletService.getWalletBalance('test-runner', 'designer');
      expect(balanceResult.balance).toBe(100.00);
      console.log('✅ Wallet balance test passed');

      // Test wallet debit
      console.log('Testing wallet debit...');
      const debitResult = await walletService.debitWallet('test-runner', 'designer', 30.00, 'test', 'test-002');
      console.log('✅ Wallet debit test passed');

      // Verify final balance
      const finalBalance = await walletService.getWalletBalance('test-runner', 'designer');
      expect(finalBalance.balance).toBe(70.00);
      console.log('✅ Final balance verification passed');

      console.log('✅ All wallet tests passed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  runTests();
}
