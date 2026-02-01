/**
 * 💳 CONTRÔLEUR PAIEMENTS
 * 
 * RÔLE : Contrôleur technique pour les opérations de paiement
 * UTILISATION : Interface entre routes HTTP et services de paiement
 * 
 * FONCTIONNEMENT :
 * - Reçoit les requêtes HTTP validées
 * - Délègue au service de paiement approprié
 * - Formate les réponses techniques
 * - Gère les erreurs de manière standardisée
 */

// Importation des services techniques
const paymentService = require('../../core/payments/payment.service'); // Service principal de paiement
const { 
  successResponse,     // Réponse succès standardisée
  createdResponse,     // Réponse création standardisée
  paymentResponse,     // Réponse paiement spécifique
  notFoundResponse,    // Réponse 404 standardisée
  errorResponse,       // Réponse erreur standardisée
  paymentErrorResponse, // Erreur paiement spécifique
  providerErrorResponse, // Erreur fournisseur spécifique
  refundResponse,      // Réponse remboursement spécifique
  invoiceResponse      // Réponse facture spécifique
} = require('../../utils/response');
const logger = require('../../utils/logger'); // Utilitaire de logging technique

/**
 * 🏗️ CLASSE CONTRÔLEUR PAIEMENTS
 * 
 * Gère toutes les requêtes HTTP liées aux paiements techniques
 * Fait le lien entre les routes API et les services de paiement
 */
class PaymentsController {
  /**
   * 🔄 TRAITER UN PAIEMENT
   * 
   * Méthode principale pour créer une nouvelle transaction de paiement
   * @param {Object} req - Requête HTTP avec données de paiement validées
   * @param {Object} res - Réponse HTTP technique
   */
  async processPayment(req, res) {
    try {
      // 📥 EXTRACTION DES DONNÉES TECHNIQUES
      const {
        amount,                    // Montant en centimes
        currency = 'EUR',          // Devise (EUR par défaut)
        gateway,                   // Passerelle (stripe, paypal, cinetpay)
        customerEmail,             // Email client (pour facturation)
        description,               // Description technique
        metadata = {}              // Métadonnées techniques
      } = req.body;
      
      // 📝 LOG TECHNIQUE : Traçabilité de la transaction
      logger.payment('Processing payment', {
        amount,
        currency,
        gateway,
        customerEmail,
        requestId: req.id,
        timestamp: new Date().toISOString()
      });

      // 🔄 APPEL DU SERVICE DE PAIEMENT
      const result = await paymentService.processPayment({
        amount,
        currency,
        gateway,
        customerEmail,
        description,
        metadata,
        requestId: req.id
      });

      // ✅ RÉPONSE TECHNIQUE SUCCÈS
      return createdResponse(res, result, 'Payment processed successfully', 'payment');

    } catch (error) {
      // 🚨 GESTION DES ERREURS TECHNIQUES
      logger.error('Payment processing failed', {
        error: error.message,
        stack: error.stack,
        requestId: req.id
      });

      return paymentErrorResponse(res, error);
    }
  }

  /**
   * 🎫 ACHETER UN TEMPLATE
   * 
   * Traite l'achat d'un template de manière technique
   * @param {Object} req - Requête HTTP avec données d'achat
   * @param {Object} res - Réponse HTTP technique
   */
  async purchaseTemplate(req, res) {
    try {
      const { templateId, customerEmail, paymentMethod, amount, currency = 'EUR' } = req.body;

      logger.payment('Processing template purchase', {
        templateId,
        customerEmail,
        paymentMethod,
        amount,
        requestId: req.id
      });

      const result = await paymentService.purchaseTemplate({
        templateId,
        customerEmail,
        paymentMethod,
        amount,
        currency,
        requestId: req.id
      });

      return createdResponse(res, result, 'Template purchased successfully', 'template_purchase');

    } catch (error) {
      logger.error('Template purchase failed', {
        error: error.message,
        templateId: req.body.templateId,
        requestId: req.id
      });

      return paymentErrorResponse(res, error);
    }
  }

