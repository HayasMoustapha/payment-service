const express = require('express');
const router = express.Router();
const walletsController = require('../controllers/wallets.controller');
const { authenticate, requirePermission } = require('../../../../shared');
const { validate, schemas } = require('../../middleware/validation');

/**
 * Routes pour la gestion des wallets et commissions
 */

// Apply authentication to all routes
router.use(authenticate);

// Wallet Management
router.get('/balance', 
  requirePermission('wallets.read'),
  walletsController.getWalletBalance
);

router.get('/transactions', 
  requirePermission('wallets.read'),
  walletsController.getWalletTransactions
);

router.get('/statistics', 
  requirePermission('wallets.read'),
  walletsController.getWalletStatistics
);

// Withdrawals
router.post('/withdrawals', 
  requirePermission('wallets.withdraw'),
  validate({
    amount: schemas.amount.required(),
    withdrawalMethod: schemas.string.required(),
    withdrawalDetails: schemas.object.required()
  }, 'body'),
  walletsController.createWithdrawal
);

router.get('/withdrawals', 
  requirePermission('wallets.read'),
  walletsController.getWithdrawals
);

// Commission Management
router.get('/commissions/statistics', 
  requirePermission('commissions.read'),
  walletsController.getCommissionStatistics
);

router.get('/commissions/user', 
  requirePermission('commissions.read'),
  walletsController.getUserCommissions
);

router.get('/commissions/rates', 
  requirePermission('commissions.read'),
  walletsController.getCommissionRates
);

router.post('/commissions/projections', 
  requirePermission('commissions.read'),
  validate({
    templateSales: schemas.number.optional(),
    ticketSales: schemas.number.optional(),
    serviceFees: schemas.number.optional(),
    withdrawals: schemas.number.optional()
  }, 'body'),
  walletsController.calculateProjectedCommissions
);

// Admin Only Routes
router.post('/transfer', 
  requirePermission('admin.wallet.transfer'),
  validate({
    fromUserId: schemas.uuid.required(),
    fromUserType: schemas.string.required(),
    toUserId: schemas.uuid.required(),
    toUserType: schemas.string.required(),
    amount: schemas.amount.required(),
    metadata: schemas.object.optional()
  }, 'body'),
  walletsController.transferBetweenWallets
);

module.exports = router;
