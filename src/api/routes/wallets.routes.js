const express = require('express');
const router = express.Router();
const controller = require('../controllers/wallets.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createWallet'), controller.create);

router.get('/:walletId', ValidationMiddleware.validateParams({
  walletId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.get('/designer/:designerId', ValidationMiddleware.validateParams({
  designerId: ValidationMiddleware.schemas.id.required()
}), controller.getByDesigner);

module.exports = router;
