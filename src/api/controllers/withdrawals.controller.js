const withdrawalService = require('../../core/withdrawals/withdrawal.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class WithdrawalsController {
  async list(req, res) {
    try {
      const { wallet_id, status, limit, offset } = req.query;
      const withdrawals = await withdrawalService.listWithdrawals({
        wallet_id: wallet_id ? Number(wallet_id) : undefined,
        status,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      return res.status(200).json(successResponse('Withdrawals retrieved', withdrawals));
    } catch (error) {
      logger.error('Failed to list withdrawals', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list withdrawals'));
    }
  }

  async get(req, res) {
    try {
      const withdrawal = await withdrawalService.getWithdrawal(req.params.withdrawalId);
      if (!withdrawal) {
        return res.status(404).json(notFoundResponse('Withdrawal', req.params.withdrawalId));
      }
      return res.status(200).json(successResponse('Withdrawal retrieved', withdrawal));
    } catch (error) {
      logger.error('Failed to get withdrawal', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get withdrawal'));
    }
  }

  async create(req, res) {
    try {
      const withdrawal = await withdrawalService.createWithdrawal(req.body);
      return res.status(201).json(createdResponse('Withdrawal created', withdrawal));
    } catch (error) {
      logger.error('Failed to create withdrawal', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create withdrawal'));
    }
  }

  async updateStatus(req, res) {
    try {
      const withdrawal = await withdrawalService.updateStatus(
        req.params.withdrawalId,
        req.body.status,
        req.body.processed_at
      );
      if (!withdrawal) {
        return res.status(404).json(notFoundResponse('Withdrawal', req.params.withdrawalId));
      }
      return res.status(200).json(successResponse('Withdrawal status updated', withdrawal));
    } catch (error) {
      logger.error('Failed to update withdrawal status', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to update withdrawal status'));
    }
  }
}

module.exports = new WithdrawalsController();
