/**
 * Routes pour la gestion des retries de webhooks
 * Endpoints de monitoring et maintenance
 */

const express = require('express');
const router = express.Router();

// Import du controller
const webhookRetryController = require('../controllers/webhook-retry.controller');

/**
 * GET /api/webhooks/retry/status
 * Récupère le statut de la queue de retry
 * 
 * Réponse :
 * {
 *   success: true,
 *   data: {
 *     totalInQueue: number,
 *     maxRetries: number,
 *     retryDelays: number[],
 *     items: [
 *       {
 *         paymentIntentId: string,
 *         attempt: number,
 *         nextRetryAt: string,
 *         createdAt: string
 *       }
 *     ]
 *   }
 * }
 */
router.get('/status', webhookRetryController.getRetryQueueStatus);

/**
 * DELETE /api/webhooks/retry/clear
 * Vide la queue de retry (maintenance uniquement)
 * 
 * Réponse :
 * {
 *   success: true,
 *   data: {
 *     clearedCount: number,
 *     message: string
 *   }
 * }
 */
router.delete('/clear', webhookRetryController.clearRetryQueue);

module.exports = router;
