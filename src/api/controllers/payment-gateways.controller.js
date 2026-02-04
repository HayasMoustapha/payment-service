const paymentGatewayService = require('../../core/gateways/payment-gateway.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class PaymentGatewaysController {
  async list(req, res) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const gateways = await paymentGatewayService.listGateways({ includeInactive });
      return res.status(200).json(successResponse('Payment gateways retrieved', gateways));
    } catch (error) {
      logger.error('Failed to list payment gateways', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list payment gateways'));
    }
  }

  async get(req, res) {
    try {
      const gateway = await paymentGatewayService.getGateway(req.params.gatewayId);
      if (!gateway) {
        return res.status(404).json(notFoundResponse('PaymentGateway', req.params.gatewayId));
      }
      return res.status(200).json(successResponse('Payment gateway retrieved', gateway));
    } catch (error) {
      logger.error('Failed to get payment gateway', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get payment gateway'));
    }
  }

  async create(req, res) {
    try {
      const gateway = await paymentGatewayService.createGateway(req.body);
      return res.status(201).json(createdResponse('Payment gateway created', gateway));
    } catch (error) {
      logger.error('Failed to create payment gateway', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create payment gateway'));
    }
  }

  async update(req, res) {
    try {
      const gateway = await paymentGatewayService.updateGateway(req.params.gatewayId, req.body);
      if (!gateway) {
        return res.status(404).json(notFoundResponse('PaymentGateway', req.params.gatewayId));
      }
      return res.status(200).json(successResponse('Payment gateway updated', gateway));
    } catch (error) {
      logger.error('Failed to update payment gateway', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to update payment gateway'));
    }
  }

  async delete(req, res) {
    try {
      const gateway = await paymentGatewayService.deleteGateway(req.params.gatewayId);
      if (!gateway) {
        return res.status(404).json(notFoundResponse('Payment gateway', req.params.gatewayId));
      }
      return res.status(200).json(successResponse('Payment gateway deleted', gateway));
    } catch (error) {
      logger.error('Failed to delete payment gateway', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to delete payment gateway'));
    }
  }
}

module.exports = new PaymentGatewaysController();
