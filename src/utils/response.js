/**
 * Utilitaires pour les réponses API standardisées
 */

/**
 * Réponse de succès
 * @param {string} message - Message de succès
 * @param {Object} data - Données à retourner
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function successResponse(message, data = null, meta = {}) {
  return {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse de création
 * @param {string} message - Message de succès
 * @param {Object} data - Données créées
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function createdResponse(message, data = null, meta = {}) {
  return {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      created: true,
      ...meta
    }
  };
}

/**
 * Réponse d'erreur
 * @param {string} message - Message d'erreur
 * @param {Object} data - Données d'erreur
 * @param {string} code - Code d'erreur
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function errorResponse(message, data = null, code = null, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code,
      data
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'erreur de validation
 * @param {Array} errors - Liste des erreurs de validation
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function validationErrorResponse(errors, meta = {}) {
  return {
    success: false,
    message: 'Erreur de validation',
    error: {
      code: 'VALIDATION_ERROR',
      data: errors
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'erreur non trouvée
 * @param {string} resource - Type de ressource
 * @param {string} id - ID de la ressource
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function notFoundResponse(resource, id = null, meta = {}) {
  const message = id ? `${resource} avec ID ${id} non trouvé` : `${resource} non trouvé`;
  
  return {
    success: false,
    message,
    error: {
      code: 'NOT_FOUND',
      data: {
        resource,
        id
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'accès interdit
 * @param {string} message - Message d'erreur
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function forbiddenResponse(message = 'Accès interdit', meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'FORBIDDEN'
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'erreur serveur
 * @param {string} message - Message d'erreur
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function serverErrorResponse(message = 'Erreur interne du serveur', meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'INTERNAL_SERVER_ERROR'
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse paginée
 * @param {Array} data - Données paginées
 * @param {Object} pagination - Informations de pagination
 * @param {string} message - Message de succès
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function paginatedResponse(data, pagination, message = 'Données récupérées avec succès', meta = {}) {
  return {
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les paiements
 * @param {Object} paymentData - Données du paiement
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function paymentResponse(paymentData, meta = {}) {
  return {
    success: true,
    message: 'Paiement traité avec succès',
    data: {
      paymentId: paymentData.id,
      status: paymentData.status,
      amount: paymentData.amount,
      currency: paymentData.currency,
      provider: paymentData.provider,
      createdAt: paymentData.createdAt,
      clientSecret: paymentData.clientSecret || null,
      redirectUrl: paymentData.redirectUrl || null
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les remboursements
 * @param {Object} refundData - Données du remboursement
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function refundResponse(refundData, meta = {}) {
  return {
    success: true,
    message: 'Remboursement traité avec succès',
    data: {
      refundId: refundData.id,
      status: refundData.status,
      amount: refundData.amount,
      currency: refundData.currency,
      provider: refundData.provider,
      reason: refundData.reason,
      createdAt: refundData.createdAt
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les factures
 * @param {Object} invoiceData - Données de la facture
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function invoiceResponse(invoiceData, meta = {}) {
  return {
    success: true,
    message: 'Facture générée avec succès',
    data: {
      invoiceId: invoiceData.id,
      invoiceNumber: invoiceData.invoiceNumber,
      status: invoiceData.status,
      amount: invoiceData.amounts.total,
      currency: invoiceData.amounts.currency || 'EUR',
      dueDate: invoiceData.dueDate,
      pdfUrl: invoiceData.pdfUrl || null,
      createdAt: invoiceData.createdAt
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les webhooks
 * @param {Object} webhookData - Données du webhook
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function webhookResponse(webhookData, meta = {}) {
  return {
    success: true,
    message: 'Webhook traité avec succès',
    data: {
      eventId: webhookData.id,
      eventType: webhookData.type,
      processedAt: new Date().toISOString(),
      status: webhookData.status || 'processed'
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les abonnements
 * @param {Object} subscriptionData - Données de l'abonnement
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function subscriptionResponse(subscriptionData, meta = {}) {
  return {
    success: true,
    message: 'Abonnement traité avec succès',
    data: {
      subscriptionId: subscriptionData.id,
      status: subscriptionData.status,
      plan: subscriptionData.plan,
      amount: subscriptionData.amount,
      currency: subscriptionData.currency,
      currentPeriodStart: subscriptionData.currentPeriodStart,
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      createdAt: subscriptionData.createdAt
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les erreurs de paiement
 * @param {string} message - Message d'erreur
 * @param {string} paymentErrorType - Type d'erreur de paiement
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function paymentErrorResponse(message, paymentErrorType, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'PAYMENT_ERROR',
      type: paymentErrorType
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les erreurs de provider
 * @param {string} message - Message d'erreur
 * @param {string} provider - Provider concerné
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function providerErrorResponse(message, provider, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'PROVIDER_ERROR',
      provider
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

module.exports = {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  forbiddenResponse,
  serverErrorResponse,
  paginatedResponse,
  paymentResponse,
  refundResponse,
  invoiceResponse,
  webhookResponse,
  subscriptionResponse,
  paymentErrorResponse,
  providerErrorResponse
};
