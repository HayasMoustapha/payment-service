const express = require('express');
const router = express.Router();
const controller = require('../controllers/payments.controller');
const Joi = require('joi');
const { ValidationMiddleware } = require('../../../../shared');

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listPayments'), controller.list);

router.get('/:paymentId', ValidationMiddleware.validateParams({
  paymentId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createPayment'), controller.create);

router.patch(
  '/:paymentId/status',
  ValidationMiddleware.validateParams({
    paymentId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updatePaymentStatus'),
  controller.updateStatus
);

// New routes for email templates
router.get(
  '/invoices/:invoiceId',
  ValidationMiddleware.validateParams({
    invoiceId: Joi.string().required()
  }),
  controller.downloadInvoice
);

router.post(
  '/retry/:transactionId',
  ValidationMiddleware.validateParams({
    transactionId: Joi.string().required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('retryPayment'),
  controller.retryPayment
);

module.exports = router;
