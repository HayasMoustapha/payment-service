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
  ValidationMiddleware.validate({ body: generateInvoicePdfSchema }),
  invoicesController.generateInvoicePdf
);

// Get Invoice
router.get('/:invoiceId',
  ValidationMiddleware.validateParams({
    invoiceId: Joi.string().required()
  }),
  invoicesController.getInvoice
);

// Download Invoice PDF
router.get('/:invoiceId/download',
  ValidationMiddleware.validateParams({
    invoiceId: Joi.string().required()
  }),
  invoicesController.downloadInvoicePdf
);

// List Invoices
router.get('/',
  invoicesController.listInvoices
);

module.exports = router;
