/**
 * 🏦 ROUTES WALLETS ET COMMISSIONS
 * 
 * RÔLE : Gestion technique des wallets et commissions
 * UTILISATION : Service technique pour les transactions financières
 * 
 * NOTE : Service technique sans authentification
 * La sécurité est gérée par event-planner-core
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const walletsController = require('../controllers/wallets.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// ========================================
// 🚨 GESTIONNAIRE D'ERREURS
// ========================================
// Capture les erreurs spécifiques aux wallets
router.use(paymentErrorHandler);

// ========================================
// 💼 GESTION DES WALLETS
// ========================================

/**
 * 📊 SOLDE DU WALLET
 * GET /api/wallets/balance
 * Récupère le solde d'un wallet
 */
router.get('/balance', 
  ValidationMiddleware.validate({
    query: Joi.object({
      walletId: Joi.string().required(),
      currency: Joi.string().default('eur')
    })
  }),
  walletsController.getWalletBalance
);

/**
 * 📋 HISTORIQUE DES TRANSACTIONS
 * GET /api/wallets/transactions
 * Récupère l'historique des transactions d'un wallet
 */
router.get('/transactions', 
  ValidationMiddleware.validate({
    query: Joi.object({
      walletId: Joi.string().required(),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0),
      type: Joi.string().valid('credit', 'debit', 'all').default('all')
    })
  }),
  walletsController.getWalletTransactions
);

/**
 * 📈 STATISTIQUES WALLET
 * GET /api/wallets/statistics
 * Récupère les statistiques d'un wallet
 */
router.get('/statistics', 
  ValidationMiddleware.validate({
    query: Joi.object({
      walletId: Joi.string().required(),
      period: Joi.string().valid('day', 'week', 'month', 'year').default('month')
    })
  }),
  walletsController.getWalletStatistics
);

// ========================================
// 💸 GESTION DES RETRAITS
// ========================================

/**
 * 🏦 CRÉER UN RETRAIT
 * POST /api/wallets/withdrawals
 * Crée une demande de retrait
 */
router.post('/withdrawals', 
  ValidationMiddleware.validate({
    body: Joi.object({
      walletId: Joi.string().required(),
      amount: Joi.number().positive().required(),
      withdrawalMethod: Joi.string().required(),
      withdrawalDetails: Joi.object().required()
    })
  }),
  walletsController.createWithdrawal
);

/**
 * 📋 LISTE DES RETRAITS
 * GET /api/wallets/withdrawals
 * Récupère la liste des retraits
 */
router.get('/withdrawals', 
  ValidationMiddleware.validate({
    query: Joi.object({
      walletId: Joi.string().required(),
      status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled').optional(),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    })
  }),
  walletsController.getWithdrawals
);

// ========================================
// 💰 GESTION DES COMMISSIONS
// ========================================

/**
 * 📊 STATISTIQUES COMMISSIONS
 * GET /api/wallets/commissions/statistics
 * Récupère les statistiques des commissions
 */
router.get('/commissions/statistics', 
  ValidationMiddleware.validate({
    query: Joi.object({
      period: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
      currency: Joi.string().default('eur')
    })
  }),
  walletsController.getCommissionStatistics
);

/**
 * 👤 COMMISSIONS UTILISATEUR
 * GET /api/wallets/commissions/user
 * Récupère les commissions d'un utilisateur
 */
router.get('/commissions/user', 
  ValidationMiddleware.validate({
    query: Joi.object({
      userId: Joi.string().required(),
      period: Joi.string().valid('day', 'week', 'month', 'year').default('month')
    })
  }),
  walletsController.getUserCommissions
);

/**
 * 📈 TAUX DE COMMISSION
 * GET /api/wallets/commissions/rates
 * Récupère les taux de commission applicables
 */
router.get('/commissions/rates', 
  ValidationMiddleware.validate({
    query: Joi.object({
      transactionType: Joi.string().valid('ticket_sale', 'template_purchase', 'service_fee').optional(),
      currency: Joi.string().default('eur')
    })
  }),
  walletsController.getCommissionRates
);

/**
 * 🔮 PROJECTION DE COMMISSION
 * POST /api/wallets/commissions/projections
 * Crée une projection de commission
 */
router.post('/commissions/projections', 
  ValidationMiddleware.validate({
    body: Joi.object({
      userId: Joi.string().required(),
      period: Joi.string().valid('daily', 'weekly', 'monthly').required(),
      commissionRate: Joi.number().min(0).max(0.5).required(),
      projectedAmount: Joi.number().positive().required()
    })
  }),
  walletsController.createCommissionProjection
);

/**
 * 📋 LISTE DES PROJECTIONS
 * GET /api/wallets/commissions/projections
 * Récupère la liste des projections de commissions
 */
router.get('/commissions/projections', 
  ValidationMiddleware.validate({
    query: Joi.object({
      userId: Joi.string().optional(),
      status: Joi.string().valid('active', 'completed', 'cancelled').optional(),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    })
  }),
  walletsController.getCommissionProjections
);

/**
 * 🔍 DÉTAIL PROJECTION
 * GET /api/wallets/commissions/projections/:projectionId
 * Récupère le détail d'une projection
 */
router.get('/commissions/projections/:projectionId', 
  ValidationMiddleware.validateParams({
    projectionId: Joi.string().required()
  }),
  walletsController.getCommissionProjection
);

/**
 * ✅ RÉGLER PROJECTION
 * POST /api/wallets/commissions/projections/:projectionId/settle
 * Règle une projection de commission
 */
router.post('/commissions/projections/:projectionId/settle', 
  ValidationMiddleware.validateParams({
    projectionId: Joi.string().required()
  }),
  ValidationMiddleware.validate({
    body: Joi.object({
      settlementAmount: Joi.number().positive().required(),
      settlementMethod: Joi.string().required(),
      reference: Joi.string().optional()
    })
  }),
  walletsController.settleCommissionProjection
);

module.exports = router;
