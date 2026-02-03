const refundService = require('../../core/refunds/refund.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class RefundsController {
  async list(req, res) {
    try {
      const { payment_id, status, limit, offset } = req.query;
      const refunds = await refundService.listRefunds({
        payment_id: payment_id ? Number(payment_id) : undefined,
        status,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      return res.status(200).json(successResponse('Refunds retrieved', refunds));
    } catch (error) {
      logger.error('Failed to list refunds', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list refunds'));
    }
  }

  async get(req, res) {
    try {
      const refund = await refundService.getRefund(req.params.refundId);
      if (!refund) {
        return res.status(404).json(notFoundResponse('Refund', req.params.refundId));
      }
      return res.status(200).json(successResponse('Refund retrieved', refund));
    } catch (error) {
      logger.error('Failed to get refund', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get refund'));
    }
  }

  async create(req, res) {
    try {
      const refund = await refundService.createRefund(req.body);
      return res.status(201).json(createdResponse('Refund created', refund));
    } catch (error) {
      logger.error('Failed to create refund', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create refund'));
    }
  }
}

module.exports = new RefundsController();
