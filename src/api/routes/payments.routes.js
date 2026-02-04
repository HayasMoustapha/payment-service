const express = require('express');
const router = express.Router();
const controller = require('../controllers/payments.controller');
const paymentFlowController = require('../controllers/payment-flow.controller');
const Joi = require('joi');
const { ValidationMiddleware } = require('../../../../shared');

const processPaymentSchema = Joi.object({
  userId: ValidationMiddleware.schemas.id.required(),
  eventId: ValidationMiddleware.schemas.optionalId,
  purchaseId: ValidationMiddleware.schemas.optionalId,
  amount: ValidationMiddleware.schemas.amount,
  currency: ValidationMiddleware.schemas.currency.optional(),
  paymentMethod: Joi.string().required(),
  description: Joi.string().optional(),
  customerEmail: Joi.string().email().optional(),
  customerName: Joi.string().optional(),
  customerPhone: Joi.string().optional(),
  returnUrl: Joi.string().optional(),
  cancelUrl: Joi.string().optional(),
  preferredGateways: Joi.array().items(Joi.string()).optional(),
  metadata: Joi.object().optional()
});

const purchaseTemplateSchema = Joi.object({
  userId: ValidationMiddleware.schemas.id.required(),
  templateId: ValidationMiddleware.schemas.id.required(),
  designerId: ValidationMiddleware.schemas.id.required(),
  amount: ValidationMiddleware.schemas.amount,
  currency: ValidationMiddleware.schemas.currency.optional(),
  paymentMethod: Joi.string().required(),
  description: Joi.string().optional(),
  customerEmail: Joi.string().email().optional(),
  customerName: Joi.string().optional(),
  returnUrl: Joi.string().optional(),
  cancelUrl: Joi.string().optional(),
  metadata: Joi.object().optional()
});

const initiatePaymentSchema = Joi.object({
  payment_intent_id: Joi.string().optional(),
  event_id: ValidationMiddleware.schemas.optionalId,
  organizer_id: ValidationMiddleware.schemas.optionalId,
  user_id: ValidationMiddleware.schemas.optionalId,
  amount: ValidationMiddleware.schemas.amount,
  currency: ValidationMiddleware.schemas.currency,
  payment_method: Joi.string().required(),
  customer_info: Joi.object().optional(),
  metadata: Joi.object().optional()
});

const stripePaymentIntentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().optional(),
  eventId: Joi.string().optional(),
  ticketIds: Joi.array().items(Joi.string()).optional(),
  metadata: Joi.object().optional(),
  customerEmail: Joi.string().email().optional(),
  description: Joi.string().optional(),
  paymentId: Joi.number().optional()
});

const stripeCheckoutSessionSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().optional(),
  eventId: Joi.string().optional(),
  ticketIds: Joi.array().items(Joi.string()).optional(),
  successUrl: Joi.string().required(),
  cancelUrl: Joi.string().required(),
  metadata: Joi.object().optional(),
  customerEmail: Joi.string().email().optional(),
  description: Joi.string().optional(),
  paymentId: Joi.number().optional()
});

const paypalOrderSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().optional(),
  eventId: Joi.string().optional(),
  ticketIds: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().optional(),
  customerEmail: Joi.string().email().optional(),
  returnUrl: Joi.string().optional(),
  cancelUrl: Joi.string().optional(),
  metadata: Joi.object().optional()
});

router.post('/process', ValidationMiddleware.validate(processPaymentSchema), paymentFlowController.processPayment);
router.post('/templates/purchase', ValidationMiddleware.validate(purchaseTemplateSchema), paymentFlowController.purchaseTemplate);
router.post('/initiate', ValidationMiddleware.validate(initiatePaymentSchema), paymentFlowController.initiatePayment);

router.get('/health', paymentFlowController.getPaymentServiceHealth);
router.get('/gateways', paymentFlowController.listGateways);

router.get('/status/:transactionId', ValidationMiddleware.validateParams({
  transactionId: Joi.string().required()
}), paymentFlowController.getPaymentStatus);

router.get('/:paymentId/status', ValidationMiddleware.validateParams({
  paymentId: ValidationMiddleware.schemas.id.required()
}), paymentFlowController.getPaymentStatus);

router.get('/transactions/:transactionId', ValidationMiddleware.validateParams({
  transactionId: Joi.string().required()
}), paymentFlowController.getPaymentStatus);

router.get('/transactions/user/:userId', ValidationMiddleware.validateParams({
  userId: ValidationMiddleware.schemas.id.required()
}), paymentFlowController.listUserTransactions);

router.post('/:paymentId/cancel', ValidationMiddleware.validateParams({
  paymentId: ValidationMiddleware.schemas.id.required()
}), paymentFlowController.cancelPayment);

router.post('/stripe/payment-intent', ValidationMiddleware.validate(stripePaymentIntentSchema), paymentFlowController.createStripePaymentIntent);
router.post('/stripe/checkout-session', ValidationMiddleware.validate(stripeCheckoutSessionSchema), paymentFlowController.createStripeCheckoutSession);

router.post('/paypal/orders', ValidationMiddleware.validate(paypalOrderSchema), paymentFlowController.createPayPalOrder);
router.post('/paypal/orders/:orderId/capture', ValidationMiddleware.validateParams({
  orderId: Joi.string().required()
}), paymentFlowController.capturePayPalOrder);

router.post('/webhooks/stripe', paymentFlowController.handleStripeWebhook);
router.post('/webhooks/paypal', paymentFlowController.handlePayPalWebhook);

router.get('/', ValidationMiddleware.createPaymentServiceValidator('listPayments'), controller.list);

router.get('/:paymentId', ValidationMiddleware.validateParams({
  paymentId: ValidationMiddleware.schemas.id.required()
}), controller.get);

router.post('/', ValidationMiddleware.createPaymentServiceValidator('createPayment'), controller.create);

router.patch(
  '/:paymentId',
  ValidationMiddleware.validateParams({
    paymentId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updatePayment'),
  controller.update
);

router.patch(
  '/:paymentId/status',
  ValidationMiddleware.validateParams({
    paymentId: ValidationMiddleware.schemas.id.required()
  }),
  ValidationMiddleware.createPaymentServiceValidator('updatePaymentStatus'),
  controller.updateStatus
);

router.delete(
  '/:paymentId',
  ValidationMiddleware.validateParams({
    paymentId: ValidationMiddleware.schemas.id.required()
  }),
  controller.delete
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
