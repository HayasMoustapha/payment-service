const { query } = require('../../utils/database-wrapper');
const notificationClient = require("../../../../shared/clients/notification-client");
const logger = require('../../utils/logger');

class RefundService {
  async createRefund({ payment_id, amount, reason = null, status = 'pending', processed_at = null }) {
    const result = await query(
      `INSERT INTO refunds (payment_id, amount, reason, status, processed_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [payment_id, amount, reason, status, processed_at]
    );
    return result.rows[0];
  }

  async getRefund(refundId) {
    const result = await query('SELECT * FROM refunds WHERE id = $1', [refundId]);
    return result.rows[0] || null;
  }

  async listRefunds({ payment_id, status, limit = 50, offset = 0 } = {}) {
    const clauses = [];
    const values = [];
    let idx = 1;

    if (payment_id !== undefined) {
      clauses.push(`payment_id = $${idx++}`);
      values.push(payment_id);
    }
    if (status !== undefined) {
      clauses.push(`status = $${idx++}`);
      values.push(status);
    }

    values.push(limit);
    values.push(offset);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM refunds ${where} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    return result.rows;
  }

  async updateRefund(refundId, { status, processed_at, reason, amount }) {
    const result = await query(
      `UPDATE refunds
       SET status = COALESCE($1, status),
           processed_at = COALESCE($2, processed_at),
           reason = COALESCE($3, reason),
           amount = COALESCE($4, amount)
       WHERE id = $5
       RETURNING *`,
      [status ?? null, processed_at ?? null, reason ?? null, amount ?? null, refundId]
    );
    return result.rows[0] || null;
  }

  async deleteRefund(refundId) {
    const result = await query('DELETE FROM refunds WHERE id = $1 RETURNING *', [refundId]);
    return result.rows[0] || null;
  }

  /**
   * Envoyer une notification de remboursement traité
   * @param {Object} refundData - Données du remboursement
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} paymentData - Données du paiement original
   * @param {Object} eventData - Données de l'événement (optionnel)
   */
  async sendRefundProcessedNotification(refundData, userData, paymentData, eventData = null) {
    try {
      const notificationData = {
        firstName: userData.first_name,
        amount: (refundData.amount / 100).toFixed(2),
        currency: refundData.currency || paymentData.currency,
        refundId: refundData.id,
        originalTransactionId: paymentData.transaction_id,
        processedDate: new Date(refundData.processed_at).toLocaleDateString('fr-FR'),
        status: refundData.status,
        eventName: eventData?.title || 'Achat de tickets',
        ticketCount: eventData?.ticketCount || 1,
        originalAmount: (paymentData.amount / 100).toFixed(2),
        originalDate: new Date(paymentData.created_at).toLocaleDateString('fr-FR'),
        paymentMethod: paymentData.payment_method,
        refundReason: refundData.reason,
        invoiceUrl: `${process.env.FRONTEND_URL}/invoices/${paymentData.id}`,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      };

      const result = await notificationClient.sendRefundProcessedEmail(userData.email, notificationData);
      
      logger.info('Refund processed notification sent', {
        refundId: refundData.id,
        userId: userData.id,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Failed to send refund processed notification', {
        refundId: refundData.id,
        userId: userData.id,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RefundService();
