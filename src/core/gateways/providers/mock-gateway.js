class MockGateway {
  constructor() {
    this.code = 'mock';
  }

  isReady() {
    return true;
  }

  async initiatePayment({ amount, currency, description, metadata, customer, returnUrl, cancelUrl }) {
    return {
      status: 'pending',
      transactionId: `mock_${Date.now()}`,
      paymentUrl: returnUrl || cancelUrl || 'http://localhost:3001',
      clientSecret: `mock_secret_${Date.now()}`,
      raw: {
        amount,
        currency,
        description,
        metadata,
        customer
      }
    };
  }

  async getPaymentStatus(transactionId) {
    return {
      status: 'completed',
      transactionId: transactionId || null,
      raw: {
        transaction_id: transactionId || null,
        status: 'completed'
      }
    };
  }

  async cancelPayment() {
    return {
      status: 'cancelled'
    };
  }
}

module.exports = MockGateway;
