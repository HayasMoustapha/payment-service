const express = require('express');
const router = express.Router();
const controller = require('../controllers/wallets.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listWallets'), controller.list);
router.post('/', ValidationMiddleware.createPaymentServiceValidator('createWallet'), controller.create);

router.get('/:walletId', ValidationMiddleware.validateParams({
  walletId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.get('/designer/:designerId', ValidationMiddleware.validateParams({
  designerId: ValidationMiddleware.schemas.id.required()
}), controller.getByDesigner);

router.patch('/:walletId',
  ValidationMiddleware.validateParams({
    walletId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updateWallet'),
  controller.update
);

router.delete('/:walletId',
  ValidationMiddleware.validateParams({
    walletId: ValidationMiddleware.schemas.id.required()
  }),
  controller.delete
);

module.exports = router;