  /**
   * 📊 STATUT PAIEMENT
   * 
   * Récupère le statut technique d'un paiement
   * @param {Object} req - Requête HTTP avec ID paiement
   * @param {Object} res - Réponse HTTP technique
   */
  async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;

      logger.payment('Getting payment status', {
        paymentId,
        requestId: req.id
      });

      const status = await paymentService.getPaymentStatus(paymentId);

      return successResponse(res, status, 'Payment status retrieved successfully');

    } catch (error) {
      logger.error('Failed to get payment status', {
        error: error.message,
        paymentId: req.params.paymentId,
        requestId: req.id
      });

      return errorResponse(res, error, 'Failed to get payment status');
    }
  }

  /**
   * 📋 LISTE PAIEMENTS
   * 
   * Récupère une liste technique de paiements
   * @param {Object} req - Requête HTTP avec filtres
   * @param {Object} res - Réponse HTTP technique
   */
  async getPayments(req, res) {
    try {
      const { customerId, status, gateway, limit = 20, offset = 0 } = req.query;

      logger.payment('Getting payments list', {
        customerId,
        status,
        gateway,
        limit,
        offset,
        requestId: req.id
      });

      const payments = await paymentService.getPayments({
        customerId,
        status,
        gateway,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, payments, 'Payments retrieved successfully');

    } catch (error) {
      logger.error('Failed to get payments', {
        error: error.message,
        query: req.query,
        requestId: req.id
      });

      return errorResponse(res, error, 'Failed to get payments');
    }
  }

  /**
   * 🔍 DÉTAIL PAIEMENT
   * 
   * Récupère les détails techniques d'un paiement
   * @param {Object} req - Requête HTTP avec ID paiement
   * @param {Object} res - Réponse HTTP technique
   */
  async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;

      logger.payment('Getting payment details', {
        paymentId,
        requestId: req.id
      });

      const details = await paymentService.getPaymentDetails(paymentId);

      return successResponse(res, details, 'Payment details retrieved successfully');

    } catch (error) {
      logger.error('Failed to get payment details', {
        error: error.message,
        paymentId: req.params.paymentId,
        requestId: req.id
      });

      return notFoundResponse(res, 'Payment not found');
    }
  }

  /**
   * ❌ ANNULER PAIEMENT
   * 
   * Annule un paiement en attente de manière technique
   * @param {Object} req - Requête HTTP avec données d'annulation
   * @param {Object} res - Réponse HTTP technique
   */
  async cancelPayment(req, res) {
    try {
      const { paymentId } = req.params;
      const { reason, refundAmount } = req.body;

      logger.payment('Cancelling payment', {
        paymentId,
        reason,
        refundAmount,
        requestId: req.id
      });

      const result = await paymentService.cancelPayment(paymentId, {
        reason,
        refundAmount
      });

      return successResponse(res, result, 'Payment cancelled successfully');

    } catch (error) {
      logger.error('Failed to cancel payment', {
        error: error.message,
        paymentId: req.params.paymentId,
        requestId: req.id
      });

      return errorResponse(res, error, 'Failed to cancel payment');
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

      // Mode mock - traiter le webhook sans dépendre des services externes
      const result = {
        success: true,
        processed: true,
        eventType: req.body.type || 'unknown',
        gateway: gateway,
        message: 'Webhook processed (mock mode)'
      };

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
   * Get payment statistics
   */
  async getPaymentStatistics(req, res) {
    try {
      const { startDate, endDate, status, userId } = req.query;
      
      logger.payment('Getting payment statistics', {
        userId: userId || 'anonymous',
        startDate,
        endDate,
        status
      });

      const filters = {
        userId: userId || 'anonymous',
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
        userId: req.query?.userId || 'anonymous'
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
