const stripeService = require('../stripe/stripe.service');
const paypalService = require('../paypal/paypal.service');
const invoiceService = require('../invoices/invoice.service');
const logger = require('../../utils/logger');

/**
 * Service de gestion des remboursements
 * Gère les remboursements Stripe et PayPal avec validation et suivi
 */
class RefundService {
  constructor() {
    this.refundWindowDays = parseInt(process.env.REFUND_WINDOW_DAYS) || 30;
    this.minRefundAmount = parseInt(process.env.MIN_AMOUNT) || 100; // 1€ en centimes
    this.maxRefundAmount = parseInt(process.env.MAX_AMOUNT) || 1000000; // 10000€ en centimes
  }

  /**
   * Crée un remboursement
   * @param {Object} refundData - Données du remboursement
   * @returns {Promise<Object>} Remboursement créé
   */
  async createRefund(refundData) {
    try {
      const {
        paymentId,
        paymentProvider,
        amount,
        reason = 'requested_by_customer',
        metadata = {},
        userId
      } = refundData;

      // Validation des données
      const validation = this.validateRefundData(refundData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          type: 'VALIDATION_FAILED'
        };
      }

      // Vérifier la fenêtre de remboursement
      const windowCheck = await this.checkRefundWindow(paymentId, paymentProvider);
      if (!windowCheck.withinWindow) {
        return {
          success: false,
          error: `La période de remboursement de ${this.refundWindowDays} jours est expirée`,
          type: 'REFUND_WINDOW_EXPIRED'
        };
      }

      let refundResult;

      // Traiter selon le provider
      switch (paymentProvider) {
        case 'stripe':
          refundResult = await this.createStripeRefund(paymentId, amount, reason, metadata);
          break;
        case 'paypal':
          refundResult = await this.createPayPalRefund(paymentId, amount, reason, metadata);
          break;
        default:
          return {
            success: false,
            error: 'Provider de paiement non supporté',
            type: 'UNSUPPORTED_PROVIDER'
          };
      }

      if (!refundResult.success) {
        return refundResult;
      }

      // Créer l'enregistrement de remboursement
      const refund = {
        id: refundResult.refund.id,
        paymentId,
        paymentProvider,
        amount: amount || refundResult.refund.amount,
        status: refundResult.refund.status,
        reason,
        metadata: {
          ...metadata,
          userId,
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString()
      };

      logger.refund('Refund created', {
        refundId: refund.id,
        paymentId,
        paymentProvider,
        amount: refund.amount / 100,
        reason,
        userId
      });

      return {
        success: true,
        refund
      };
    } catch (error) {
      logger.error('Failed to create refund', {
        error: error.message,
        paymentId: refundData.paymentId,
        paymentProvider: refundData.paymentProvider
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_CREATION_FAILED'
      };
    }
  }

  /**
   * Crée un remboursement Stripe
   * @param {string} paymentIntentId - ID du Payment Intent
   * @param {number} amount - Montant à rembourser
   * @param {string} reason - Raison du remboursement
   * @param {Object} metadata - Métadonnées
   * @returns {Promise<Object>} Résultat du remboursement
   */
  async createStripeRefund(paymentIntentId, amount, reason, metadata) {
    try {
      // Récupérer le Payment Intent pour obtenir le charge ID
      const paymentIntentResult = await stripeService.getPaymentIntent(paymentIntentId);
      if (!paymentIntentResult.success) {
        return {
          success: false,
          error: 'Payment Intent non trouvé',
          type: 'PAYMENT_INTENT_NOT_FOUND'
        };
      }

      const paymentIntent = paymentIntentResult.paymentIntent;
      
      if (!paymentIntent.charges || paymentIntent.charges.length === 0) {
        return {
          success: false,
          error: 'Aucun paiement trouvé pour ce Payment Intent',
          type: 'NO_CHARGE_FOUND'
        };
      }

      const chargeId = paymentIntent.charges[0].id;

      // Créer le remboursement
      const refundParams = {
        charge: chargeId,
        reason: this.mapRefundReason(reason),
        metadata: {
          service: 'event-planner',
          ...metadata
        }
      };

      // Ajouter le montant si spécifié (remboursement partiel)
      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await stripeService.stripe.refunds.create(refundParams);

      logger.refund('Stripe refund created', {
        refundId: refund.id,
        chargeId,
        amount: refund.amount / 100,
        status: refund.status
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          receiptNumber: refund.receipt_number,
          created: refund.created
        }
      };
    } catch (error) {
      logger.error('Failed to create Stripe refund', {
        error: error.message,
        paymentIntentId
      });

      return {
        success: false,
        error: error.message,
        type: 'STRIPE_REFUND_FAILED'
      };
    }
  }

  /**
   * Crée un remboursement PayPal
   * @param {string} captureId - ID de la capture
   * @param {number} amount - Montant à rembourser
   * @param {string} reason - Raison du remboursement
   * @param {Object} metadata - Métadonnées
   * @returns {Promise<Object>} Résultat du remboursement
   */
  async createPayPalRefund(captureId, amount, reason, metadata) {
    try {
      const refundData = {
        reason: this.mapRefundReason(reason)
      };

      // Ajouter le montant si spécifié (remboursement partiel)
      if (amount) {
        refundData.amount = amount;
      }

      const refundResult = await paypalService.createRefund(captureId, refundData);

      if (!refundResult.success) {
        return refundResult;
      }

      logger.refund('PayPal refund created', {
        refundId: refundResult.refund.id,
        captureId,
        amount: refundResult.refund.amount ? refundResult.refund.amount.value : 'full',
        status: refundResult.refund.status
      });

      return {
        success: true,
        refund: {
          id: refundResult.refund.id,
          amount: refundResult.refund.amount ? 
            Math.round(parseFloat(refundResult.refund.amount.value) * 100) : null,
          currency: refundResult.refund.amount?.currency_code || 'EUR',
          status: refundResult.refund.status,
          created: new Date(refundResult.refund.create_time).getTime()
        }
      };
    } catch (error) {
      logger.error('Failed to create PayPal refund', {
        error: error.message,
        captureId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYPAL_REFUND_FAILED'
      };
    }
  }

  /**
   * Récupère les détails d'un remboursement
   * @param {string} refundId - ID du remboursement
   * @param {string} paymentProvider - Provider de paiement
   * @returns {Promise<Object>} Détails du remboursement
   */
  async getRefund(refundId, paymentProvider) {
    try {
      let refundResult;

      switch (paymentProvider) {
        case 'stripe':
          refundResult = await this.getStripeRefund(refundId);
          break;
        case 'paypal':
          refundResult = await this.getPayPalRefund(refundId);
          break;
        default:
          return {
            success: false,
            error: 'Provider de paiement non supporté',
            type: 'UNSUPPORTED_PROVIDER'
          };
      }

      return refundResult;
    } catch (error) {
      logger.error('Failed to retrieve refund', {
        error: error.message,
        refundId,
        paymentProvider
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Récupère un remboursement Stripe
   * @param {string} refundId - ID du remboursement
   * @returns {Promise<Object>} Remboursement Stripe
   */
  async getStripeRefund(refundId) {
    try {
      const refund = await stripeService.stripe.refunds.retrieve(refundId);

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          receiptNumber: refund.receipt_number,
          chargeId: refund.charge,
          paymentIntentId: refund.payment_intent,
          metadata: refund.metadata,
          created: refund.created
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve Stripe refund', {
        error: error.message,
        refundId
      });

      return {
        success: false,
        error: error.message,
        type: 'STRIPE_REFUND_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Récupère un remboursement PayPal
   * @param {string} refundId - ID du remboursement
   * @returns {Promise<Object>} Remboursement PayPal
   */
  async getPayPalRefund(refundId) {
    try {
      const refundResult = await paypalService.getRefund(refundId);

      if (!refundResult.success) {
        return refundResult;
      }

      const refund = refundResult.refund;

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount ? 
            Math.round(parseFloat(refund.amount.value) * 100) : null,
          currency: refund.amount?.currency_code || 'EUR',
          status: refund.status,
          created: new Date(refund.create_time).getTime(),
          updated: new Date(refund.update_time).getTime()
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve PayPal refund', {
        error: error.message,
        refundId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYPAL_REFUND_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Liste les remboursements d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options de pagination
   * @returns {Promise<Object>} Liste des remboursements
   */
  async listUserRefunds(userId, options = {}) {
    try {
      // Pour l'instant, retourne une liste vide car nous n'avons pas de base de données
      // Dans une implémentation complète, cela interrogerait la base de données
      
      return {
        success: true,
        refunds: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 10
      };
    } catch (error) {
      logger.error('Failed to list user refunds', {
        error: error.message,
        userId
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUNDS_LIST_FAILED'
      };
    }
  }

  /**
   * Annule un remboursement (si possible)
   * @param {string} refundId - ID du remboursement
   * @param {string} paymentProvider - Provider de paiement
   * @returns {Promise<Object>} Résultat de l'annulation
   */
  async cancelRefund(refundId, paymentProvider) {
    try {
      // Note: La plupart des providers n'autorisent pas l'annulation des remboursements
      // Une fois qu'un remboursement est initié, il ne peut généralement pas être annulé
      
      logger.refund('Refund cancellation attempted', {
        refundId,
        paymentProvider,
        note: 'Refund cancellation not supported by most providers'
      });

      return {
        success: false,
        error: 'L\'annulation des remboursements n\'est pas supportée',
        type: 'REFUND_CANCELLATION_NOT_SUPPORTED'
      };
    } catch (error) {
      logger.error('Failed to cancel refund', {
        error: error.message,
        refundId,
        paymentProvider
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_CANCELLATION_FAILED'
      };
    }
  }

  /**
   * Calcule les statistiques de remboursement
   * @param {Object} filters - Filtres pour les statistiques
   * @returns {Promise<Object>} Statistiques
   */
  async getRefundStats(filters = {}) {
    try {
      // Pour l'instant, retourne des statistiques vides car nous n'avons pas de base de données
      // Dans une implémentation complète, cela calculerait les statistiques réelles
      
      return {
        success: true,
        stats: {
          totalRefunds: 0,
          totalAmount: 0,
          averageRefundAmount: 0,
          refundsByProvider: {
            stripe: 0,
            paypal: 0
          },
          refundsByReason: {},
          refundsByStatus: {
            pending: 0,
            succeeded: 0,
            failed: 0,
            cancelled: 0
          },
          period: {
            startDate: filters.startDate || null,
            endDate: filters.endDate || null
          }
        }
      };
    } catch (error) {
      logger.error('Failed to get refund stats', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_STATS_FAILED'
      };
    }
  }

  /**
   * Vérifie la fenêtre de remboursement
   * @param {string} paymentId - ID du paiement
   * @param {string} paymentProvider - Provider de paiement
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async checkRefundWindow(paymentId, paymentProvider) {
    try {
      let paymentDate;

      switch (paymentProvider) {
        case 'stripe':
          const paymentResult = await stripeService.getPaymentIntent(paymentId);
          if (paymentResult.success) {
            paymentDate = new Date(paymentResult.paymentIntent.created * 1000);
          }
          break;
        case 'paypal':
          // Pour PayPal, on aurait besoin de récupérer l'ordre ou la capture
          // Pour l'instant, on utilise une date par défaut
          paymentDate = new Date();
          break;
      }

      if (!paymentDate) {
        return {
          withinWindow: false,
          error: 'Impossible de déterminer la date du paiement'
        };
      }

      const now = new Date();
      const daysSincePayment = Math.floor((now - paymentDate) / (1000 * 60 * 60 * 24));
      const withinWindow = daysSincePayment <= this.refundWindowDays;

      return {
        withinWindow,
        daysSincePayment,
        refundWindowDays: this.refundWindowDays,
        paymentDate: paymentDate.toISOString()
      };
    } catch (error) {
      logger.error('Failed to check refund window', {
        error: error.message,
        paymentId,
        paymentProvider
      });

      return {
        withinWindow: false,
        error: error.message
      };
    }
  }

  /**
   * Valide les données de remboursement
   * @param {Object} refundData - Données du remboursement
   * @returns {Object} Résultat de la validation
   */
  validateRefundData(refundData) {
    const { paymentId, paymentProvider, amount } = refundData;

    if (!paymentId) {
      return {
        valid: false,
        error: 'L\'ID du paiement est requis'
      };
    }

    if (!paymentProvider || !['stripe', 'paypal'].includes(paymentProvider)) {
      return {
        valid: false,
        error: 'Le provider de paiement doit être stripe ou paypal'
      };
    }

    if (amount && (amount < this.minRefundAmount || amount > this.maxRefundAmount)) {
      return {
        valid: false,
        error: `Le montant doit être entre ${this.minRefundAmount/100}€ et ${this.maxRefundAmount/100}€`
      };
    }

    return {
      valid: true
    };
  }

  /**
   * Mappe la raison du remboursement vers le format du provider
   * @param {string} reason - Raison du remboursement
   * @returns {string} Raison mappée
   */
  mapRefundReason(reason) {
    const reasonMap = {
      'requested_by_customer': 'requested_by_customer',
      'duplicate': 'duplicate',
      'fraudulent': 'fraudulent',
      'requested_by_customer': 'requested_by_customer'
    };

    return reasonMap[reason] || 'requested_by_customer';
  }

  /**
   * Vérifie la santé du service de remboursement
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      const [stripeHealth, paypalHealth] = await Promise.all([
        stripeService.healthCheck(),
        paypalService.healthCheck()
      ]);

      const overallHealthy = stripeHealth.healthy || paypalHealth.healthy;

      return {
        success: true,
        healthy: overallHealthy,
        providers: {
          stripe: stripeHealth.healthy,
          paypal: paypalHealth.healthy
        },
        config: {
          refundWindowDays: this.refundWindowDays,
          minRefundAmount: this.minRefundAmount,
          maxRefundAmount: this.maxRefundAmount
        }
      };
    } catch (error) {
      logger.error('Refund service health check failed', {
        error: error.message
      });

      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Récupère les statistiques du service de remboursement
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: {
        refundWindowDays: this.refundWindowDays,
        minRefundAmount: this.minRefundAmount,
        maxRefundAmount: this.maxRefundAmount
      },
      providers: ['stripe', 'paypal']
    };
  }
}

module.exports = new RefundService();
