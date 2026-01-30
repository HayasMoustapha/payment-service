/**
 * Controller pour la gestion des retries de webhooks
 * Permet de monitorer et gérer la queue de retry
 */

const webhookRetryService = require('../core/webhooks/webhook-retry.service');
const { successResponse } = require('../../utils/response');

/**
 * Récupère le statut de la queue de retry
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getRetryQueueStatus(req, res) {
  try {
    const status = webhookRetryService.getQueueStatus();
    
    return successResponse(res, status, 'Retry queue status retrieved successfully');
    
  } catch (error) {
    console.error('[WEBHOOK_RETRY] Error getting queue status:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du statut de la queue',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Vide la queue de retry (endpoint de maintenance)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function clearRetryQueue(req, res) {
  try {
    const clearedCount = webhookRetryService.clearRetryQueue();
    
    return successResponse(res, {
      clearedCount,
      message: 'Retry queue cleared successfully'
    }, 'Retry queue cleared');
    
  } catch (error) {
    console.error('[WEBHOOK_RETRY] Error clearing queue:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du vidage de la queue',
      code: 'INTERNAL_ERROR'
    });
  }
}

module.exports = {
  getRetryQueueStatus,
  clearRetryQueue
};
