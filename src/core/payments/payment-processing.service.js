const paymentService = require('./payment.service');
const commissionService = require('../commissions/commission.service');
const gatewayManager = require('../gateways/gateway-manager.service');
const paymentGatewayService = require('../gateways/payment-gateway.service');
const logger = require('../../utils/logger');
const axios = require('axios');

const DEFAULT_GATEWAY_FALLBACKS = ['stripe', 'paypal'];

const allowMockGateway = () => (
  process.env.PAYMENT_ALLOW_MOCK === 'true' || process.env.NODE_ENV !== 'production'
);

class PaymentProcessingService {
  async ensureMockGateway() {
    const existingMockGateway = await paymentGatewayService.getGatewayByCode('mock');
    if (existingMockGateway?.is_active) {
      return existingMockGateway;
    }

    if (existingMockGateway) {
      return paymentGatewayService.updateGateway(existingMockGateway.id, {
        is_active: true,
        config: { ...(existingMockGateway.config || {}), mode: 'mock' }
      });
    }

    return paymentGatewayService.createGateway({
      name: 'Mock Gateway',
      code: 'mock',
      is_active: true,
      config: { mode: 'mock' }
    });
  }

  async resolveGatewaySelection(paymentMethod, preferredGateways = []) {
    const normalizedPaymentMethod = typeof paymentMethod === 'string'
      ? paymentMethod.trim().toLowerCase()
      : '';
    const normalizedPreferredGateways = preferredGateways
      .map((gatewayCode) => typeof gatewayCode === 'string' ? gatewayCode.trim().toLowerCase() : '')
      .filter(Boolean);

    if (normalizedPaymentMethod === 'mock') {
      if (!allowMockGateway()) {
        const error = new Error('Mock payment gateway is disabled');
        error.code = 'PAYMENT_METHOD_NOT_AVAILABLE';
        throw error;
      }
      return this.ensureMockGateway();
    }

    if (normalizedPaymentMethod) {
      const explicitGateway = await gatewayManager.selectGateway({
        preferredGateways: [normalizedPaymentMethod],
        fallback: []
      });

      if (explicitGateway) {
        return explicitGateway;
      }

      const error = new Error(`Payment method "${normalizedPaymentMethod}" is not available`);
      error.code = 'PAYMENT_METHOD_NOT_AVAILABLE';
      throw error;
    }

    let gateway = await gatewayManager.selectGateway({
      preferredGateways: normalizedPreferredGateways,
      fallback: DEFAULT_GATEWAY_FALLBACKS
    });

    if (!gateway && allowMockGateway()) {
      gateway = await this.ensureMockGateway();
    }

    if (!gateway) {
      const error = new Error('No active payment gateway available');
      error.code = 'PAYMENT_GATEWAY_UNAVAILABLE';
      throw error;
    }

    return gateway;
  }

  async processPayment({
    userId,
    purchaseId = null,
    amount,
    currency = 'EUR',
    paymentMethod,
    description,
    customer,
    returnUrl,
    cancelUrl,
    preferredGateways = [],
    metadata = {},
    useCheckout = false
  }) {
    const gateway = await this.resolveGatewaySelection(paymentMethod, preferredGateways);

    const paymentRecord = await paymentService.createPayment({
      user_id: userId,
      gateway_id: gateway.id,
      purchase_id: purchaseId,
      amount,
      currency,
      payment_method: gateway.code,
      status: 'pending'
    });

    let gatewayResult;
    try {
      gatewayResult = await gatewayManager.initiatePayment({
        providerCode: gateway.code,
        amount,
        currency,
        description,
        metadata: {
          ...metadata,
          payment_id: paymentRecord.id
        },
        customer,
        returnUrl,
        cancelUrl,
        paymentId: paymentRecord.id,
        useCheckout,
        gatewayConfig: gateway.config || {}
      });
    } catch (error) {
      await paymentService.updatePayment(paymentRecord.id, {
        status: 'failed',
        gateway_response: {
          provider: null,
          metadata: {
            ...metadata,
            payment_id: paymentRecord.id,
            error: error.message
          }
        }
      });
      throw error;
    }

    const gatewayResponse = {
      provider: gatewayResult.raw || null,
      metadata: {
        ...metadata,
        payment_id: paymentRecord.id
      }
    };

    const updatedPayment = await paymentService.updatePayment(paymentRecord.id, {
      transaction_id: gatewayResult.transactionId || null,
      gateway_response: gatewayResponse,
      status: gatewayResult.status || 'pending'
    });

    return {
      payment: updatedPayment,
      gateway: gateway.code,
      transactionId: gatewayResult.transactionId,
      paymentUrl: gatewayResult.paymentUrl,
      clientSecret: gatewayResult.clientSecret
    };
  }

