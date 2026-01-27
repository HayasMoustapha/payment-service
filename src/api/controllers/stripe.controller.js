const stripeService = require('../../core/stripe/stripe.service');
const { 
  successResponse, 
  createdResponse, 
  notFoundResponse,
  errorResponse,
  paymentErrorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

// Constante par défaut pour l'utilisateur ID
const DEFAULT_USER_ID = 1;

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

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await stripeService.createPaymentIntent({
        amount,
        currency,
        customerEmail,
        description,
        metadata: {
          ...metadata,
          userId
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_PAYMENT_INTENT_FAILED')
        );
      }

      res.status(201).json(createdResponse('Payment Intent créé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur création Payment Intent:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Confirm a Stripe Payment Intent
   */
  async confirmPaymentIntent(req, res) {
    try {
      const { paymentIntentId } = req.params;
      
      if (!paymentIntentId) {
        return res.status(400).json(
          paymentErrorResponse('Payment Intent ID requis', 'MISSING_PAYMENT_INTENT_ID')
        );
      }

      const result = await stripeService.confirmPaymentIntent(paymentIntentId);
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_CONFIRM_FAILED')
        );
      }

      res.json(successResponse('Payment Intent confirmé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur confirmation Payment Intent:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Create a Stripe Checkout Session
   */
  async createCheckoutSession(req, res) {
    try {
      const {
        amount,
        currency = 'eur',
        customerEmail,
        successUrl,
        cancelUrl,
        metadata = {}
      } = req.body;

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await stripeService.createCheckoutSession({
        amount,
        currency,
        customerEmail,
        successUrl,
        cancelUrl,
        metadata: {
          ...metadata,
          userId
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_CHECKOUT_FAILED')
        );
      }

      res.status(201).json(createdResponse('Checkout Session créée avec succès', result.data));
    } catch (error) {
      logger.error('Erreur création Checkout Session:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Get Payment Intent details
   */
  async getPaymentIntent(req, res) {
    try {
      const { paymentIntentId } = req.params;
      
      if (!paymentIntentId) {
        return res.status(400).json(
          paymentErrorResponse('Payment Intent ID requis', 'MISSING_PAYMENT_INTENT_ID')
        );
      }

      const result = await stripeService.getPaymentIntent(paymentIntentId);
      
      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Payment Intent non trouvé', result.error)
        );
      }

      res.json(successResponse('Payment Intent récupéré', result.data));
    } catch (error) {
      logger.error('Erreur récupération Payment Intent:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
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
        phone,
        metadata = {}
      } = req.body;

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await stripeService.createCustomer({
        email,
        name,
        phone,
        metadata: {
          ...metadata,
          userId
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_CUSTOMER_FAILED')
        );
      }

      res.status(201).json(createdResponse('Customer créé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur création Customer:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Get Customer details
   */
  async getCustomer(req, res) {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json(
          paymentErrorResponse('Customer ID requis', 'MISSING_CUSTOMER_ID')
        );
      }

      const result = await stripeService.getCustomer(customerId);
      
      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Customer non trouvé', result.error)
        );
      }

      res.json(successResponse('Customer récupéré', result.data));
    } catch (error) {
      logger.error('Erreur récupération Customer:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Create a payment method
   */
  async createPaymentMethod(req, res) {
    try {
      const {
        type,
        card,
        billingDetails,
        metadata = {}
      } = req.body;

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await stripeService.createPaymentMethod({
        type,
        card,
        billingDetails,
        metadata: {
          ...metadata,
          userId
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_PAYMENT_METHOD_FAILED')
        );
      }

      res.status(201).json(createdResponse('Payment Method créé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur création Payment Method:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(req, res) {
    try {
      const { paymentMethodId, customerId } = req.body;
      
      if (!paymentMethodId || !customerId) {
        return res.status(400).json(
          paymentErrorResponse('Payment Method ID et Customer ID requis', 'MISSING_REQUIRED_FIELDS')
        );
      }

      const result = await stripeService.attachPaymentMethod(paymentMethodId, customerId);
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_ATTACH_FAILED')
        );
      }

      res.json(successResponse('Payment Method attaché avec succès', result.data));
    } catch (error) {
      logger.error('Erreur attach Payment Method:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Process webhook from Stripe
   */
  async processWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];
      const payload = req.body;
      
      if (!signature) {
        return res.status(400).json(
          paymentErrorResponse('Signature Stripe manquante', 'MISSING_STRIPE_SIGNATURE')
        );
      }

      const result = await stripeService.processWebhook(payload, signature);
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, 'STRIPE_WEBHOOK_FAILED')
        );
      }

      res.json(successResponse('Webhook traité avec succès', result.data));
    } catch (error) {
      logger.error('Erreur traitement webhook Stripe:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }
}

module.exports = new StripeController();
