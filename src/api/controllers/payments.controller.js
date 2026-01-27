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

// Constante par défaut pour l'utilisateur ID
const DEFAULT_USER_ID = 1;

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

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await paymentService.processPayment({
        userId,
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
        metadata
      });
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.code)
        );
      }

      res.status(201).json(createdResponse('Paiement initié avec succès', result.data));
    } catch (error) {
      logger.error('Erreur traitement paiement:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Confirm a payment (webhook handler)
   */
  async confirmPayment(req, res) {
    try {
      const { paymentId, provider, status, metadata = {} } = req.body;
      
      if (!paymentId || !provider || !status) {
        return res.status(400).json(
          paymentErrorResponse('Payment ID, provider et status requis', 'MISSING_REQUIRED_FIELDS')
        );
      }

      const result = await paymentService.confirmPayment(paymentId, provider, status, metadata);
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.code)
        );
      }

      res.json(successResponse('Paiement confirmé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur confirmation paiement:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;
      
      if (!paymentId) {
        return res.status(400).json(
          paymentErrorResponse('Payment ID requis', 'MISSING_PAYMENT_ID')
        );
      }

      const result = await paymentService.getPaymentStatus(paymentId);
      
      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Paiement non trouvé', result.error)
        );
      }

      res.json(paymentResponse('Statut du paiement récupéré', result.data));
    } catch (error) {
      logger.error('Erreur récupération statut paiement:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Get payment details
   */
  async getPayment(req, res) {
    try {
      const { paymentId } = req.params;
      
      if (!paymentId) {
        return res.status(400).json(
          paymentErrorResponse('Payment ID requis', 'MISSING_PAYMENT_ID')
        );
      }

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await paymentService.getPayment(paymentId, userId);
      
      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Paiement non trouvé', result.error)
        );
      }

      res.json(paymentResponse('Paiement récupéré', result.data));
    } catch (error) {
      logger.error('Erreur récupération paiement:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * List payments for a user
   */
  async listPayments(req, res) {
    try {
      const { page = 1, limit = 20, status, eventId, startDate, endDate } = req.query;
      
      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        eventId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId
      };

      const result = await paymentService.listPayments(options);
      
      if (!result.success) {
        return res.status(400).json(
          errorResponse(result.error)
        );
      }

      res.json(paymentResponse('Paiements récupérés', result.data));
    } catch (error) {
      logger.error('Erreur liste paiements:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(req, res) {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      
      if (!paymentId) {
        return res.status(400).json(
          paymentErrorResponse('Payment ID requis', 'MISSING_PAYMENT_ID')
        );
      }

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await paymentService.cancelPayment(paymentId, userId, reason);
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.code)
        );
      }

      res.json(paymentResponse('Paiement annulé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur annulation paiement:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Retry a failed payment
   */
  async retryPayment(req, res) {
    try {
      const { paymentId } = req.params;
      
      if (!paymentId) {
        return res.status(400).json(
          paymentErrorResponse('Payment ID requis', 'MISSING_PAYMENT_ID')
        );
      }

      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const result = await paymentService.retryPayment(paymentId, userId);
      
      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.code)
        );
      }

      res.json(paymentResponse('Paiement relancé avec succès', result.data));
    } catch (error) {
      logger.error('Erreur relance paiement:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(req, res) {
    try {
      const { eventId, period = 'day' } = req.query;
      
      // Utilisation de l'utilisateur par défaut
      const userId = DEFAULT_USER_ID;

      const stats = await paymentService.getPaymentStats(userId, eventId, period);
      
      if (!stats.success) {
        return res.status(400).json(
          errorResponse(stats.error)
        );
      }

      res.json(paymentResponse('Statistiques récupérées', stats.data));
    } catch (error) {
      logger.error('Erreur statistiques paiements:', error);
      res.status(500).json(errorResponse('Erreur interne du serveur'));
    }
  }
}

module.exports = new PaymentsController();
