const express = require('express');
const Joi = require('joi');

const controller = require('../controllers/payment-methods.controller');
const { ValidationMiddleware } = require('../../../../shared');

const router = express.Router();

const cardSchema = Joi.object({
  brand: Joi.string().max(50).optional(),
  last4: Joi.string().pattern(/^\d{4}$/).optional(),
  exp_month: Joi.number().integer().min(1).max(12).optional(),
  exp_year: Joi.number().integer().min(new Date().getFullYear()).max(new Date().getFullYear() + 25).optional(),
  holder_name: Joi.string().max(255).optional(),
  number: Joi.forbidden(),
  cvc: Joi.forbidden(),
  cvv: Joi.forbidden(),
}).optional();

const billingSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().max(50).optional(),
  address_line1: Joi.string().max(255).optional(),
  address_line2: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  postal_code: Joi.string().max(50).optional(),
  country: Joi.string().length(2).optional(),
}).optional();

const walletSchema = Joi.object({
  mobile_number: Joi.string().max(50).optional(),
  reference: Joi.string().max(255).optional(),
}).optional();

const paymentMethodCreateSchema = Joi.object({
  user_id: ValidationMiddleware.schemas.id.required(),
  provider_code: Joi.string().required(),
  type: Joi.string().valid('card', 'paypal', 'mobile_money', 'wallet').required(),
  label: Joi.string().max(255).required(),
  is_default: Joi.boolean().optional(),
  external_customer_id: Joi.string().max(255).optional().allow('', null),
  external_method_id: Joi.string().max(255).optional().allow('', null),
  token_reference: Joi.string().max(255).optional().allow('', null),
  card: cardSchema,
  billing: billingSchema,
  wallet: walletSchema,
  metadata: Joi.object().optional(),
  card_number: Joi.forbidden(),
  number: Joi.forbidden(),
  cvc: Joi.forbidden(),
  cvv: Joi.forbidden(),
});

const paymentMethodUpdateSchema = Joi.object({
  user_id: ValidationMiddleware.schemas.id.required(),
  provider_code: Joi.string().optional(),
  type: Joi.string().valid('card', 'paypal', 'mobile_money', 'wallet').optional(),
  label: Joi.string().max(255).optional(),
  is_default: Joi.boolean().optional(),
  external_customer_id: Joi.string().max(255).optional().allow('', null),
  external_method_id: Joi.string().max(255).optional().allow('', null),
  token_reference: Joi.string().max(255).optional().allow('', null),
  card: cardSchema,
  billing: billingSchema,
  wallet: walletSchema,
  metadata: Joi.object().optional(),
  card_number: Joi.forbidden(),
  number: Joi.forbidden(),
  cvc: Joi.forbidden(),
  cvv: Joi.forbidden(),
}).min(2);

router.get('/', controller.list);
router.post(
  '/',
  ValidationMiddleware.validate(paymentMethodCreateSchema),
  controller.create,
);
router.patch(
  '/:paymentMethodId',
  ValidationMiddleware.validateParams({
    paymentMethodId: ValidationMiddleware.schemas.id.required(),
  }),
  ValidationMiddleware.validate(paymentMethodUpdateSchema),
  controller.update,
);
router.delete(
  '/:paymentMethodId',
  ValidationMiddleware.validateParams({
    paymentMethodId: ValidationMiddleware.schemas.id.required(),
  }),
  controller.delete,
);

module.exports = router;
