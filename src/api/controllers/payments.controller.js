const paymentService = require('../../core/payments/payment.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class PaymentsController {
  async list(req, res) {
    try {
      const { user_id, status, gateway_id, limit, offset } = req.query;
      const payments = await paymentService.listPayments({
        user_id: user_id ? Number(user_id) : undefined,
        status,
        gateway_id: gateway_id ? Number(gateway_id) : undefined,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      return res.status(200).json(successResponse('Payments retrieved', payments));
    } catch (error) {
      logger.error('Failed to list payments', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list payments'));
    }
  }

  async get(req, res) {
    try {
      const payment = await paymentService.getPayment(req.params.paymentId);
      if (!payment) {
        return res.status(404).json(notFoundResponse('Payment', req.params.paymentId));
      }
      return res.status(200).json(successResponse('Payment retrieved', payment));
    } catch (error) {
      logger.error('Failed to get payment', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get payment'));
    }
  }

  async create(req, res) {
    try {
      const payment = await paymentService.createPayment(req.body);
      return res.status(201).json(createdResponse('Payment created', payment));
    } catch (error) {
      logger.error('Failed to create payment', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create payment'));
    }
  }

  async updateStatus(req, res) {
    try {
      const payment = await paymentService.updatePaymentStatus(req.params.paymentId, req.body.status);
      if (!payment) {
        return res.status(404).json(notFoundResponse('Payment', req.params.paymentId));
      }
      return res.status(200).json(successResponse('Payment status updated', payment));
    } catch (error) {
      logger.error('Failed to update payment status', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to update payment status'));
    }
  }

  // ========================================
  // MÉTHODES MANQUANTES POUR LES TEMPLATES EMAIL
  // ========================================

  async downloadInvoice(req, res) {
    try {
      const { invoiceId } = req.params;
      
      // Récupérer la facture depuis le service
      const invoiceData = await paymentService.getInvoice(invoiceId);
      
      if (!invoiceData) {
        return res.status(404).json(notFoundResponse('Invoice', invoiceId));
      }

      // Envoyer le fichier PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      res.send(invoiceData.pdfBuffer);
    } catch (error) {
      logger.error('Failed to download invoice', { 
        invoiceId: req.params.invoiceId,
        error: error.message 
      });
      return res.status(500).json(serverErrorResponse('Failed to download invoice'));
    }
  }

  async retryPayment(req, res) {
    try {
      const { transactionId } = req.params;
      
      // Récupérer la transaction originale
      const originalTransaction = await paymentService.getPaymentByTransactionId(transactionId);
      
      if (!originalTransaction) {
        return res.status(404).json(notFoundResponse('Transaction', transactionId));
      }

      // Vérifier que le paiement peut être réessayé
      if (originalTransaction.status !== 'failed') {
        return res.status(400).json({
          success: false,
          error: 'Payment cannot be retried',
          message: 'Only failed payments can be retried',
          code: 'INVALID_PAYMENT_STATUS'
        });
      }

      // Créer une nouvelle tentative de paiement
      const retryResult = await paymentService.retryPayment(transactionId, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      if (!retryResult.success) {
        return res.status(400).json({
          success: false,
          error: retryResult.error,
          message: 'Failed to retry payment',
          code: 'PAYMENT_RETRY_FAILED'
        });
      }

      return res.status(200).json(successResponse('Payment retry initiated', retryResult.data));
    } catch (error) {
      logger.error('Failed to retry payment', { 
        transactionId: req.params.transactionId,
        error: error.message 
      });
      return res.status(500).json(serverErrorResponse('Failed to retry payment'));
    }
  }
}

module.exports = new PaymentsController();
