const paymentService = require('./payment.service');
const commissionService = require('../commissions/commission.service');
const gatewayManager = require('../gateways/gateway-manager.service');
const paymentGatewayService = require('../gateways/payment-gateway.service');
const walletService = require('../wallets/wallet.service');
const logger = require('../../utils/logger');
const { normalizeStoredPaymentAmount, roundMoney } = require('../../utils/money');
const axios = require('axios');

const DEFAULT_GATEWAY_FALLBACKS = ['stripe', 'paypal'];

const allowMockGateway = () => (
  process.env.PAYMENT_ALLOW_MOCK === 'true' || process.env.NODE_ENV !== 'production'
);

class PaymentProcessingService {
  parseGatewayResponse(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    if (typeof value === 'object') {
      return value;
    }

    return null;
  }

  extractPaymentMetadata(payment) {
    const gatewayResponse = this.parseGatewayResponse(payment?.gateway_response);
    if (
      gatewayResponse &&
      typeof gatewayResponse.metadata === 'object' &&
      gatewayResponse.metadata !== null
    ) {
      return gatewayResponse.metadata;
    }

    return {};
  }

  async finalizeDesignerTemplateRevenue(payment) {
    const metadata = this.extractPaymentMetadata(payment);
    if (String(metadata.payment_type || '').trim().toLowerCase() !== 'template_purchase') {
      return null;
    }

    const designerId = Number(metadata.designer_id);
    if (!Number.isFinite(designerId) || designerId <= 0) {
      return null;
    }

    const templateId = metadata.template_id ?? null;
    const grossAmount = normalizeStoredPaymentAmount(payment.amount, payment.currency);
    const commissionRate = Number(process.env.TEMPLATE_COMMISSION_RATE || 0);
    const commissionAmount = roundMoney(grossAmount * (Number.isFinite(commissionRate) ? commissionRate : 0));
    const netAmount = roundMoney(grossAmount - commissionAmount);

    if (netAmount < 0) {
      const error = new Error(`Computed net amount is negative for payment ${payment.id}`);
      error.code = 'INVALID_TEMPLATE_NET_AMOUNT';
      throw error;
    }

    return walletService.inTransaction(async (client) => {
      let commission = await commissionService.getCommissionByPayment(payment.id, client);
      if (!commission && commissionRate > 0) {
        commission = await commissionService.createCommission(
          {
            payment_id: payment.id,
            rate: commissionRate,
            amount: commissionAmount,
            type: 'template_sale',
          },
          client
        );
      }

      const credited = await walletService.creditDesignerSale(
        designerId,
        {
          amount: netAmount,
          currency: payment.currency,
          paymentId: payment.id,
          templateId,
          grossAmount,
          commissionAmount: commission?.amount ?? commissionAmount,
          description: 'Marketplace template sale credited to designer wallet',
          metadata,
        },
        client
      );

      return {
        commission,
        credited,
        grossAmount,
        netAmount,
      };
    });
  }

  async applyPaymentStateTransition(
    payment,
    {
      nextStatus,
      transactionId = null,
      gatewayResponse = null,
      providerCode = null,
      notifyCore = true,
    }
  ) {
    const normalizedNextStatus = typeof nextStatus === 'string' ? nextStatus.trim().toLowerCase() : '';
    if (!normalizedNextStatus) {
      return payment;
    }

    const updatedPayment = await paymentService.updatePayment(payment.id, {
      status: normalizedNextStatus,
      transaction_id: transactionId || payment.transaction_id,
      gateway_response: gatewayResponse || payment.gateway_response,
    }) || payment;

    if (normalizedNextStatus === 'completed') {
      try {
        await this.finalizeDesignerTemplateRevenue(updatedPayment);
      } catch (error) {
        logger.error('Failed to finalize designer template revenue', {
          paymentId: updatedPayment.id,
          error: error.message,
        });
        throw error;
      }
    }

    if (notifyCore && ['completed', 'failed', 'refunded'].includes(normalizedNextStatus)) {
      const metadata = this.extractPaymentMetadata(updatedPayment);
      await this.notifyCoreService({
        paymentIntentId:
          metadata.payment_intent_id ||
          updatedPayment.transaction_id ||
          transactionId,
        status: normalizedNextStatus,
        provider: providerCode || updatedPayment.payment_method,
        data: {
          payment_service_id: updatedPayment.id,
          template_id: metadata.template_id,
          event_id: metadata.event_id,
          metadata,
        }
      });
    }

    return updatedPayment;
  }

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

    let updatedPayment = await paymentService.updatePayment(paymentRecord.id, {
      transaction_id: gatewayResult.transactionId || null,
      gateway_response: gatewayResponse,
      status: gatewayResult.status || 'pending'
    });

    if (updatedPayment && ['completed', 'failed', 'refunded'].includes(String(updatedPayment.status || '').trim().toLowerCase())) {
      updatedPayment = await this.applyPaymentStateTransition(updatedPayment, {
        nextStatus: updatedPayment.status,
        transactionId: updatedPayment.transaction_id,
        gatewayResponse,
        providerCode: gateway.code,
        notifyCore: true,
      });
    }

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
            metadata: this.extractPaymentMetadata(payment)
          };

          payment = await this.applyPaymentStateTransition(payment, {
            nextStatus: providerStatus.status,
            transactionId: providerStatus.transactionId || payment.transaction_id,
            gatewayResponse,
            providerCode: payment.payment_method,
            notifyCore: true,
          });
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

    return this.applyPaymentStateTransition(payment, {
      nextStatus: 'failed',
      providerCode: payment.payment_method,
      notifyCore: true,
    });
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
      metadata: this.extractPaymentMetadata(payment)
    };

    const updated = await this.applyPaymentStateTransition(payment, {
      nextStatus: parsed.status || 'pending',
      transactionId: payment.transaction_id || parsed.transactionId,
      gatewayResponse,
      providerCode,
      notifyCore: true,
    });

    return { success: true, payment: updated };
  }

  async updatePaymentStatus(paymentId, status) {
    const payment = await paymentService.getPayment(paymentId);
    if (!payment) {
      return null;
    }

    return this.applyPaymentStateTransition(payment, {
      nextStatus: status,
      providerCode: payment.payment_method,
      notifyCore: true,
    });
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
