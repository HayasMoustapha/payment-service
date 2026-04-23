jest.mock('../../src/core/payments/payment-processing.service', () => ({
  processPayment: jest.fn()
}));

jest.mock('../../src/core/payments/payment.service', () => ({
  getPaymentByPurchaseId: jest.fn(),
  updatePayment: jest.fn()
}));

jest.mock('../../src/core/gateways/gateway-manager.service', () => ({
  getProvider: jest.fn()
}));

jest.mock('../../src/core/gateways/payment-gateway.service', () => ({
  getGatewayByCode: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const paymentFlowController = require('../../src/api/controllers/payment-flow.controller');
const paymentProcessingService = require('../../src/core/payments/payment-processing.service');
const paymentService = require('../../src/core/payments/payment.service');

function createResponseDouble() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('payment-flow.controller initiatePayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.PAYMENT_ALLOW_MOCK;
  });

  it('reuses the failed purchase payment when mock fallback hits a unique purchase constraint', async () => {
    paymentProcessingService.processPayment.mockRejectedValueOnce(new Error('Invalid API Key provided'));
    paymentService.getPaymentByPurchaseId.mockResolvedValue({
      id: 41,
      status: 'failed',
      purchase_id: 99
    });
    paymentService.updatePayment.mockImplementation(async (paymentId, payload) => ({
      id: paymentId,
      status: payload.status,
      payment_method: payload.payment_method,
      transaction_id: payload.transaction_id,
      gateway_response: payload.gateway_response
    }));

    const req = {
      body: {
        organizer_id: 7,
        event_id: 99,
        amount: 1500,
        currency: 'EUR',
        payment_method: 'stripe',
        use_checkout: true,
        customer_info: {
          email: 'guest@example.com',
          name: 'Guest User'
        },
        metadata: {
          event_guest_id: 99,
          description: 'Paid invitation checkout proof',
          return_url: 'http://localhost:3006/success',
          cancel_url: 'http://localhost:3006/cancel',
          use_checkout: true
        },
        payment_intent_id: 'pi_local_123'
      }
    };
    const res = createResponseDouble();

    await paymentFlowController.initiatePayment(req, res);

    expect(paymentProcessingService.processPayment).toHaveBeenCalledTimes(1);
    expect(paymentService.getPaymentByPurchaseId).toHaveBeenCalledWith(99);
    expect(paymentService.updatePayment).toHaveBeenCalledWith(
      41,
      expect.objectContaining({
        status: 'pending',
        payment_method: 'mock',
        transaction_id: expect.stringMatching(/^mock_/),
        gateway_response: {
          provider: 'mock',
          metadata: expect.objectContaining({
            event_id: 99,
            organizer_id: 7,
            payment_intent_id: 'pi_local_123',
            payment_id: 41,
            original_error: 'Invalid API Key provided'
          })
        }
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Payment initiated (mock)',
        data: expect.objectContaining({
          payment_service_id: 41,
          payment_url: 'http://localhost:3006/success',
          client_secret: expect.stringMatching(/^mock_secret_/),
          status: 'pending'
        })
      })
    );
  });
});
