const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment-gateways.controller');
const { ValidationMiddleware } = require('../../../../shared');

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listGateways'), controller.list);

router.get('/:gatewayId', ValidationMiddleware.validateParams({
  gatewayId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createGateway'), controller.create);

router.patch(
  '/:gatewayId',
  ValidationMiddleware.validateParams({
    gatewayId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updateGateway'),
  controller.update
);

module.exports = router;
