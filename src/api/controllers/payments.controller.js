const paymentService = require('../../core/payments/payment.service');
const { 
  successResponse, 
  createdResponse, 
  paymentResponse,
  notFoundResponse,
  errorResponse,
  paymentErrorResponse,
  providerErrorResponse,
  refundResponse,
  invoiceResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Contrôleur pour les paiements
 * Gère les paiements multi-providers avec abstraction
 */
class PaymentsController {
  /**
   * Process a payment transaction
   */
  async processPayment(req, res) {
    try {
      const {
        amount,
        currency = 'EUR',
        paymentMethod,
        description,
        customerEmail,
        customerName,
        customerPhone,
        eventId,
        returnUrl,
        preferredGateways = [],
        metadata = {}
      } = req.body;
      
      logger.payment('Processing payment', {
        amount,
        currency,
        paymentMethod,
        eventId,
        userId: req.user?.id
      });

      const result = await paymentService.processPayment({
        userId: req.user?.id,
        eventId,
        amount,
        currency,
        paymentMethod,
        description,
        customerEmail,
        customerName,
        customerPhone,
        returnUrl,
        preferredGateways,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'PAYMENT_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Payment initiated successfully', result)
      );

    } catch (error) {
      logger.error('Payment processing failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Payment processing failed', error.message)
      );
    }
  }

  /**
   * Process template purchase payment
   */
  async purchaseTemplate(req, res) {
    try {
      const {
        templateId,
        designerId,
        amount,
        currency = 'EUR',
        paymentMethod,
        customerEmail,
        customerName,
        customerPhone,
        returnUrl,
        preferredGateways = [],
        metadata = {}
      } = req.body;
      
      logger.payment('Processing template purchase', {
        templateId,
        designerId,
        amount,
        currency,
        userId: req.user?.id
      });

      const result = await paymentService.processTemplatePurchase({
        userId: req.user?.id,
        templateId,
        designerId,
        amount,
        currency,
        paymentMethod,
        customerEmail,
        customerName,
        customerPhone,
        returnUrl,
        preferredGateways,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'TEMPLATE_PURCHASE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Template purchase initiated successfully', result)
      );

    } catch (error) {
      logger.error('Template purchase failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Template purchase failed', error.message)
      );
    }
  }

  /**
   * Handle webhook from payment providers
   */
  async handleWebhook(req, res) {
    try {
      const { gateway } = req.params;
      const signature = req.headers['stripe-signature'] || 
                        req.headers['paypal-transmission-sig'] || 
                        req.headers['x-cinetpay-signature'] ||
                        req.headers['authorization'];

      const webhookData = {
        payload: JSON.stringify(req.body),
        signature,
        secret: process.env[`${gateway.toUpperCase()}_WEBHOOK_SECRET`]
      };

      logger.payment('Processing webhook', {
        gateway,
        eventType: req.body.type || 'unknown'
      });

      const result = await paymentService.processWebhook(gateway, webhookData);

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Webhook processing failed', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Webhook processed successfully', result)
      );

    } catch (error) {
      logger.error('Webhook processing failed', {
        error: error.message,
        gateway: req.params.gateway
      });
      
      return res.status(500).json(
        errorResponse('Webhook processing failed', error.message)
      );
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(req, res) {
    try {
      const { transactionId } = req.params;
      
      logger.payment('Getting payment status', {
        transactionId,
        userId: req.user?.id
      });

      const result = await paymentService.getPaymentStatus(transactionId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Payment transaction not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Payment status retrieved', result)
      );

    } catch (error) {
      logger.error('Payment status retrieval failed', {
        error: error.message,
        transactionId: req.params.transactionId
      });
      
      return res.status(500).json(
        errorResponse('Payment status retrieval failed', error.message)
      );
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(req, res) {
    try {
      const { startDate, endDate, status } = req.query;
      
      logger.payment('Getting payment statistics', {
        userId: req.user?.id,
        startDate,
        endDate,
        status
      });

      const filters = {
        userId: req.user?.id,
        startDate,
        endDate,
        status
      };

      const statistics = await paymentService.getStatistics(filters);

      return res.status(200).json(
        successResponse('Payment statistics retrieved', statistics)
      );

    } catch (error) {
      logger.error('Payment statistics retrieval failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Payment statistics retrieval failed', error.message)
      );
    }
  }

  /**
   * Get available payment gateways
   */
  async getAvailableGateways(req, res) {
    try {
      const { amount, currency = 'EUR', country = 'FR' } = req.query;
      
      logger.payment('Getting available gateways', {
        amount,
        currency,
        country
      });

      // Return static gateways for now (since gateway manager might not be fully implemented)
      const availableGateways = [
        {
          code: 'stripe',
          name: 'Stripe',
          isActive: true,
          supportedCurrencies: ['EUR', 'USD', 'GBP'],
          supportedCountries: ['FR', 'US', 'GB', 'DE', 'ES', 'IT'],
          minAmount: 0.50,
          maxAmount: 100000.00
        },
        {
          code: 'cinetpay',
          name: 'CinetPay',
          isActive: true,
          supportedCurrencies: ['XOF', 'XAF', 'EUR', 'USD'],
          supportedCountries: ['CI', 'SN', 'ML', 'BF', 'NE', 'TG', 'BJ'],
          minAmount: 100.00,
          maxAmount: 1000000.00
        },
        {
          code: 'mtn_momo',
          name: 'MTN Mobile Money',
          isActive: true,
          supportedCurrencies: ['XOF', 'XAF', 'UGX', 'GHS'],
          supportedCountries: ['CI', 'CM', 'UG', 'GH', 'ZM', 'MW'],
          minAmount: 100.00,
          maxAmount: 500000.00
        }
      ];
      
      // Filter gateways based on criteria
      const suitableGateways = availableGateways.filter(gateway => {
        if (amount && (parseFloat(amount) < gateway.minAmount || parseFloat(amount) > gateway.maxAmount)) {
          return false;
        }
        if (currency && !gateway.supportedCurrencies.includes(currency)) {
          return false;
        }
        if (country && !gateway.supportedCountries.includes(country)) {
          return false;
        }
        return gateway.isActive;
      });

      return res.status(200).json(
        successResponse('Available gateways retrieved', {
          gateways: suitableGateways,
          criteria: { amount, currency, country }
        })
      );

    } catch (error) {
      logger.error('Available gateways retrieval failed', {
        error: error.message
      });
      
      return res.status(500).json(
        errorResponse('Available gateways retrieval failed', error.message)
      );
    }
  }
}

module.exports = new PaymentsController();
