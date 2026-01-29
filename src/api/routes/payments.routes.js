/**
 * 💳 ROUTES PAIEMENTS
 * 
 * RÔLE : Traitement technique des paiements
 * UTILISATION : Service technique pour les transactions financières
 * 
 * NOTE : Service technique sans authentification
 * La sécurité est gérée par event-planner-core
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// ========================================
// 🚨 GESTIONNAIRE D'ERREURS
// ========================================
// Capture les erreurs spécifiques aux paiements
router.use(paymentErrorHandler);

// ========================================
// 💰 TRAITEMENT DES PAIEMENTS
// ========================================

/**
 * 🔄 TRAITER UN PAIEMENT
 * POST /api/payments/process
 * Crée une nouvelle transaction de paiement
 */
router.post('/process', 
  ValidationMiddleware.validate({
    body: Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().default('eur'),
      gateway: Joi.string().valid('stripe', 'paypal', 'cinetpay').required(),
      customerEmail: Joi.string().email().required(),
      description: Joi.string().required(),
      metadata: Joi.object().optional()
    })
  }),
  paymentsController.processPayment
);

/**
 * 🎫 ACHETER UN TEMPLATE
 * POST /api/payments/templates/purchase
 * Achète un template (design, modèle, etc.)
 */
router.post('/templates/purchase', 
  ValidationMiddleware.validate({
    body: Joi.object({
      templateId: Joi.string().required(),
      customerEmail: Joi.string().email().required(),
      paymentMethod: Joi.string().required(),
      amount: Joi.number().positive().optional(),
      currency: Joi.string().default('eur')
    })
  }),
  paymentsController.purchaseTemplate
);

/**
 * 📊 STATUT PAIEMENT
 * GET /api/payments/:paymentId/status
 * Récupère le statut d'un paiement
 */
router.get('/:paymentId/status', 
  ValidationMiddleware.validateParams({
    paymentId: Joi.string().required()
  }),
  paymentsController.getPaymentStatus
);

/**
 * 📋 LISTE PAIEMENTS
 * GET /api/payments
 * Récupère la liste des paiements
 */
router.get('/', 
  ValidationMiddleware.validate({
    query: Joi.object({
      customerId: Joi.string().optional(),
      status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled').optional(),
      gateway: Joi.string().valid('stripe', 'paypal', 'cinetpay').optional(),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    })
  }),
  paymentsController.getPayments
);

/**
 * 🔍 DÉTAIL PAIEMENT
 * GET /api/payments/:paymentId
 * Récupère le détail d'un paiement
 */
router.get('/:paymentId', 
  ValidationMiddleware.validateParams({
    paymentId: Joi.string().required()
  }),
  paymentsController.getPaymentDetails
);

/**
 * ❌ ANNULER PAIEMENT
 * POST /api/payments/:paymentId/cancel
 * Annule un paiement en attente
 */
router.post('/:paymentId/cancel', 
  ValidationMiddleware.validateParams({
    paymentId: Joi.string().required()
  }),
  ValidationMiddleware.validate({
    body: Joi.object({
      reason: Joi.string().optional(),
      refundAmount: Joi.number().positive().optional()
    })
  }),
  paymentsController.cancelPayment
);

module.exports = router;
