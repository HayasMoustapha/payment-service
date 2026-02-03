const walletService = require('../../core/wallets/wallet.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class WalletsController {
  async create(req, res) {
    try {
      const wallet = await walletService.createWallet(req.body);
      return res.status(201).json(createdResponse('Wallet created', wallet));
    } catch (error) {
      logger.error('Failed to create wallet', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to create wallet'));
    }
  }

  async get(req, res) {
    try {
      const wallet = await walletService.getWallet(req.params.walletId);
      if (!wallet) {
        return res.status(404).json(notFoundResponse('Wallet', req.params.walletId));
      }
      return res.status(200).json(successResponse('Wallet retrieved', wallet));
    } catch (error) {
      logger.error('Failed to get wallet', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get wallet'));
    }
  }

  async getByDesigner(req, res) {
    try {
      const wallet = await walletService.getWalletByDesigner(req.params.designerId);
      if (!wallet) {
        return res.status(404).json(notFoundResponse('Wallet', req.params.designerId));
      }
      return res.status(200).json(successResponse('Wallet retrieved', wallet));
    } catch (error) {
      logger.error('Failed to get wallet by designer', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to get wallet by designer'));
    }
  }
}

module.exports = new WalletsController();
