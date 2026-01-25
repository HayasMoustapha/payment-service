const paypalService = require('../../core/paypal/paypal.service');
const { 
  successResponse, 
  createdResponse, 
  notFoundResponse,
  errorResponse,
  paymentErrorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * PayPal Controller - Handles PayPal-specific payment operations
 */
class PayPalController {
  /**
   * Create a PayPal Order
   */
  async createOrder(req, res) {
    try {
      const {
        amount,
        description,
        returnUrl,
        cancelUrl,
        metadata = {}
      } = req.body;

      logger.payment('Creating PayPal Order', {
        amount,
        description,
        userId: req.user?.id
      });

      const result = await paypalService.createOrder({
        amount,
        description,
        returnUrl,
        cancelUrl,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'PAYPAL_ORDER_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('PayPal Order created successfully', result.order)
      );

    } catch (error) {
      logger.error('PayPal Order creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('PayPal Order creation failed', error.message)
      );
    }
  }

  /**
   * Get a PayPal Order
   */
  async getOrder(req, res) {
    try {
      const { orderId } = req.params;

      logger.payment('Getting PayPal Order', {
        orderId,
        userId: req.user?.id
      });

      const result = await paypalService.getOrder(orderId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Order not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Order retrieved successfully', result.order)
      );

    } catch (error) {
      logger.error('Get PayPal Order failed', {
        error: error.message,
        orderId: req.params.orderId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Order failed', error.message)
      );
    }
  }

  /**
   * Capture a PayPal Order
   */
  async captureOrder(req, res) {
    try {
      const { orderId } = req.params;

      logger.payment('Capturing PayPal Order', {
        orderId,
        userId: req.user?.id
      });

      const result = await paypalService.captureOrder(orderId);

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'PAYPAL_ORDER_CAPTURE_FAILED')
        );
      }

      return res.status(200).json(
        successResponse('Order captured successfully', result.order)
      );

    } catch (error) {
      logger.error('PayPal Order capture failed', {
        error: error.message,
        orderId: req.params.orderId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Order capture failed', error.message)
      );
    }
  }

  /**
   * Create a PayPal Invoice
   */
  async createInvoice(req, res) {
    try {
      const {
        amount,
        description,
        merchantInfo,
        billingInfo
      } = req.body;

      logger.payment('Creating PayPal Invoice', {
        amount,
        description,
        userId: req.user?.id
      });

      const result = await paypalService.createInvoice({
        amount,
        description,
        merchantInfo,
        billingInfo,
        metadata: {
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'PAYPAL_INVOICE_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('PayPal Invoice created successfully', result.invoice)
      );

    } catch (error) {
      logger.error('PayPal Invoice creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('PayPal Invoice creation failed', error.message)
      );
    }
  }

  /**
   * Get a PayPal Invoice
   */
  async getInvoice(req, res) {
    try {
      const { invoiceId } = req.params;

      logger.payment('Getting PayPal Invoice', {
        invoiceId,
        userId: req.user?.id
      });

      const result = await paypalService.getInvoice(invoiceId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Invoice not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Invoice retrieved successfully', result.invoice)
      );

    } catch (error) {
      logger.error('Get PayPal Invoice failed', {
        error: error.message,
        invoiceId: req.params.invoiceId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Invoice failed', error.message)
      );
    }
  }
}

module.exports = new PayPalController();
