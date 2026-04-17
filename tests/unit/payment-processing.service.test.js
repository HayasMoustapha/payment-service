jest.mock('../../src/core/payments/payment.service', () => ({
  createPayment: jest.fn(),
  updatePayment: jest.fn(),
  getPayment: jest.fn(),
  getPaymentByTransactionId: jest.fn(),
  updatePaymentStatus: jest.fn()
}));

jest.mock('../../src/core/commissions/commission.service', () => ({
  createCommission: jest.fn()
}));

jest.mock('../../src/core/gateways/gateway-manager.service', () => ({
  selectGateway: jest.fn(),
  initiatePayment: jest.fn(),
  cancelPayment: jest.fn(),
  verifyWebhook: jest.fn(),
  parseWebhook: jest.fn()
}));

jest.mock('../../src/core/gateways/payment-gateway.service', () => ({
  getGatewayByCode: jest.fn(),
  createGateway: jest.fn(),
  updateGateway: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const paymentProcessingService = require('../../src/core/payments/payment-processing.service');
const paymentService = require('../../src/core/payments/payment.service');
const gatewayManager = require('../../src/core/gateways/gateway-manager.service');
const paymentGatewayService = require('../../src/core/gateways/payment-gateway.service');

describe('payment-processing.service gateway selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.PAYMENT_ALLOW_MOCK;

    paymentService.createPayment.mockResolvedValue({
      id: 42,
      gateway_id: 9,
      amount: 1234,
      currency: 'EUR',
      status: 'pending'
    });
    paymentService.updatePayment.mockImplementation(async (paymentId, payload) => ({
      id: paymentId,
      ...payload
    }));
    gatewayManager.initiatePayment.mockResolvedValue({
      status: 'pending',
      transactionId: 'mock_tx_42',
      paymentUrl: 'http://localhost/test-success',
      clientSecret: 'mock_secret_42',
      raw: { ok: true }
    });
  });

  it('creates and uses the mock gateway when mock is explicitly requested', async () => {
    paymentGatewayService.getGatewayByCode.mockResolvedValue(null);
    paymentGatewayService.createGateway.mockResolvedValue({
      id: 9,
      code: 'mock',
      is_active: true,
      config: { mode: 'mock' }
    });

    const result = await paymentProcessingService.processPayment({
      userId: 1,
      purchaseId: 77,
      amount: 1234,
      currency: 'EUR',
      paymentMethod: 'mock',
      description: 'Mock initiation'
    });

    expect(gatewayManager.selectGateway).not.toHaveBeenCalled();
    expect(paymentGatewayService.createGateway).toHaveBeenCalledWith({
      name: 'Mock Gateway',
      code: 'mock',
      is_active: true,
      config: { mode: 'mock' }
    });
    expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      gateway_id: 9,
      payment_method: 'mock',
      status: 'pending'
    }));
    expect(gatewayManager.initiatePayment).toHaveBeenCalledWith(expect.objectContaining({
      providerCode: 'mock'
    }));
    expect(result.gateway).toBe('mock');
  });

  it('rejects an explicit unavailable gateway instead of silently falling back', async () => {
    gatewayManager.selectGateway.mockResolvedValue(null);

    await expect(
      paymentProcessingService.processPayment({
        userId: 1,
        purchaseId: 88,
        amount: 2200,
        currency: 'EUR',
        paymentMethod: 'stripe',
        description: 'Unavailable stripe gateway'
      })
    ).rejects.toMatchObject({
      code: 'PAYMENT_METHOD_NOT_AVAILABLE'
    });

    expect(paymentService.createPayment).not.toHaveBeenCalled();
    expect(gatewayManager.initiatePayment).not.toHaveBeenCalled();
  });
});
