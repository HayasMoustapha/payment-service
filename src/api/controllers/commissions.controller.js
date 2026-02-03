const commissionService = require('../../core/commissions/commission.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class CommissionsController {
  async create(req, res) {
    try {
      const commission = await commissionService.createCommission(req.body);
      return res.status(201).json(createdResponse('Commission created', commission));
    } catch (error) {
      logger.error('Failed to create commission', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create commission'));
    }
  }

  async get(req, res) {
    try {
      const commission = await commissionService.getCommission(req.params.commissionId);
      if (!commission) {
        return res.status(404).json(notFoundResponse('Commission', req.params.commissionId));
      }
      return res.status(200).json(successResponse('Commission retrieved', commission));
    } catch (error) {
      logger.error('Failed to get commission', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get commission'));
    }
  }

  async getByPayment(req, res) {
    try {
      const commission = await commissionService.getCommissionByPayment(req.params.paymentId);
      if (!commission) {
        return res.status(404).json(notFoundResponse('Commission', req.params.paymentId));
      }
      return res.status(200).json(successResponse('Commission retrieved', commission));
    } catch (error) {
      logger.error('Failed to get commission by payment', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get commission by payment'));
    }
  }
}

module.exports = new CommissionsController();
