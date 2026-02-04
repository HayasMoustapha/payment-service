const walletService = require('../../core/wallets/wallet.service');
const { successResponse, createdResponse, notFoundResponse, serverErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class WalletsController {
  async list(req, res) {
    try {
      const { designer_id, limit, offset } = req.query;
      const wallets = await walletService.listWallets({
        designer_id: designer_id ? Number(designer_id) : undefined,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      return res.status(200).json(successResponse('Wallets retrieved', wallets));
    } catch (error) {
      logger.error('Failed to list wallets', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to list wallets'));
    }
  }
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

  async update(req, res) {
    try {
      const wallet = await walletService.updateWallet(req.params.walletId, req.body);
      if (!wallet) {
        return res.status(404).json(notFoundResponse('Wallet', req.params.walletId));
      }
      return res.status(200).json(successResponse('Wallet updated', wallet));
    } catch (error) {
      logger.error('Failed to update wallet', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to update wallet'));
    }
  }

  async delete(req, res) {
    try {
      const wallet = await walletService.deleteWallet(req.params.walletId);
      if (!wallet) {
        return res.status(404).json(notFoundResponse('Wallet', req.params.walletId));
      }
      return res.status(200).json(successResponse('Wallet deleted', wallet));
    } catch (error) {
      logger.error('Failed to delete wallet', { error: error.message });
      return res.status(500).json(serverErrorResponse('Failed to delete wallet'));
    }
  }
}

module.exports = new WalletsController();
