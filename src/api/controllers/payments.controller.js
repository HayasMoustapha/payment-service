// Importation des modules nécessaires pour le contrôleur de paiements
const paymentService = require('../../core/payments/payment.service'); // Service principal de paiement
const { 
  successResponse, // Utilitaire pour les réponses de succès
  createdResponse, // Utilitaire pour les réponses de création
  paymentResponse, // Utilitaire pour les réponses de paiement
  notFoundResponse, // Utilitaire pour les réponses "non trouvé"
  errorResponse, // Utilitaire pour les réponses d'erreur
  paymentErrorResponse, // Utilitaire pour les erreurs de paiement
  providerErrorResponse, // Utilitaire pour les erreurs de fournisseur
  refundResponse, // Utilitaire pour les réponses de remboursement
  invoiceResponse // Utilitaire pour les réponses de facture
} = require('../../utils/response');
const logger = require('../../utils/logger'); // Utilitaire pour les logs

/**
 * Contrôleur Principal pour les Paiements
 * Ce contrôleur gère toutes les requêtes HTTP liées aux paiements
 * Il fait le lien entre les routes API et le service de paiement
 */
class PaymentsController {
  /**
   * Traite une transaction de paiement
   * C'est la méthode principale pour créer un nouveau paiement
   * @param {Object} req - Requête HTTP avec les données de paiement
   * @param {Object} res - Réponse HTTP à renvoyer au client
   */
  async processPayment(req, res) {
    try {
      // Extraction des données de paiement depuis le corps de la requête
      const {
        amount, // Montant du paiement en centimes
        currency = 'EUR', // Devise, EUR par défaut
        paymentMethod, // Méthode de paiement (carte, PayPal, etc.)
        description, // Description du paiement
        customerEmail, // Email du client
        customerName, // Nom du client
        customerPhone, // Téléphone du client
        eventId, // ID de l'événement concerné
        returnUrl, // URL de retour après paiement
        preferredGateways = [], // Passerelles de paiement préférées
        metadata = {} // Données additionnelles
      } = req.body;
      
      // LOG : Enregistre les informations du paiement pour le débogage
      logger.payment('Processing payment', {
        amount, // Montant
        currency, // Devise
        paymentMethod, // Méthode
        eventId, // Événement
        userId: req.body.userId || 'anonymous' // ID utilisateur ou anonyme
      });

      // APPEL DU SERVICE : Traite le paiement via le service de paiement
      const result = await paymentService.processPayment({
        userId: req.body.userId || 'anonymous', // ID utilisateur
        eventId, // ID événement
        amount, // Montant
        currency, // Devise
        paymentMethod, // Méthode de paiement
        description, // Description
        customerEmail, // Email client
        customerName, // Nom client
        customerPhone, // Téléphone client
        returnUrl, // URL retour
        preferredGateways, // Passerelles préférées
        metadata: {
          ...metadata, // Métadonnées existantes
          userId: req.body.userId || 'anonymous' // ID utilisateur
        }
      });

      // VÉRIFICATION : Si le paiement a échoué
      if (!result.success) {
        return res.status(400).json( // Code 400 = Bad Request
          paymentErrorResponse(result.error, 'PAYMENT_FAILED') // Erreur de paiement
        );
      }

      // SUCCÈS : Retourner la réponse de création
      return res.status(201).json( // Code 201 = Created
        createdResponse('Payment initiated successfully', result) // Paiement initié
      );

    } catch (error) {
      // GESTION DES ERREURS : Si quelque chose se passe mal
      logger.error('Payment processing failed', {
        error: error.message, // Message d'erreur
        userId: req.body.userId || 'anonymous' // ID utilisateur
      });
      
      // Retourner une erreur 500 = Internal Server Error
      return res.status(500).json(
        errorResponse('Payment processing failed', error.message) // Erreur de traitement
      );
    }
  }

  /**
   * Traite l'achat d'un template (design, modèle, etc.)
   * Similaire à processPayment mais spécifique aux templates
   * @param {Object} req - Requête HTTP avec les données d'achat
   * @param {Object} res - Réponse HTTP à renvoyer au client
   */
  async purchaseTemplate(req, res) {
    try {
      // Extraction des données d'achat de template
      const {
        templateId, // ID du template à acheter
        designerId, // ID du designer qui vend le template
        amount, // Montant de l'achat
        currency = 'EUR', // Devise
        paymentMethod, // Méthode de paiement
        customerEmail, // Email du client
        customerName, // Nom du client
        customerPhone, // Téléphone du client
        returnUrl, // URL de retour
        preferredGateways = [], // Passerelles préférées
        metadata = {} // Métadonnées
      } = req.body;
      
      // LOG : Enregistre les informations d'achat pour le débogage
      logger.payment('Processing template purchase', {
        templateId,
        designerId,
        amount,
        currency,
        userId: req.body.userId || 'anonymous'
      });

      const result = await paymentService.processTemplatePurchase({
        userId: req.body.userId || 'anonymous',
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
          userId: req.body.userId || 'anonymous'
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
        userId: req.body.userId || 'anonymous'
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
   * Get payment status
   */
  async getPaymentStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const { userId } = req.query;
      
      logger.payment('Getting payment status', {
        transactionId,
        userId: userId || 'anonymous'
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
