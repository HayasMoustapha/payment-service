const express = require('express');
const router = express.Router();
const controller = require('../controllers/refunds.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listRefunds'), controller.list);

router.get('/:refundId', ValidationMiddleware.validateParams({
  refundId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createRefund'), controller.create);

module.exports = router;
