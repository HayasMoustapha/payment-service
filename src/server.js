/**
 * 💳 PAYMENT SERVICE - SERVEUR PRINCIPAL CORRIGÉ
 * 
 * Basé sur la version debug qui fonctionne + bootstrap
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
// Importation des modules locaux
const logger = require('./utils/logger');
const healthRoutes = require('./health/health.routes');
const bootstrap = require('./bootstrap'); // Initialisation de la base de données

const paymentsRoutes = require('./api/routes/payments.routes');
const gatewaysRoutes = require('./api/routes/payment-gateways.routes');
const commissionsRoutes = require('./api/routes/commissions.routes');
const refundsRoutes = require('./api/routes/refunds.routes');
const walletsRoutes = require('./api/routes/wallets.routes');
const withdrawalsRoutes = require('./api/routes/withdrawals.routes');

class PaymentServer {
  constructor() {
    this.app = express();
    this.server = null;
    // Forcer le port 3003 pour le payment-service
    this.port = 3003;
  }

  async start() {
    try {
      logger.info('Starting Payment Service...');

      // 🚀 Bootstrap automatique de la base de données
      console.log('🚀 Starting Payment Service bootstrap...');
      await bootstrap.initialize();
      console.log('✅ Payment Service bootstrap completed');

      // Configuration de base
      this.app.use(cors());
      this.app.use(compression());
      this.app.use(express.json({
        limit: '10mb',
        verify: (req, res, buf) => {
          req.rawBody = buf;
        }
      }));
      this.app.use(express.urlencoded({ extended: true }));
      this.app.use(morgan('combined'));

      // Routes de base
      this.app.use('/health', healthRoutes);

      // Routes API avec gestion d'erreur
      this.app.use('/api/payments', paymentsRoutes);
      this.app.use('/api/payment-gateways', gatewaysRoutes);
      this.app.use('/api/commissions', commissionsRoutes);
      this.app.use('/api/wallets', walletsRoutes);
      this.app.use('/api/refunds', refundsRoutes);
      this.app.use('/api/withdrawals', withdrawalsRoutes);

      // Route de test
      this.app.get('/', (req, res) => {
        res.json({
          service: 'Payment Service',
          status: 'running',
          port: this.port,
          database: 'event_planner_payments',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      });

      // Documentation Swagger — http://localhost:3003/docs
      const { specs: swaggerSpecs, swaggerUi, swaggerUiOptions } = require('./config/swagger');
      this.app.use('/docs', swaggerUi.serve);
      this.app.get('/docs', swaggerUi.setup(swaggerSpecs, swaggerUiOptions));

      // 404 handler
      this.app.use((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Route not found',
          path: req.path
        });
      });

      // Global error handler
      this.app.use((error, req, res, next) => {
        logger.error('Unhandled error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
      });

      // Démarrage du serveur
      this.server = this.app.listen(this.port, () => {
        logger.info(`Payment Service running on port ${this.port}`);
        console.log(`🚀 Payment Service running on http://localhost:${this.port}`);
        console.log(`📚 API documentation: http://localhost:${this.port}/api`);
        console.log(`💚 Health check: http://localhost:${this.port}/health`);
        console.log(`💳 Database: ${process.env.DB_NAME || 'event_planner_payments'}`);
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

// Export de la classe pour utilisation directe
module.exports = PaymentServer;

// Export de l'app Express pour les tests
const testServerInstance = new PaymentServer();
module.exports.app = testServerInstance.app;
