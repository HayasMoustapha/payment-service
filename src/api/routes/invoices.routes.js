const express = require('express');
const router = express.Router();
const invoicesController = require('../controllers/invoices.controller');
const { authenticate, requirePermission } = require('../../../../shared');
const { validate } = require('../../middleware/validation');
const Joi = require('joi');

// Validation schemas
const generateInvoicePdfSchema = Joi.object({
  transactionId: Joi.string().required(),
  template: Joi.string().default('default'),
  includeTax: Joi.boolean().default(true)
});

// Apply authentication to all routes
router.use(authenticate);

// Generate Invoice PDF
router.post('/generate',
  requirePermission('invoices.create'),
  validate(generateInvoicePdfSchema),
  invoicesController.generateInvoicePdf
);

// Get Invoice
router.get('/:invoiceId',
  requirePermission('invoices.read'),
  invoicesController.getInvoice
);

// Download Invoice PDF
router.get('/:invoiceId/download',
  requirePermission('invoices.read'),
  invoicesController.downloadInvoicePdf
);

// List Invoices
router.get('/',
  requirePermission('invoices.read'),
  invoicesController.listInvoices
);

module.exports = router;
