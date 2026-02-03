const express = require('express');
const router = express.Router();
const controller = require('../controllers/commissions.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createCommission'), controller.create);

router.get('/:commissionId', ValidationMiddleware.validateParams({
  commissionId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.get('/payment/:paymentId', ValidationMiddleware.validateParams({
  paymentId: ValidationMiddleware.schemas.id.required()
}), controller.getByPayment);

module.exports = router;
