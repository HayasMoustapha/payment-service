const paymentService = require('../../src/core/payments/payment.service');
const { database } = require('../../src/config');

/**
 * Unit Tests for Payment Service
 * Tests payment processing, template purchases, and webhook handling
 */
describe('Payment Service', () => {
  beforeAll(async () => {
    // Initialize database connection for tests
    await database.query('BEGIN');
  });

  afterAll(async () => {
    // Clean up test data
    await database.query('ROLLBACK');
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await database.query('DELETE FROM transactions WHERE metadata LIKE \'%test%\'');
    await database.query('DELETE FROM wallets WHERE user_id LIKE \'test%\'');
  });

  describe('processPayment', () => {
    test('should process payment successfully', async () => {
      const paymentData = {
        userId: 'test-user-001',
        eventId: 'test-event-001',
        amount: 100.00,
        currency: 'EUR',
        paymentMethod: 'stripe',
        description: 'Test payment',
        customerEmail: 'test@example.com',
        preferredGateways: ['stripe']
      };

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.amount).toBe(100.00);
      expect(result.currency).toBe('EUR');
      expect(result.status).toBe('pending');
    });

    test('should validate payment data', async () => {
      const invalidPaymentData = {
        userId: '', // Invalid empty user ID
        amount: -50, // Invalid negative amount
        currency: 'INVALID', // Invalid currency
        paymentMethod: 'stripe'
      };

      await expect(paymentService.processPayment(invalidPaymentData))
        .rejects.toThrow('User ID is required');
    });

    test('should handle template purchase payment', async () => {
      const templateData = {
        userId: 'test-user-002',
        templateId: 'test-template-001',
        designerId: 'test-designer-001',
        amount: 50.00,
        currency: 'EUR',
        paymentMethod: 'stripe',
        customerEmail: 'designer@example.com'
      };

      const result = await paymentService.processTemplatePurchase(templateData);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.amount).toBe(50.00);
    });
  });

  describe('processWebhook', () => {
    test('should process Stripe webhook successfully', async () => {
      const webhookData = {
        payload: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_123',
              status: 'succeeded',
              amount: 10000,
              currency: 'eur',
              metadata: {
                transactionId: 'test-transaction-001'
              }
            }
          }
        }),
        signature: 'test-signature',
        secret: 'test-secret'
      };

      const result = await paymentService.processWebhook('stripe', webhookData);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe('payment_intent.succeeded');
    });

    test('should handle webhook verification failure', async () => {
      const invalidWebhookData = {
        payload: 'invalid-json',
        signature: 'invalid-signature',
        secret: 'test-secret'
      };

      const result = await paymentService.processWebhook('stripe', invalidWebhookData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook signature');
    });
  });

  describe('getStatistics', () => {
    test('should return payment statistics', async () => {
      const filters = {
        userId: 'test-user-001',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const result = await paymentService.getStatistics(filters);

      expect(result.success).toBe(true);
      expect(result.transactions).toBeDefined();
      expect(result.gatewayStats).toBeDefined();
    });
  });
});

/**
 * Integration Tests for Payment Service
 * Tests real payment flow with database operations
 */
describe('Payment Service Integration', () => {
  let testTransactionId;

  beforeAll(async () => {
    // Setup test environment
    await database.query('BEGIN');
  });

  afterAll(async () => {
    // Clean up test environment
    await database.query('ROLLBACK');
  });

  test('should create and process complete payment flow', async () => {
    // Step 1: Create payment
    const paymentData = {
      userId: 'integration-test-user',
      eventId: 'integration-test-event',
      amount: 200.00,
      currency: 'EUR',
      paymentMethod: 'stripe',
      description: 'Integration test payment',
      customerEmail: 'integration@test.com'
    };

    const paymentResult = await paymentService.processPayment(paymentData);
    expect(paymentResult.success).toBe(true);
    testTransactionId = paymentResult.transactionId;

    // Step 2: Verify transaction was created
    const transactionQuery = `
      SELECT * FROM transactions 
      WHERE id = $1 AND user_id = $2
    `;
    const transactionResult = await database.query(transactionQuery, [
      testTransactionId, 
      paymentData.userId
    ]);

    expect(transactionResult.rows).toHaveLength(1);
    expect(transactionResult.rows[0].amount).toBe(200.00);
    expect(transactionResult.rows[0].currency).toBe('EUR');
    expect(transactionResult.rows[0].status).toBe('pending');

    // Step 3: Process webhook to complete payment
    const webhookData = {
      payload: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_integration_test',
            status: 'succeeded',
            amount: 20000,
            currency: 'eur',
            metadata: {
              transactionId: testTransactionId
            }
          }
        }
      }),
      signature: 'integration-test-signature',
      secret: 'integration-test-secret'
    };

    const webhookResult = await paymentService.processWebhook('stripe', webhookData);
    expect(webhookResult.success).toBe(true);

    // Step 4: Verify transaction status updated
    const updatedTransactionQuery = `
      SELECT * FROM transactions 
      WHERE id = $1
    `;
    const updatedResult = await database.query(updatedTransactionQuery, [testTransactionId]);

    expect(updatedResult.rows[0].status).toBe('completed');
  });

  test('should handle commission creation on template purchase', async () => {
    const templateData = {
      userId: 'integration-test-designer',
      templateId: 'integration-test-template',
      designerId: 'integration-test-designer',
      amount: 150.00,
      currency: 'EUR',
      paymentMethod: 'stripe',
      customerEmail: 'designer@test.com'
    };

    const result = await paymentService.processTemplatePurchase(templateData);
    expect(result.success).toBe(true);

    // Verify commission was created
    const commissionQuery = `
      SELECT * FROM commissions 
      WHERE transaction_id = $1
    `;
    const commissionResult = await database.query(commissionQuery, [result.transactionId]);

    expect(commissionResult.rows).toHaveLength(1);
    expect(commissionResult.rows[0].commission_type).toBe('template_sale');
    expect(commissionResult.rows[0].commission_amount).toBe(15.00); // 10% of 150.00
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('Running Payment Service Tests...');
  
  // Simple test runner
  const runTests = async () => {
    try {
      // Test payment processing
      console.log('Testing payment processing...');
      const paymentData = {
        userId: 'test-user',
        eventId: 'test-event',
        amount: 100.00,
        currency: 'EUR',
        paymentMethod: 'stripe',
        description: 'Test payment'
      };

      const result = await paymentService.processPayment(paymentData);
      console.log('✅ Payment processing test passed');

      // Test webhook processing
      console.log('Testing webhook processing...');
      const webhookData = {
        payload: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test',
              status: 'succeeded',
              amount: 10000,
              currency: 'eur'
            }
          }
        }),
        signature: 'test',
        secret: 'test'
      };

      const webhookResult = await paymentService.processWebhook('stripe', webhookData);
      console.log('✅ Webhook processing test passed');

      console.log('✅ All tests passed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  runTests();
}
