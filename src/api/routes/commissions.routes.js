const express = require('express');
const router = express.Router();
const controller = require('../controllers/commissions.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listCommissions'), controller.list);
router.post('/', ValidationMiddleware.createPaymentServiceValidator('createCommission'), controller.create);

router.get('/:commissionId', ValidationMiddleware.validateParams({
  commissionId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.get('/payment/:paymentId', ValidationMiddleware.validateParams({
  paymentId: ValidationMiddleware.schemas.id.required()
}), controller.getByPayment);

router.patch('/:commissionId',
  ValidationMiddleware.validateParams({
    commissionId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updateCommission'),
  controller.update
);

router.delete('/:commissionId',
  ValidationMiddleware.validateParams({
    commissionId: ValidationMiddleware.schemas.id.required()
  }),
  controller.delete
);

module.exports = router;
