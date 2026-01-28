const express = require('express');
const Joi = require('joi');
const router = express.Router();
const invoicesController = require('../controllers/invoices.controller');
const { ValidationMiddleware } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply error handler for all routes
router.use(paymentErrorHandler);

// Validation schemas
const generateInvoicePdfSchema = Joi.object({
  transactionId: Joi.string().required(),
  template: Joi.string().default('default'),
  includeTax: Joi.boolean().default(true)
});

// Invoice Management
router.post('/generate',
  ValidationMiddleware.validate(generateInvoicePdfSchema),
  invoicesController.generateInvoicePdf
);

// Get Invoice
router.get('/:invoiceId',
  ValidationMiddleware.validate(Joi.object({
    invoiceId: Joi.string().required()
  }), 'params'),
  invoicesController.getInvoice
);

// Download Invoice PDF
router.get('/:invoiceId/download',
  ValidationMiddleware.validate(Joi.object({
    invoiceId: Joi.string().required()
  }), 'params'),
  invoicesController.downloadInvoicePdf
);

// List Invoices
router.get('/',
  invoicesController.listInvoices
);

module.exports = router;
