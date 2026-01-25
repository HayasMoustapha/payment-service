const stripeService = require('../../core/stripe/stripe.service');
const paypalService = require('../../core/paypal/paypal.service');
const { 
  successResponse, 
  createdResponse, 
  notFoundResponse,
  errorResponse,
  paymentErrorResponse,
  refundResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Refunds Controller - Handles refund operations for all providers
 */
class RefundsController {
  /**
   * Create a Stripe Refund
   */
  async createStripeRefund(req, res) {
    try {
      const {
        paymentIntentId,
        amount,
        reason = 'requested_by_customer',
        metadata = {}
      } = req.body;

      logger.payment('Creating Stripe Refund', {
        paymentIntentId,
        amount,
        reason,
        userId: req.user?.id
      });

      const result = await stripeService.createRefund({
        paymentIntentId,
        amount,
        reason,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_REFUND_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Stripe Refund created successfully', result.refund)
      );

    } catch (error) {
      logger.error('Stripe Refund creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Stripe Refund creation failed', error.message)
      );
    }
  }

  /**
   * Create a PayPal Refund
   */
  async createPayPalRefund(req, res) {
    try {
      const {
        captureId,
        amount,
        reason = 'Customer requested refund'
      } = req.body;

      logger.payment('Creating PayPal Refund', {
        captureId,
        amount,
        reason,
        userId: req.user?.id
      });

      const result = await paypalService.createRefund({
        captureId,
        amount,
        reason
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'PAYPAL_REFUND_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('PayPal Refund created successfully', result.refund)
      );

    } catch (error) {
      logger.error('PayPal Refund creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('PayPal Refund creation failed', error.message)
      );
    }
  }

  /**
   * Get Refund Status
   */
  async getRefundStatus(req, res) {
    try {
      const { refundId } = req.params;

      logger.payment('Getting Refund Status', {
        refundId,
        userId: req.user?.id
      });

      // Try to get refund from both providers
      let result = await stripeService.getRefund(refundId);
      
      if (!result.success) {
        result = await paypalService.getRefund(refundId);
      }

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Refund not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Refund retrieved successfully', result.refund)
      );

    } catch (error) {
      logger.error('Get Refund Status failed', {
        error: error.message,
        refundId: req.params.refundId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Refund Status failed', error.message)
      );
    }
  }

  /**
   * List Refunds
   */
  async listRefunds(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        provider,
        status
      } = req.query;

      logger.payment('Listing Refunds', {
        page,
        limit,
        provider,
        status,
        userId: req.user?.id
      });

      // Get refunds from Stripe
      const stripeResult = await stripeService.listRefunds({
        page,
        limit,
        status
      });

      // Get refunds from PayPal
      const paypalResult = await paypalService.listRefunds({
        page,
        limit,
        status
      });

      const refunds = [];

      if (stripeResult.success) {
        refunds.push(...stripeResult.refunds.map(r => ({ ...r, provider: 'stripe' })));
      }

      if (paypalResult.success) {
        refunds.push(...paypalResult.refunds.map(r => ({ ...r, provider: 'paypal' })));
      }

      // Filter by provider if specified
      const filteredRefunds = provider 
        ? refunds.filter(r => r.provider === provider)
        : refunds;

      return res.status(200).json(
        successResponse('Refunds retrieved successfully', {
          refunds: filteredRefunds,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredRefunds.length
          }
        })
      );

    } catch (error) {
      logger.error('List Refunds failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('List Refunds failed', error.message)
      );
    }
  }
}

module.exports = new RefundsController();