  async processTemplatePurchase({
    userId,
    templateId,
    designerId,
    amount,
    currency = 'EUR',
    paymentMethod,
    description,
    customer,
    returnUrl,
    cancelUrl,
    metadata = {}
  }) {
    const result = await this.processPayment({
      userId,
      purchaseId: templateId,
      amount,
      currency,
      paymentMethod,
      description,
      customer,
      returnUrl,
      cancelUrl,
      metadata: {
        ...metadata,
        template_id: templateId,
        designer_id: designerId,
        payment_type: 'template_purchase'
      }
    });

    const commissionRate = Number(process.env.TEMPLATE_COMMISSION_RATE || 0);
    if (commissionRate > 0) {
      try {
        await commissionService.createCommission({
          payment_id: result.payment.id,
          rate: commissionRate,
          amount: Number(amount) * commissionRate,
          type: 'template_sale'
        });
      } catch (error) {
        logger.error('Failed to create commission', { error: error.message });
      }
    }

    return result;
  }

  async getPaymentStatus(paymentIdOrTransaction) {
    let payment = null;
    if (String(paymentIdOrTransaction).match(/^\d+$/)) {
      payment = await paymentService.getPayment(Number(paymentIdOrTransaction));
    }

    if (!payment) {
      payment = await paymentService.getPaymentByTransactionId(paymentIdOrTransaction);
    }

    if (!payment) {
      return null;
    }

    if (payment.status === 'pending' && payment.transaction_id) {
      try {
        const providerStatus = await gatewayManager.getPaymentStatus(
          payment.payment_method,
          payment.transaction_id,
        );

        if (providerStatus?.status) {
          const gatewayResponse = {
            provider: providerStatus.raw || payment.gateway_response?.provider || payment.gateway_response || null,
            metadata: payment.gateway_response?.metadata || {}
          };

          payment = await paymentService.updatePayment(payment.id, {
            status: providerStatus.status,
            transaction_id: providerStatus.transactionId || payment.transaction_id,
            gateway_response: gatewayResponse
          }) || payment;

          if (['completed', 'failed', 'refunded'].includes(providerStatus.status)) {
            await this.notifyCoreService({
              paymentIntentId:
                payment.gateway_response?.metadata?.payment_intent_id ||
                payment.transaction_id ||
                providerStatus.transactionId,
              status: providerStatus.status,
              provider: payment.payment_method,
              data: {
                payment_service_id: payment.id,
                template_id: payment.gateway_response?.metadata?.template_id,
                event_id: payment.gateway_response?.metadata?.event_id,
                metadata: payment.gateway_response?.metadata || {}
              }
            });
          }
        }
      } catch (error) {
        logger.warn('Provider payment status synchronization failed', {
          paymentId: payment.id,
          transactionId: payment.transaction_id,
          provider: payment.payment_method,
          error: error.message
        });
      }
    }

    return payment;
  }

  async cancelPayment(paymentId) {
    const payment = await paymentService.getPayment(paymentId);
    if (!payment) {
      return null;
    }

    if (payment.transaction_id) {
      await gatewayManager.cancelPayment(payment.payment_method, payment.transaction_id);
    }

    return paymentService.updatePaymentStatus(payment.id, 'failed');
  }

  async processWebhook(providerCode, { rawBody, signature, headers, body }) {
    const verification = await gatewayManager.verifyWebhook(providerCode, { rawBody, signature, headers, body });
    if (!verification.success) {
      return { success: false, error: verification.error || 'Webhook verification failed' };
    }

    const event = verification.event || body;
    const parsed = await gatewayManager.parseWebhook(providerCode, event);
    if (!parsed) {
      return { success: false, error: 'Unable to parse webhook' };
    }

    const payment = parsed.paymentId
      ? await paymentService.getPayment(parsed.paymentId)
      : await paymentService.getPaymentByTransactionId(parsed.transactionId);

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    const gatewayResponse = {
      provider: parsed.raw || payment.gateway_response?.provider || payment.gateway_response || null,
      metadata: payment.gateway_response?.metadata || {}
    };

    const updated = await paymentService.updatePayment(payment.id, {
      status: parsed.status || 'pending',
      transaction_id: payment.transaction_id || parsed.transactionId,
      gateway_response: gatewayResponse
    });

    await this.notifyCoreService({
      paymentIntentId: payment.gateway_response?.metadata?.payment_intent_id || payment.transaction_id || parsed.transactionId,
      status: parsed.status,
      provider: providerCode,
      data: {
        payment_service_id: payment.id,
        template_id: payment.gateway_response?.metadata?.template_id,
        event_id: payment.gateway_response?.metadata?.event_id
      }
    });

    return { success: true, payment: updated };
  }

  async notifyCoreService({ paymentIntentId, status, provider, data }) {
    if (!['completed', 'failed', 'refunded'].includes(status)) {
      return;
    }
    const coreUrl = process.env.CORE_SERVICE_URL || process.env.CORE_URL || 'http://localhost:3001';
    const payload = {
      eventType: `payment.${status}`,
      paymentIntentId,
      status,
      timestamp: new Date().toISOString(),
      data: {
        source: 'payment-service',
        provider,
        ...data
      }
    };

    try {
      await axios.post(`${coreUrl}/api/internal/payment-webhook`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'payment-service'
        },
        timeout: Number(process.env.INTER_SERVICE_TIMEOUT || 10000)
      });
    } catch (error) {
      logger.error('Failed to notify core service', { error: error.message });
    }
  }
}

module.exports = new PaymentProcessingService();
