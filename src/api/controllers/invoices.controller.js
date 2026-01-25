const stripeService = require('../../core/stripe/stripe.service');
const paypalService = require('../../core/paypal/paypal.service');
const { 
  successResponse, 
  createdResponse, 
  notFoundResponse,
  errorResponse,
  invoiceResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Invoices Controller - Handles invoice operations
 */
class InvoicesController {
  /**
   * Generate Invoice PDF
   */
  async generateInvoicePdf(req, res) {
    try {
      const {
        transactionId,
        template = 'default',
        includeTax = true
      } = req.body;

      logger.payment('Generating Invoice PDF', {
        transactionId,
        template,
        includeTax,
        userId: req.user?.id
      });

      // Try to get transaction from both providers
      let transaction = await stripeService.getTransaction(transactionId);
      
      if (!transaction.success) {
        transaction = await paypalService.getTransaction(transactionId);
      }

      if (!transaction.success) {
        return res.status(404).json(
          notFoundResponse('Transaction not found', transaction.error)
        );
      }

      const result = await this.generatePdfInvoice({
        transaction: transaction.transaction,
        template,
        includeTax,
        userId: req.user?.id
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse('Invoice PDF generation failed', result.error)
        );
      }

      return res.status(201).json(
        createdResponse('Invoice PDF generated successfully', result.invoice)
      );

    } catch (error) {
      logger.error('Invoice PDF generation failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Invoice PDF generation failed', error.message)
      );
    }
  }

  /**
   * Get Invoice
   */
  async getInvoice(req, res) {
    try {
      const { invoiceId } = req.params;

      logger.payment('Getting Invoice', {
        invoiceId,
        userId: req.user?.id
      });

      // Try to get invoice from both providers
      let result = await stripeService.getInvoice(invoiceId);
      
      if (!result.success) {
        result = await paypalService.getInvoice(invoiceId);
      }

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Invoice not found', result.error)
        );
      }

      return res.status(200).json(
        successResponse('Invoice retrieved successfully', result.invoice)
      );

    } catch (error) {
      logger.error('Get Invoice failed', {
        error: error.message,
        invoiceId: req.params.invoiceId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Get Invoice failed', error.message)
      );
    }
  }

  /**
   * Download Invoice PDF
   */
  async downloadInvoicePdf(req, res) {
    try {
      const { invoiceId } = req.params;

      logger.payment('Downloading Invoice PDF', {
        invoiceId,
        userId: req.user?.id
      });

      // Try to get invoice from both providers
      let result = await stripeService.getInvoicePdf(invoiceId);
      
      if (!result.success) {
        result = await paypalService.getInvoicePdf(invoiceId);
      }

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Invoice PDF not found', result.error)
        );
      }

      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      
      return res.send(result.pdfBuffer);

    } catch (error) {
      logger.error('Download Invoice PDF failed', {
        error: error.message,
        invoiceId: req.params.invoiceId,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('Download Invoice PDF failed', error.message)
      );
    }
  }

  /**
   * List Invoices
   */
  async listInvoices(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        provider,
        status,
        customerId
      } = req.query;

      logger.payment('Listing Invoices', {
        page,
        limit,
        provider,
        status,
        customerId,
        userId: req.user?.id
      });

      // Get invoices from Stripe
      const stripeResult = await stripeService.listInvoices({
        page,
        limit,
        status,
        customerId
      });

      // Get invoices from PayPal
      const paypalResult = await paypalService.listInvoices({
        page,
        limit,
        status,
        customerId
      });

      const invoices = [];

      if (stripeResult.success) {
        invoices.push(...stripeResult.invoices.map(i => ({ ...i, provider: 'stripe' })));
      }

      if (paypalResult.success) {
        invoices.push(...paypalResult.invoices.map(i => ({ ...i, provider: 'paypal' })));
      }

      // Filter by provider if specified
      const filteredInvoices = provider 
        ? invoices.filter(i => i.provider === provider)
        : invoices;

      return res.status(200).json(
        successResponse('Invoices retrieved successfully', {
          invoices: filteredInvoices,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredInvoices.length
          }
        })
      );

    } catch (error) {
      logger.error('List Invoices failed', {
        error: error.message,
        userId: req.user?.id
      });
      
      return res.status(500).json(
        errorResponse('List Invoices failed', error.message)
      );
    }
  }

  /**
   * Generate PDF Invoice (internal method)
   */
  async generatePdfInvoice({ transaction, template, includeTax, userId }) {
    try {
      // This would integrate with a PDF generation service
      // For now, return a mock response
      return {
        success: true,
        invoice: {
          id: `inv_${Date.now()}`,
          transactionId: transaction.id,
          template,
          includeTax,
          pdfUrl: `/api/invoices/inv_${Date.now()}/download`,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('PDF Invoice generation failed', {
        error: error.message,
        userId
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new InvoicesController();
