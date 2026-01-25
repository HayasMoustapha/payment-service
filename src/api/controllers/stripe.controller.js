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
 * Stripe Controller - Handles Stripe-specific payment operations
 */
class StripeController {
  /**
   * Create a Stripe Payment Intent
   */
  async createPaymentIntent(req, res) {
    try {
      const {
        amount,
        currency = 'eur',
        customerEmail,
        description,
        metadata = {}
      } = req.body;

      logger.payment('Creating Stripe Payment Intent', {
        amount,
        currency,
        customerEmail,
        userId: req.user?.id
      });

      const result = await stripeService.createPaymentIntent({
        amount,
        currency,
        customerEmail,
        description,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_PAYMENT_INTENT_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Stripe Payment Intent created successfully', result.paymentIntent)
      );

    } catch (error) {
      logger.error('Stripe Payment Intent creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Stripe Payment Intent creation failed', error.message)
      );
    }
  }

  /**
   * Get a Stripe Payment Intent
   */
  async getPaymentIntent(req, res) {
    try {
      const { paymentIntentId } = req.params;

      logger.payment('Getting Stripe Payment Intent', {
        paymentIntentId,
        userId: req.user?.id
      });

      const result = await stripeService.getPaymentIntent(paymentIntentId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Payment Intent not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Payment Intent retrieved successfully', result.paymentIntent)
      );

    } catch (error) {
      logger.error('Get Stripe Payment Intent failed', {
        error: error.message,
        paymentIntentId: req.params.paymentIntentId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Payment Intent failed', error.message)
      );
    }
  }

  /**
   * Confirm a Stripe Payment Intent
   */
  async confirmPaymentIntent(req, res) {
    try {
      const {
        paymentIntentId,
        paymentMethodId
      } = req.body;

      logger.payment('Confirming Stripe Payment Intent', {
        paymentIntentId,
        paymentMethodId,
        userId: req.user?.id
      });

      const result = await stripeService.confirmPaymentIntent(paymentIntentId, paymentMethodId);

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_PAYMENT_CONFIRM_FAILED')
        );
      }

      return res.status(200).json(
        successResponse('Payment confirmed successfully', result.paymentIntent)
      );

    } catch (error) {
      logger.error('Stripe Payment confirmation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Payment confirmation failed', error.message)
      );
    }
  }

  /**
   * Create a Stripe Customer
   */
  async createCustomer(req, res) {
    try {
      const {
        email,
        name,
        phone
      } = req.body;

      logger.payment('Creating Stripe Customer', {
        email,
        name,
        userId: req.user?.id
      });

      const result = await stripeService.createCustomer({
        email,
        name,
        phone,
        metadata: {
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_CUSTOMER_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Stripe Customer created successfully', result.customer)
      );

    } catch (error) {
      logger.error('Stripe Customer creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Customer creation failed', error.message)
      );
    }
  }

  /**
   * Get a Stripe Customer
   */
  async getCustomer(req, res) {
    try {
      const { customerId } = req.params;

      logger.payment('Getting Stripe Customer', {
        customerId,
        userId: req.user?.id
      });

      const result = await stripeService.getCustomer(customerId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Customer not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Customer retrieved successfully', result.customer)
      );

    } catch (error) {
      logger.error('Get Stripe Customer failed', {
        error: error.message,
        customerId: req.params.customerId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Customer failed', error.message)
      );
    }
  }

  /**
   * Create a Stripe Payment Method
   */
  async createPaymentMethod(req, res) {
    try {
      const {
        customerId,
        paymentMethodId,
        isDefault = false
      } = req.body;

      logger.payment('Creating Stripe Payment Method', {
        customerId,
        paymentMethodId,
        isDefault,
        userId: req.user?.id
      });

      const result = await stripeService.createPaymentMethod({
        customerId,
        paymentMethodId,
        isDefault
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_PAYMENT_METHOD_CREATE_FAILED')
        );
      }

      return res.status(201).json(
        createdResponse('Payment Method created successfully', result.paymentMethod)
      );

    } catch (error) {
      logger.error('Stripe Payment Method creation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Payment Method creation failed', error.message)
      );
    }
  }

  /**
   * Get Customer Payment Methods
   */
  async getCustomerPaymentMethods(req, res) {
    try {
      const { customerId } = req.params;

      logger.payment('Getting Stripe Customer Payment Methods', {
        customerId,
        userId: req.user?.id
      });

      const result = await stripeService.getCustomerPaymentMethods(customerId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Customer not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Payment Methods retrieved successfully', result.paymentMethods)
      );

    } catch (error) {
      logger.error('Get Stripe Payment Methods failed', {
        error: error.message,
        customerId: req.params.customerId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Payment Methods failed', error.message)
      );
    }
  }
}

module.exports = new StripeController();
