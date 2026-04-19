const paymentMethodService = require('../../core/payment-methods/payment-method.service');
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  serverErrorResponse,
} = require('../../utils/response');
const logger = require('../../utils/logger');

class PaymentMethodsController {
  async list(req, res) {
    try {
      const paymentMethods = await paymentMethodService.listPaymentMethods({
        user_id: req.query.user_id ? Number(req.query.user_id) : undefined,
        provider_code: req.query.provider_code,
      });

      return res
        .status(200)
        .json(successResponse('Payment methods retrieved', paymentMethods));
    } catch (error) {
      logger.error('Failed to list payment methods', { error: error.message });
      return res
        .status(500)
        .json(serverErrorResponse('Failed to list payment methods'));
    }
  }

  async create(req, res) {
    try {
      const paymentMethod = await paymentMethodService.createPaymentMethod(req.body);
      return res
        .status(201)
        .json(createdResponse('Payment method created', paymentMethod));
    } catch (error) {
      logger.error('Failed to create payment method', { error: error.message });
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create payment method',
      });
    }
  }

  async update(req, res) {
    try {
      const paymentMethod = await paymentMethodService.updatePaymentMethod(
        Number(req.params.paymentMethodId),
        Number(req.body.user_id),
        req.body,
      );

      if (!paymentMethod) {
        return res
          .status(404)
          .json(notFoundResponse('Payment method', req.params.paymentMethodId));
      }

      return res
        .status(200)
        .json(successResponse('Payment method updated', paymentMethod));
    } catch (error) {
      logger.error('Failed to update payment method', { error: error.message });
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update payment method',
      });
    }
  }

  async delete(req, res) {
    try {
      const paymentMethod = await paymentMethodService.deletePaymentMethod(
        Number(req.params.paymentMethodId),
        Number(req.query.user_id),
      );

      if (!paymentMethod) {
        return res
          .status(404)
          .json(notFoundResponse('Payment method', req.params.paymentMethodId));
      }

      return res
        .status(200)
        .json(successResponse('Payment method deleted', paymentMethod));
    } catch (error) {
      logger.error('Failed to delete payment method', { error: error.message });
      return res
        .status(500)
        .json(serverErrorResponse('Failed to delete payment method'));
    }
  }
}

module.exports = new PaymentMethodsController();
