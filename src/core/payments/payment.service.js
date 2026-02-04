const { query } = require('../../utils/database-wrapper');
const notificationClient = require('../../../../../shared/clients/notification-client');
const logger = require('../../utils/logger');

class PaymentService {
  async createPayment({
    user_id,
    gateway_id,
    purchase_id = null,
    amount,
    currency,
    payment_method,
    transaction_id = null,
    gateway_response = null,
    status = 'pending'
  }) {
    const result = await query(
      `INSERT INTO payments (
        user_id, gateway_id, purchase_id, amount, currency, status,
        payment_method, transaction_id, gateway_response
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        user_id,
        gateway_id,
        purchase_id,
        amount,
        currency,
        status,
        payment_method,
        transaction_id,
        gateway_response ? JSON.stringify(gateway_response) : null
      ]
    );
    return result.rows[0];
  }

  async getPayment(paymentId) {
    const result = await query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    return result.rows[0] || null;
  }

  async listPayments({ user_id, status, gateway_id, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (user_id !== undefined) {
      clauses.push(`user_id = $${idx++}`);
      values.push(user_id);
    }
    if (status !== undefined) {
      clauses.push(`status = $${idx++}`);
      values.push(status);
    }
    if (gateway_id !== undefined) {
      clauses.push(`gateway_id = $${idx++}`);
      values.push(gateway_id);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM payments ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

  async updatePaymentStatus(paymentId, status) {
    const result = await query(
      `UPDATE payments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, paymentId]
    );
    return result.rows[0] || null;
  }

  async updatePayment(paymentId, fields = {}) {
    const {
      amount,
      currency,
      status,
      payment_method,
      transaction_id,
      gateway_response
    } = fields;

    const result = await query(
      `UPDATE payments
       SET amount = COALESCE($1, amount),
           currency = COALESCE($2, currency),
           status = COALESCE($3, status),
           payment_method = COALESCE($4, payment_method),
           transaction_id = COALESCE($5, transaction_id),
           gateway_response = COALESCE($6, gateway_response)
       WHERE id = $7
       RETURNING *`,
      [
        amount ?? null,
        currency ?? null,
        status ?? null,
        payment_method ?? null,
        transaction_id ?? null,
        gateway_response ? JSON.stringify(gateway_response) : null,
        paymentId
      ]
    );
    return result.rows[0] || null;
  }

  async deletePayment(paymentId) {
    const result = await query('DELETE FROM payments WHERE id = $1 RETURNING *', [paymentId]);
    return result.rows[0] || null;
  }

  async getPaymentByTransactionId(transactionId) {
    const result = await query(
      'SELECT * FROM payments WHERE transaction_id = $1',
      [transactionId]
    );
    return result.rows[0] || null;
  }

  async retryPayment(originalTransactionId, { userId = null } = {}) {
    const original = await this.getPaymentByTransactionId(originalTransactionId);
    if (!original) {
      return { success: false, error: 'Original transaction not found' };
    }
    if (original.status !== 'failed') {
      return { success: false, error: 'Only failed payments can be retried' };
    }

    const newTransactionId = `${originalTransactionId}-retry-${Date.now()}`;
    const result = await query(
      `INSERT INTO payments (
        user_id, gateway_id, purchase_id, amount, currency, status,
        payment_method, transaction_id, gateway_response
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        original.user_id,
        original.gateway_id,
        original.purchase_id,
        original.amount,
        original.currency,
        'pending',
        original.payment_method,
        newTransactionId,
        original.gateway_response
      ]
    );

    return {
      success: true,
      data: {
        originalTransactionId,
        newTransactionId,
        payment: result.rows[0],
        requestedBy: userId
      }
    };
  }

  async getInvoice(invoiceId) {
    let payment = null;
    if (/^\d+$/.test(String(invoiceId))) {
      payment = await this.getPayment(Number(invoiceId));
    }
    if (!payment) {
      payment = await this.getPaymentByTransactionId(invoiceId);
    }
    if (!payment) {
      return null;
    }

    const pdfContent = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >> endobj',
      `4 0 obj << /Length 60 >> stream`,
      `BT /F1 12 Tf 10 100 Td (Invoice ${payment.id} - ${payment.amount} ${payment.currency}) Tj ET`,
      'endstream endobj',
      'xref',
      '0 5',
      '0000000000 65535 f ',
      '0000000010 00000 n ',
      '0000000060 00000 n ',
      '0000000110 00000 n ',
      '0000000210 00000 n ',
      'trailer << /Root 1 0 R /Size 5 >>',
      'startxref',
      '320',
      '%%EOF'
    ].join('\n');

    return {
      pdfBuffer: Buffer.from(pdfContent)
    };
  }

  /**
   * Envoyer une notification de confirmation de paiement
   * @param {Object} paymentData - Données du paiement
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} eventData - Données de l'événement (optionnel)
   */
  async sendPaymentConfirmationNotification(paymentData, userData, eventData = null) {
    try {
      const notificationData = {
        transactionId: paymentData.transaction_id,
        amount: (paymentData.amount / 100).toFixed(2),
        currency: paymentData.currency,
        eventName: eventData?.title || 'Achat de tickets',
        ticketCount: eventData?.ticketCount || 1,
        paymentDate: new Date(paymentData.created_at).toLocaleDateString('fr-FR'),
        invoiceUrl: `${process.env.FRONTEND_URL}/invoices/${paymentData.id}`
      };

      const result = await notificationClient.sendPaymentConfirmationEmail(userData.email, notificationData);
      
      logger.info('Payment confirmation notification sent', {
        paymentId: paymentData.id,
        userId: userData.id,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Failed to send payment confirmation notification', {
        paymentId: paymentData.id,
        userId: userData.id,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification d'échec de paiement
   * @param {Object} paymentData - Données du paiement
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} eventData - Données de l'événement (optionnel)
   * @param {Object} errorData - Données de l'erreur
   */
  async sendPaymentFailureNotification(paymentData, userData, eventData = null, errorData = {}) {
    try {
      const notificationData = {
        firstName: userData.first_name,
        eventName: eventData?.title || 'Achat de tickets',
        ticketCount: eventData?.ticketCount || 1,
        amount: (paymentData.amount / 100).toFixed(2),
        currency: paymentData.currency,
        paymentMethod: paymentData.payment_method,
        transactionId: paymentData.transaction_id,
        errorCode: errorData.code,
        errorMessage: errorData.message,
        errorDetails: errorData.details,
        failedDate: new Date().toLocaleDateString('fr-FR'),
        remainingAttempts: errorData.remainingAttempts || 0,
        canRetry: errorData.canRetry || false,
        retryUrl: `${process.env.FRONTEND_URL}/checkout/retry`,
        eventId: eventData?.id,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      };

      const result = await notificationClient.sendPaymentFailureEmail(userData.email, notificationData);
      
      logger.info('Payment failure notification sent', {
        paymentId: paymentData.id,
        userId: userData.id,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Failed to send payment failure notification', {
        paymentId: paymentData.id,
        userId: userData.id,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification de détection de fraude
   * @param {Object} paymentData - Données du paiement
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} fraudData - Données de la fraude détectée
   */
  async sendFraudDetectionNotification(paymentData, userData, fraudData) {
    try {
      const notificationData = {
        firstName: userData.first_name,
        fraudType: fraudData.type,
        riskLevel: fraudData.riskLevel,
        detectionTime: new Date(fraudData.detectedAt).toLocaleString('fr-FR'),
        incidentId: fraudData.incidentId,
        status: fraudData.status,
        description: fraudData.description,
        affectedTickets: fraudData.affectedTickets,
        suspiciousActivity: fraudData.suspiciousActivity,
        requiresPasswordChange: fraudData.requiresPasswordChange || false,
        requiresAccountReview: fraudData.requiresAccountReview || false,
        requiresContactSupport: fraudData.requiresContactSupport || false,
        requiresTicketValidation: fraudData.requiresTicketValidation || false,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      };

      const result = await notificationClient.sendFraudDetectedEmail(userData.email, notificationData);
      
      logger.info('Fraud detection notification sent', {
        paymentId: paymentData.id,
        userId: userData.id,
        incidentId: fraudData.incidentId,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Failed to send fraud detection notification', {
        paymentId: paymentData.id,
        userId: userData.id,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PaymentService();
