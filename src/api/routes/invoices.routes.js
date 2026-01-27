const express = require('express');
const Joi = require('joi');
const router = express.Router();
const invoicesController = require('../controllers/invoices.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
const paymentErrorHandler = require('../../error/payment.errorHandler');

// Apply authentication to all routes
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

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
  SecurityMiddleware.withPermissions('invoices.create'),
  ValidationMiddleware.validate({ body: generateInvoicePdfSchema }),
  invoicesController.generateInvoicePdf
);

// Get Invoice
router.get('/:invoiceId',
  SecurityMiddleware.withPermissions('invoices.read'),
  ValidationMiddleware.validateParams({
    invoiceId: Joi.string().required()
  }),
  invoicesController.getInvoice
);

// Download Invoice PDF
router.get('/:invoiceId/download',
  SecurityMiddleware.withPermissions('invoices.read'),
  ValidationMiddleware.validateParams({
    invoiceId: Joi.string().required()
  }),
  invoicesController.downloadInvoicePdf
);

// List Invoices
router.get('/',
  SecurityMiddleware.withPermissions('invoices.read'),
  invoicesController.listInvoices
);

module.exports = router;
