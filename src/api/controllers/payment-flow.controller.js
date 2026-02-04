const paymentProcessingService = require('../../core/payments/payment-processing.service');
const paymentService = require('../../core/payments/payment.service');
const gatewayManager = require('../../core/gateways/gateway-manager.service');
const paymentGatewayService = require('../../core/gateways/payment-gateway.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class PaymentFlowController {
  async processPayment(req, res) {
    try {
      const result = await paymentProcessingService.processPayment({
        userId: req.body.userId,
        purchaseId: req.body.purchaseId || null,
        amount: req.body.amount,
        currency: req.body.currency,
        paymentMethod: req.body.paymentMethod,
        description: req.body.description,
        customer: {
          email: req.body.customerEmail,
          name: req.body.customerName,
          phone: req.body.customerPhone
        },
        returnUrl: req.body.returnUrl,
        cancelUrl: req.body.cancelUrl,
        preferredGateways: req.body.preferredGateways || [],
        metadata: {
          ...(req.body.metadata || {}),
          event_id: req.body.eventId
        }
      });

      return res.status(201).json(createdResponse('Payment processed', {
        transactionId: result.payment.id,
        amount: result.payment.amount,
        currency: result.payment.currency,
        status: result.payment.status,
        gateway: result.gateway,
        paymentUrl: result.paymentUrl,
        clientSecret: result.clientSecret
      }));
    } catch (error) {
      logger.error('Payment processing failed', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to process payment'));
    }
  }

  async purchaseTemplate(req, res) {
    try {
      const result = await paymentProcessingService.processTemplatePurchase({
        userId: req.body.userId,
        templateId: req.body.templateId,
        designerId: req.body.designerId,
        amount: req.body.amount,
        currency: req.body.currency,
        paymentMethod: req.body.paymentMethod,
        description: req.body.description,
        customer: {
          email: req.body.customerEmail,
          name: req.body.customerName
        },
        returnUrl: req.body.returnUrl,
        cancelUrl: req.body.cancelUrl,
        metadata: req.body.metadata || {}
      });

      return res.status(201).json(createdResponse('Template purchase initiated', {
        transactionId: result.payment.id,
        templateId: req.body.templateId,
        designerId: req.body.designerId,
        amount: result.payment.amount,
        currency: result.payment.currency,
        status: result.payment.status,
        gateway: result.gateway,
        paymentUrl: result.paymentUrl,
        clientSecret: result.clientSecret
      }));
    } catch (error) {
      logger.error('Template purchase failed', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to purchase template'));
    }
  }

  async initiatePayment(req, res) {
    try {
      const result = await paymentProcessingService.processPayment({
        userId: req.body.organizer_id || req.body.user_id,
        purchaseId: req.body.event_id || null,
        amount: req.body.amount,
        currency: req.body.currency,
        paymentMethod: req.body.payment_method,
        description: req.body.metadata?.description,
        customer: req.body.customer_info || {},
        returnUrl: req.body.metadata?.return_url,
        cancelUrl: req.body.metadata?.cancel_url,
        metadata: {
          ...(req.body.metadata || {}),
          event_id: req.body.event_id,
          organizer_id: req.body.organizer_id,
          payment_intent_id: req.body.payment_intent_id
        }
      });

      return res.status(201).json(createdResponse('Payment initiated', {
        payment_service_id: result.payment.id,
        payment_url: result.paymentUrl,
        client_secret: result.clientSecret,
        status: result.payment.status
      }));
    } catch (error) {
      logger.error('Payment initiation failed', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to initiate payment'));
    }
  }

  async getPaymentStatus(req, res) {
    try {
      const payment = await paymentProcessingService.getPaymentStatus(req.params.paymentId || req.params.transactionId);
      if (!payment) {
        return res.status(404).json(notFoundResponse('Payment', req.params.paymentId || req.params.transactionId));
      }
      return res.status(200).json(successResponse('Payment status retrieved', payment));
    } catch (error) {
      logger.error('Failed to get payment status', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get payment status'));
    }
  }

  async listUserTransactions(req, res) {
    try {
      const userId = Number(req.params.userId);
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const page = req.query.page ? Number(req.query.page) : 1;
      const offset = (page - 1) * limit;
      const status = req.query.status;

      const transactions = await paymentService.listPayments({
        user_id: userId,
        status,
        limit,
        offset
      });

      return res.status(200).json(successResponse('User transactions retrieved', transactions, {
        page,
        limit
      }));
    } catch (error) {
      logger.error('Failed to list user transactions', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list user transactions'));
    }
  }

  async cancelPayment(req, res) {
    try {
      const payment = await paymentProcessingService.cancelPayment(Number(req.params.paymentId));
      if (!payment) {
        return res.status(404).json(notFoundResponse('Payment', req.params.paymentId));
      }
      return res.status(200).json(successResponse('Payment canceled', payment));
    } catch (error) {
      logger.error('Failed to cancel payment', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to cancel payment'));
    }
  }

  async createStripePaymentIntent(req, res) {
    try {
      const gatewayResult = await gatewayManager.initiatePayment({
        providerCode: 'stripe',
        amount: req.body.amount,
        currency: req.body.currency,
        description: req.body.description,
        metadata: req.body.metadata || {},
        customer: { email: req.body.customerEmail },
        paymentId: req.body.paymentId
      });

      return res.status(201).json(createdResponse('Stripe payment intent created', {
        paymentId: req.body.paymentId || null,
        status: gatewayResult.status,
        amount: req.body.amount,
        currency: req.body.currency,
        provider: 'stripe',
        clientSecret: gatewayResult.clientSecret,
        transactionId: gatewayResult.transactionId
      }));
    } catch (error) {
      logger.error('Failed to create Stripe payment intent', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create Stripe payment intent'));
    }
  }

  async createStripeCheckoutSession(req, res) {
    try {
      const gatewayResult = await gatewayManager.initiatePayment({
        providerCode: 'stripe',
        amount: req.body.amount,
        currency: req.body.currency,
        description: req.body.description,
        metadata: req.body.metadata || {},
        customer: { email: req.body.customerEmail },
        paymentId: req.body.paymentId,
        returnUrl: req.body.successUrl,
        cancelUrl: req.body.cancelUrl,
        useCheckout: true
      });

      return res.status(201).json(createdResponse('Stripe checkout session created', {
        paymentId: req.body.paymentId || null,
        status: gatewayResult.status,
        amount: req.body.amount,
        currency: req.body.currency,
        provider: 'stripe',
        checkoutUrl: gatewayResult.paymentUrl,
        sessionId: gatewayResult.transactionId
      }));
    } catch (error) {
      logger.error('Failed to create Stripe checkout session', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create Stripe checkout session'));
    }
  }

  async createPayPalOrder(req, res) {
    try {
      const gatewayResult = await gatewayManager.initiatePayment({
        providerCode: 'paypal',
        amount: req.body.amount,
        currency: req.body.currency,
        description: req.body.description,
        metadata: req.body.metadata || {},
        customer: { email: req.body.customerEmail },
        returnUrl: req.body.returnUrl,
        cancelUrl: req.body.cancelUrl
      });

      return res.status(201).json(createdResponse('PayPal order created', {
        status: gatewayResult.status,
        amount: req.body.amount,
        currency: req.body.currency,
        provider: 'paypal',
        orderId: gatewayResult.transactionId,
        approvalUrl: gatewayResult.paymentUrl
      }));
    } catch (error) {
      logger.error('Failed to create PayPal order', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create PayPal order'));
    }
  }

  async capturePayPalOrder(req, res) {
    try {
      const provider = gatewayManager.getProvider('paypal');
      const capture = await provider.captureOrder(req.params.orderId);
      return res.status(200).json(successResponse('PayPal order captured', capture));
    } catch (error) {
      logger.error('Failed to capture PayPal order', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to capture PayPal order'));
    }
  }

  async handleStripeWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];
      const result = await paymentProcessingService.processWebhook('stripe', {
        rawBody: req.rawBody || req.body,
        signature,
        headers: req.headers
      });

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      return res.status(200).json({ success: true, processed: true });
    } catch (error) {
      logger.error('Stripe webhook failed', { error: error.message });
      return res.status(500).json(serverErrorResponse('Stripe webhook processing failed'));
    }
  }

  async handlePayPalWebhook(req, res) {
    try {
      const result = await paymentProcessingService.processWebhook('paypal', {
        headers: req.headers,
        body: req.body
      });

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      return res.status(200).json({ success: true, processed: true });
    } catch (error) {
      logger.error('PayPal webhook failed', { error: error.message });
      return res.status(500).json(serverErrorResponse('PayPal webhook processing failed'));
    }
  }

  async getPaymentServiceHealth(req, res) {
    try {
      const gateways = await paymentService.listPayments({ limit: 1, offset: 0 });
      return res.status(200).json(successResponse('Payment service health', {
        status: 'healthy',
        gatewaysChecked: Array.isArray(gateways)
      }));
    } catch (error) {
      logger.error('Failed to get payment service health', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get payment service health'));
    }
  }

  async listGateways(req, res) {
    try {
      const gateways = await paymentGatewayService.listGateways({ includeInactive: false });
      return res.status(200).json(successResponse('Payment gateways retrieved', gateways));
    } catch (error) {
      logger.error('Failed to list payment gateways', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list payment gateways'));
    }
  }
}

module.exports = new PaymentFlowController();
