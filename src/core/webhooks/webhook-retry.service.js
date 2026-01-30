/**
 * Service de retry pour les webhooks de paiement
 * Gère les tentatives d'envoi en cas d'échec
 */

const logger = require('../../utils/logger');

/**
 * Service de retry pour webhooks
 */
class WebhookRetryService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
    this.retryQueue = new Map(); // paymentIntentId -> retry data
  }

  /**
   * Ajoute un webhook à la queue de retry
   * @param {string} paymentIntentId - ID du paiement
   * @param {Object} webhookData - Données du webhook
   * @param {number} attempt - Numéro de la tentative actuelle
   */
  addToRetryQueue(paymentIntentId, webhookData, attempt = 0) {
    if (attempt >= this.maxRetries) {
      logger.error(`[WEBHOOK_RETRY] Max retries reached for payment ${paymentIntentId}`);
      return false;
    }

    const retryData = {
      paymentIntentId,
      webhookData,
      attempt: attempt + 1,
      nextRetryAt: Date.now() + this.retryDelays[attempt],
      createdAt: Date.now()
    };

    this.retryQueue.set(paymentIntentId, retryData);
    
    logger.info(`[WEBHOOK_RETRY] Added to queue: payment ${paymentIntentId}, attempt ${attempt + 1}/${this.maxRetries}`);
    
    // Programmer le retry
    this.scheduleRetry(retryData);
    
    return true;
  }

  /**
   * Programme un retry pour un webhook
   * @param {Object} retryData - Données du retry
   */
  scheduleRetry(retryData) {
    const delay = retryData.nextRetryAt - Date.now();
    
    setTimeout(async () => {
      await this.processRetry(retryData);
    }, delay);
  }

  /**
   * Traite une tentative de retry
   * @param {Object} retryData - Données du retry
   */
  async processRetry(retryData) {
    const { paymentIntentId, webhookData, attempt } = retryData;
    
    try {
      logger.info(`[WEBHOOK_RETRY] Processing retry ${attempt}/${this.maxRetries} for payment ${paymentIntentId}`);
      
      // Importer la fonction d'envoi de webhook
      const { emitPaymentWebhook } = require('../controllers/payment-controller');
      
      const result = await emitPaymentWebhook(
        paymentIntentId,
        webhookData.status,
        webhookData.data
      );
      
      if (result.success) {
        // Succès - retirer de la queue
        this.retryQueue.delete(paymentIntentId);
        logger.info(`[WEBHOOK_RETRY] Success on attempt ${attempt} for payment ${paymentIntentId}`);
      } else {
        // Échec - programmer un autre retry
        this.addToRetryQueue(paymentIntentId, webhookData, attempt);
      }
      
    } catch (error) {
      logger.error(`[WEBHOOK_RETRY] Retry ${attempt} failed for payment ${paymentIntentId}:`, error.message);
      
      // Programmer un autre retry
      this.addToRetryQueue(paymentIntentId, webhookData, attempt);
    }
  }

  /**
   * Retire un webhook de la queue de retry
   * @param {string} paymentIntentId - ID du paiement
   */
  removeFromRetryQueue(paymentIntentId) {
    const removed = this.retryQueue.delete(paymentIntentId);
    
    if (removed) {
      logger.info(`[WEBHOOK_RETRY] Removed from queue: payment ${paymentIntentId}`);
    }
    
    return removed;
  }

  /**
   * Récupère le statut de la queue de retry
   * @returns {Object} Statistiques de la queue
   */
  getQueueStatus() {
    const queueArray = Array.from(this.retryQueue.values());
    
    return {
      totalInQueue: queueArray.length,
      maxRetries: this.maxRetries,
      retryDelays: this.retryDelays,
      items: queueArray.map(item => ({
        paymentIntentId: item.paymentIntentId,
        attempt: item.attempt,
        nextRetryAt: new Date(item.nextRetryAt).toISOString(),
        createdAt: new Date(item.createdAt).toISOString()
      }))
    };
  }

  /**
   * Vide la queue de retry (pour maintenance)
   */
  clearRetryQueue() {
    const count = this.retryQueue.size;
    this.retryQueue.clear();
    
    logger.warn(`[WEBHOOK_RETRY] Cleared retry queue (${count} items removed)`);
    
    return count;
  }
}

// Exportation d'une instance singleton
module.exports = new WebhookRetryService();
