const express = require('express');
const Joi = require('joi');
const router = express.Router();
const walletsController = require('../controllers/wallets.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require(../../../shared)))))');
const paymentErrorHandler = require('../../error/payment.errorHandler');

/**
 * Routes pour la gestion des wallets et commissions
 */

// Apply authentication to all routes
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Wallet Management
router.get('/balance', 
  SecurityMiddleware.withPermissions('wallets.read'),
  walletsController.getWalletBalance
);

router.get('/transactions', 
  SecurityMiddleware.withPermissions('wallets.read'),
  walletsController.getWalletTransactions
);

router.get('/statistics', 
  SecurityMiddleware.withPermissions('wallets.read'),
  walletsController.getWalletStatistics
);

// Withdrawals
router.post('/withdrawals', 
  SecurityMiddleware.withPermissions('wallets.withdraw'),
  ValidationMiddleware.validate({
    body: Joi.object({
      amount: Joi.number().positive().required(),
      withdrawalMethod: Joi.string().required(),
      withdrawalDetails: Joi.object().required()
    })
  }),
  walletsController.createWithdrawal
);

router.get('/withdrawals', 
  SecurityMiddleware.withPermissions('wallets.read'),
  walletsController.getWithdrawals
);

// Commission Management
router.get('/commissions/statistics', 
  SecurityMiddleware.withPermissions('commissions.read'),
  walletsController.getCommissionStatistics
);

router.get('/commissions/user', 
  SecurityMiddleware.withPermissions('commissions.read'),
  walletsController.getUserCommissions
);

router.get('/commissions/rates', 
  SecurityMiddleware.withPermissions('commissions.read'),
  walletsController.getCommissionRates
);

router.post('/commissions/projections', 
  SecurityMiddleware.withPermissions('commissions.create'),
  ValidationMiddleware.validate({
    body: Joi.object({
      period: Joi.string().valid('daily', 'weekly', 'monthly').required(),
      commissionRate: Joi.number().min(0).max(0.5).required()
    })
  }),
  walletsController.createCommissionProjection
);

router.get('/commissions/projections', 
  SecurityMiddleware.withPermissions('commissions.read'),
  walletsController.getCommissionProjections
);

router.get('/commissions/projections/:projectionId', 
  SecurityMiddleware.withPermissions('commissions.read'),
  walletsController.getCommissionProjection
);

router.post('/commissions/projections/:projectionId/settle', 
  SecurityMiddleware.withPermissions('commissions.settle'),
  ValidationMiddleware.validateParams({
    projectionId: Joi.string().required()
  }),
  walletsController.settleCommissionProjection
);

module.exports = router;
