/**
 * 💳 PAYMENT SERVICE - SERVEUR PRINCIPAL (MODE DEBUG)
 * 
 * Version simplifiée pour identifier les erreurs
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const logger = require('./utils/logger');
const healthRoutes = require('./health/health.routes');

class PaymentServer {
  constructor() {
    this.app = express();
    this.server = null;
    // Forcer le port 3003 pour le payment-service
    this.port = 3003;
  }

  async start() {
    try {
      logger.info('Starting Payment Service (Debug Mode)...');

      // Configuration de base
      this.app.use(cors());
      this.app.use(compression());
      this.app.use(express.json({ limit: '10mb' }));
      this.app.use(express.urlencoded({ extended: true }));
      this.app.use(morgan('combined'));

      // Routes de base seulement
      this.app.use('/health', healthRoutes);

      // Ajout des routes payments pour test
      try {
        const paymentsRoutes = require('./api/routes/payments.routes');
        this.app.use('/api/payments', paymentsRoutes);
        logger.info('Payments routes loaded successfully');
      } catch (error) {
        logger.error('Failed to load payments routes:', error);
      }

      // Ajout des routes wallets pour test
      try {
        const walletsRoutes = require('./api/routes/wallets.routes');
        this.app.use('/api/wallets', walletsRoutes);
        logger.info('Wallets routes loaded successfully');
      } catch (error) {
        logger.error('Failed to load wallets routes:', error);
      }

      // Route de test
      this.app.get('/', (req, res) => {
        res.json({
          service: 'Payment Service',
          status: 'running',
          mode: 'debug',
          timestamp: new Date().toISOString()
        });
      });

      // Démarrage du serveur
      this.server = this.app.listen(this.port, () => {
        logger.info(`Payment Service running on port ${this.port}`);
        console.log(`🚀 Payment Service running on http://localhost:${this.port}`);
      });

      return this.server;

    } catch (error) {
      logger.error('Failed to start Payment Service:', error);
      throw error;
    }
  }
}

// Démarrage si ce fichier est exécuté directement
if (require.main === module) {
  const paymentServer = new PaymentServer();
  paymentServer.start().catch(error => {
    console.error('❌ Failed to start Payment Service:', error.message);
    process.exit(1);
  });
}

module.exports = PaymentServer;
