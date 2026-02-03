const express = require('express');
const router = express.Router();
const controller = require('../controllers/payments.controller');
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

// ========================================
// ROUTES MANQUANTES POUR LES TEMPLATES EMAIL
// ========================================

/**
 * @swagger
 * /payments/invoices/{invoiceId}:
 *   get:
 *     summary: Télécharger une facture
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier PDF de la facture
 *       404:
 *         description: Facture non trouvée
 */
router.get('/invoices/:invoiceId', 
  ValidationMiddleware.validateParams({
    invoiceId: ValidationMiddleware.schemas.string.required()
  }),
  controller.downloadInvoice
);

/**
 * @swagger
 * /payments/retry/{transactionId}:
 *   post:
 *     summary: Réessayer un paiement échoué
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paiement réessayé
 *       404:
 *         description: Transaction non trouvée
 */
router.post('/retry/:transactionId', 
  ValidationMiddleware.validateParams({
    transactionId: ValidationMiddleware.schemas.string.required()
  }),
  controller.retryPayment
);

module.exports = router;
