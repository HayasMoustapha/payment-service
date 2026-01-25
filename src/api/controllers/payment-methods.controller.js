const stripeService = require('../../core/stripe/stripe.service');
const { 
  successResponse, 
  createdResponse, 
  notFoundResponse,
  errorResponse,
  paymentErrorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Payment Methods Controller - Handles payment method operations
 */
class PaymentMethodsController {
  /**
   * Add Payment Method
   */
  async addPaymentMethod(req, res) {
    try {
      const {
        type,
        card,
        billing_details,
        isDefault = false
      } = req.body;

      logger.payment('Adding Payment Method', {
        type,
        billing_details: billing_details.email,
        isDefault,
        userId: req.user?.id
      });

      const result = await stripeService.createPaymentMethod({
        type,
        card,
        billing_details,
        isDefault,
        userId: req.user?.id
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'PAYMENT_METHOD_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Payment Method added successfully', result.paymentMethod)
      );

    } catch (error) {
      logger.error('Add Payment Method failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Add Payment Method failed', error.message)
      );
    }
  }

  /**
   * Get User Payment Methods
   */
  async getUserPaymentMethods(req, res) {
    try {
      const userId = req.user?.id;

      logger.payment('Getting User Payment Methods', {
        userId
      });

      const result = await stripeService.getUserPaymentMethods(userId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('User not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Payment Methods retrieved successfully', result.paymentMethods)
      );

    } catch (error) {
      logger.error('Get User Payment Methods failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Payment Methods failed', error.message)
      );
    }
  }

  /**
   * Update Payment Method
   */
  async updatePaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.params;
      const {
        isDefault,
        metadata
      } = req.body;

      logger.payment('Updating Payment Method', {
        paymentMethodId,
        isDefault,
        userId: req.user?.id
      });

      const result = await stripeService.updatePaymentMethod({
        paymentMethodId,
        isDefault,
        metadata,
        userId: req.user?.id
      });

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Payment Method not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Payment Method updated successfully', result.paymentMethod)
      );

    } catch (error) {
      logger.error('Update Payment Method failed', {
        error: error.message,
        paymentMethodId: req.params.paymentMethodId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Update Payment Method failed', error.message)
      );
    }
  }

  /**
   * Delete Payment Method
   */
  async deletePaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.params;

      logger.payment('Deleting Payment Method', {
        paymentMethodId,
        userId: req.user?.id
      });

      const result = await stripeService.deletePaymentMethod({
        paymentMethodId,
        userId: req.user?.id
      });

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Payment Method not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Payment Method deleted successfully', { deleted: true })
      );

    } catch (error) {
      logger.error('Delete Payment Method failed', {
        error: error.message,
        paymentMethodId: req.params.paymentMethodId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Delete Payment Method failed', error.message)
      );
    }
  }
}

module.exports = new PaymentMethodsController();
