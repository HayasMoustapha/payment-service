const express = require('express');
const router = express.Router();
const controller = require('../controllers/withdrawals.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listWithdrawals'), controller.list);

router.get('/:withdrawalId', ValidationMiddleware.validateParams({
  withdrawalId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createWithdrawal'), controller.create);

router.patch(
  '/:withdrawalId/status',
  ValidationMiddleware.validateParams({
    withdrawalId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updateWithdrawalStatus'),
  controller.updateStatus
);

module.exports = router;
