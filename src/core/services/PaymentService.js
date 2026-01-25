const { providerFactory } = require('../providers/ProviderFactory');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Service principal de gestion des paiements
 * Orchestre les opérations de paiement via l'abstraction des providers
 */
class PaymentService {
  constructor(transactionRepository, walletService, commissionService) {
    this.transactionRepository = transactionRepository;
    this.walletService = walletService;
    this.commissionService = commissionService;
  }

  /**
   * Initialise une transaction de paiement
   * @param {Object} paymentData - Données du paiement
   * @returns {Promise<Object>} Résultat de l'initialisation
   */
  async initializePayment(paymentData) {
    try {
      // Validation des données
      this.validatePaymentData(paymentData);

      // Génération des références
      const reference = this.generateReference('PAY');
      const idempotencyKey = paymentData.idempotencyKey || this.generateIdempotencyKey();

      // Vérification idempotency
      const existingTransaction = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);
      if (existingTransaction) {
        return {
          success: true,
          data: existingTransaction,
          message: 'Transaction already exists',
          idempotent: true
        };
      }

      // Sélection du provider approprié
      const provider = providerFactory.selectBestProvider({
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        amount: paymentData.amount,
        country: paymentData.country
      });

      // Création de la transaction en base
      const transaction = await this.transactionRepository.create({
        reference,
        idempotencyKey,
        userId: paymentData.userId,
        eventId: paymentData.eventId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        type: 'payment',
        subtype: paymentData.subtype || 'ticket_purchase',
        paymentMethod: paymentData.paymentMethod,
        provider: provider.name,
        status: 'pending',
        metadata: paymentData.metadata || {}
      });

      // Création du paiement via le provider
      const paymentResult = await provider.createPayment({
        ...paymentData,
        reference,
        metadata: {
          ...paymentData.metadata,
          transactionId: transaction.id
        }
      });

      if (!paymentResult.success) {
        // Marquer la transaction comme échouée
        await this.transactionRepository.updateStatus(transaction.id, 'failed');
        throw paymentResult.error;
      }

      // Mise à jour de la transaction avec les infos du provider
      await this.transactionRepository.updateProviderInfo(transaction.id, {
        providerTransactionId: paymentResult.data.id,
        providerResponse: paymentResult.data
      });

      return {
        success: true,
        data: {
          transaction,
          payment: paymentResult.data,
          provider: provider.name
        },
        message: 'Payment initialized successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_INITIALIZATION_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Confirme et capture un paiement
   * @param {string} transactionId - ID de la transaction
   * @param {Object} captureData - Données de capture
   * @returns {Promise<Object>} Résultat de la capture
   */
  async capturePayment(transactionId, captureData = {}) {
    try {
      // Récupération de la transaction
      const transaction = await this.transactionRepository.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'pending') {
        throw new Error(`Cannot capture transaction with status: ${transaction.status}`);
      }

      // Récupération du provider
      const provider = providerFactory.getProvider(transaction.provider);

      // Capture du paiement
      const captureResult = await provider.capturePayment(
        transaction.providerTransactionId,
        captureData.amount
      );

      if (!captureResult.success) {
        await this.transactionRepository.updateStatus(transactionId, 'failed');
        throw captureResult.error;
      }

      // Mise à jour du statut de la transaction
      await this.transactionRepository.updateStatus(transactionId, 'success');
      await this.transactionRepository.setProcessedDate(transactionId);

      // Traitement post-paiement
      await this.processSuccessfulPayment(transaction, captureResult.data);

      return {
        success: true,
        data: {
          transaction,
          capture: captureResult.data
        },
        message: 'Payment captured successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_CAPTURE_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Annule un paiement
   * @param {string} transactionId - ID de la transaction
   * @returns {Promise<Object>} Résultat de l'annulation
   */
  async cancelPayment(transactionId) {
    try {
      const transaction = await this.transactionRepository.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (!['pending', 'processing'].includes(transaction.status)) {
        throw new Error(`Cannot cancel transaction with status: ${transaction.status}`);
      }

      const provider = providerFactory.getProvider(transaction.provider);
      const cancelResult = await provider.cancelPayment(transaction.providerTransactionId);

      if (!cancelResult.success) {
        throw cancelResult.error;
      }

      await this.transactionRepository.updateStatus(transactionId, 'cancelled');

      return {
        success: true,
        data: {
          transaction,
          cancellation: cancelResult.data
        },
        message: 'Payment cancelled successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_CANCELLATION_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Crée un remboursement
   * @param {Object} refundData - Données du remboursement
   * @returns {Promise<Object>} Résultat du remboursement
   */
  async createRefund(refundData) {
    try {
      // Validation
      if (!refundData.transactionId || !refundData.amount) {
        throw new Error('Transaction ID and amount are required');
      }

      // Récupération de la transaction originale
      const transaction = await this.transactionRepository.findById(refundData.transactionId);
      if (!transaction) {
        throw new Error('Original transaction not found');
      }

      if (transaction.status !== 'success') {
        throw new Error('Cannot refund unsuccessful transaction');
      }

      // Vérification du montant
      if (refundData.amount > transaction.amount) {
        throw new Error('Refund amount cannot exceed original transaction amount');
      }

      // Génération de la référence de remboursement
      const refundReference = this.generateReference('REF');

      // Création du remboursement en base
      const refund = await this.transactionRepository.createRefund({
        transactionId: refundData.transactionId,
        refundId: uuidv4(),
        reference: refundReference,
        amount: refundData.amount,
        reason: refundData.reason || 'Customer request',
        status: 'pending',
        processedBy: refundData.processedBy
      });

      // Traitement via le provider
      const provider = providerFactory.getProvider(transaction.provider);
      const refundResult = await provider.refundPayment(
        transaction.providerTransactionId,
        refundData.amount,
        refundData.reason
      );

      if (!refundResult.success) {
        await this.transactionRepository.updateRefundStatus(refund.id, 'failed');
        throw refundResult.error;
      }

      // Mise à jour du statut du remboursement
      await this.transactionRepository.updateRefundStatus(refund.id, 'success');
      await this.transactionRepository.updateRefundProviderInfo(refund.id, {
        providerRefundId: refundResult.data.id,
        providerResponse: refundResult.data
      });

      // Traitement post-remboursement
      await this.processSuccessfulRefund(transaction, refund, refundResult.data);

      return {
        success: true,
        data: {
          refund,
          providerRefund: refundResult.data
        },
        message: 'Refund processed successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REFUND_PROCESSING_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Récupère le statut d'une transaction
   * @param {string} transactionId - ID de la transaction
   * @returns {Promise<Object>} Statut de la transaction
   */
  async getTransactionStatus(transactionId) {
    try {
      const transaction = await this.transactionRepository.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Si le statut est encore pending, vérifier auprès du provider
      if (transaction.status === 'pending') {
        const provider = providerFactory.getProvider(transaction.provider);
        const providerStatus = await provider.getPaymentStatus(transaction.providerTransactionId);
        
        // Synchroniser le statut si différent
        if (providerStatus.status !== transaction.status) {
          await this.transactionRepository.updateStatus(transactionId, providerStatus.status);
          transaction.status = providerStatus.status;
        }
      }

      return {
        success: true,
        data: {
          id: transaction.id,
          reference: transaction.reference,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          createdAt: transaction.createdAt,
          processedAt: transaction.processedAt
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATUS_RETRIEVAL_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Traite les actions post-paiement réussi
   * @param {Object} transaction - Transaction réussie
   * @param {Object} captureData - Données de capture
   */
  async processSuccessfulPayment(transaction, captureData) {
    try {
      // Calcul et collecte des commissions
      const commission = await this.commissionService.calculateAndCollect(transaction);

      // Crédit des wallets appropriés
      await this.walletService.creditFromTransaction(transaction, commission);

      // Notifications et logs
      console.log(`Payment processed successfully: ${transaction.reference}`, {
        transactionId: transaction.id,
        amount: transaction.amount,
        commission: commission?.amount
      });

    } catch (error) {
      console.error('Post-payment processing failed:', error);
      // Ne pas échouer la transaction pour les erreurs post-traitement
    }
  }

  /**
   * Traite les actions post-remboursement réussi
   * @param {Object} transaction - Transaction originale
   * @param {Object} refund - Remboursement
   * @param {Object} providerRefund - Données du provider
   */
  async processSuccessfulRefund(transaction, refund, providerRefund) {
    try {
      // Remboursement des commissions si applicable
      await this.commissionService.refundCommission(transaction, refund);

      // Débit des wallets appropriés
      await this.walletService.debitFromRefund(transaction, refund);

      console.log(`Refund processed successfully: ${refund.reference}`, {
        refundId: refund.id,
        amount: refund.amount,
        transactionId: transaction.id
      });

    } catch (error) {
      console.error('Post-refund processing failed:', error);
    }
  }

  /**
   * Valide les données de paiement
   * @param {Object} paymentData - Données à valider
   */
  validatePaymentData(paymentData) {
    const required = ['userId', 'amount', 'currency', 'paymentMethod'];
    const missing = required.filter(field => !paymentData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (paymentData.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (!paymentData.currency || paymentData.currency.length !== 3) {
      throw new Error('Invalid currency code');
    }
  }

  /**
   * Génère une référence unique
   * @param {string} prefix - Préfixe
   * @returns {string} Référence unique
   */
  generateReference(prefix) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Génère une clé d'idempotence
   * @returns {string} Clé d'idempotence
   */
  generateIdempotencyKey() {
    return crypto.randomUUID();
  }

  /**
   * Traite un webhook provider
   * @param {string} providerName - Nom du provider
   * @param {Object} webhookData - Données du webhook
   * @returns {Promise<Object>} Résultat du traitement
   */
  async processWebhook(providerName, webhookData) {
    try {
      const provider = providerFactory.getProvider(providerName);
      
      // Vérification de la signature
      if (!provider.verifyWebhook(webhookData.body, webhookData.signature)) {
        throw new Error('Invalid webhook signature');
      }

      // Parsing de l'événement
      const event = provider.parseWebhookEvent(webhookData.body);

      // Traitement selon le type d'événement
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSuccess(event);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailure(event);
        case 'payment_intent.canceled':
          return await this.handlePaymentCancellation(event);
        default:
          return { success: true, message: 'Event ignored' };
      }

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Gère un webhook de succès de paiement
   * @param {Object} event - Événement webhook
   */
  async handlePaymentSuccess(event) {
    const providerTransactionId = event.data.id;
    const transaction = await this.transactionRepository.findByProviderTransactionId(
      providerTransactionId
    );

    if (transaction && transaction.status === 'pending') {
      await this.transactionRepository.updateStatus(transaction.id, 'success');
      await this.transactionRepository.setProcessedDate(transaction.id);
      await this.processSuccessfulPayment(transaction, event.data);
    }

    return { success: true, message: 'Payment success processed' };
  }

  /**
   * Gère un webhook d'échec de paiement
   * @param {Object} event - Événement webhook
   */
  async handlePaymentFailure(event) {
    const providerTransactionId = event.data.id;
    const transaction = await this.transactionRepository.findByProviderTransactionId(
      providerTransactionId
    );

    if (transaction && transaction.status === 'pending') {
      await this.transactionRepository.updateStatus(transaction.id, 'failed');
    }

    return { success: true, message: 'Payment failure processed' };
  }

  /**
   * Gère un webhook d'annulation de paiement
   * @param {Object} event - Événement webhook
   */
  async handlePaymentCancellation(event) {
    const providerTransactionId = event.data.id;
    const transaction = await this.transactionRepository.findByProviderTransactionId(
      providerTransactionId
    );

    if (transaction && transaction.status === 'pending') {
      await this.transactionRepository.updateStatus(transaction.id, 'cancelled');
    }

    return { success: true, message: 'Payment cancellation processed' };
  }
}

module.exports = PaymentService;
