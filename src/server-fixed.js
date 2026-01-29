/**
 * 💳 PAYMENT SERVICE - SERVEUR PRINCIPAL CORRIGÉ
 * 
 * Basé sur la version debug qui fonctionne
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rawBody = require('raw-body');

// Importation des modules locaux
const logger = require('./utils/logger');
const healthRoutes = require('./health/health.routes');

// Importation des routes avec gestion d'erreur
let paymentsRoutes, walletsRoutes, invoicesRoutes, paymentMethodsRoutes, refundsRoutes, paypalRoutes, stripeRoutes;

try {
  paymentsRoutes = require('./api/routes/payments.routes');
} catch (error) {
  logger.error('Failed to load payments routes:', error);
  paymentsRoutes = express.Router(); // Router vide
}

try {
  walletsRoutes = require('./api/routes/wallets.routes');
} catch (error) {
  logger.error('Failed to load wallets routes:', error);
  walletsRoutes = express.Router(); // Router vide
}

try {
  invoicesRoutes = require('./api/routes/invoices.routes');
} catch (error) {
  logger.error('Failed to load invoices routes:', error);
  invoicesRoutes = express.Router(); // Router vide
}

try {
  paymentMethodsRoutes = require('./api/routes/payment-methods.routes');
} catch (error) {
  logger.error('Failed to load payment-methods routes:', error);
  paymentMethodsRoutes = express.Router(); // Router vide
}

try {
  refundsRoutes = require('./api/routes/refunds.routes');
} catch (error) {
  logger.error('Failed to load refunds routes:', error);
  refundsRoutes = express.Router(); // Router vide
}

try {
  paypalRoutes = require('./api/routes/paypal.routes');
} catch (error) {
  logger.error('Failed to load paypal routes:', error);
  paypalRoutes = express.Router(); // Router vide
}

try {
  stripeRoutes = require('./api/routes/stripe.routes');
} catch (error) {
  logger.error('Failed to load stripe routes:', error);
  stripeRoutes = express.Router(); // Router vide
}

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

      // Configuration de base
      this.app.use(cors());
      this.app.use(compression());
      this.app.use(express.json({ limit: '10mb' }));
      this.app.use(express.urlencoded({ extended: true }));
      this.app.use(morgan('combined'));

      // Middleware pour raw body (webhooks)
      this.app.use('/api/webhooks', (req, res, next) => {
        if (req.is('application/json')) {
          rawBody(req, {
            encoding: 'utf8',
            limit: '1mb'
          }, (err, body) => {
            if (err) return next(err);
            req.rawBody = body;
            next();
          });
        } else {
          next();
        }
      });

      // Routes de base
      this.app.use('/health', healthRoutes);

      // Routes API avec gestion d'erreur
      this.app.use('/api/payments', paymentsRoutes);
      this.app.use('/api/wallets', walletsRoutes);
      this.app.use('/api/invoices', invoicesRoutes);
      this.app.use('/api/payment-methods', paymentMethodsRoutes);
      this.app.use('/api/refunds', refundsRoutes);
      this.app.use('/api/paypal', paypalRoutes);
      this.app.use('/api/stripe', stripeRoutes);

      // Route de test
      this.app.get('/', (req, res) => {
        res.json({
          service: 'Payment Service',
          status: 'running',
          port: this.port,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      });

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
