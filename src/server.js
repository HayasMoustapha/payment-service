/**
 * PAYMENT SERVICE - SERVEUR PRINCIPAL
 *
 * L'app Express est configuree des la construction pour que les tests
 * d'integration puissent monter les routes sans demarrer le serveur HTTP.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const logger = require('./utils/logger');
const healthRoutes = require('./health/health.routes');
const bootstrap = require('./bootstrap');

const paymentsRoutes = require('./api/routes/payments.routes');
const paymentMethodsRoutes = require('./api/routes/payment-methods.routes');
const gatewaysRoutes = require('./api/routes/payment-gateways.routes');
const commissionsRoutes = require('./api/routes/commissions.routes');
const refundsRoutes = require('./api/routes/refunds.routes');
const walletsRoutes = require('./api/routes/wallets.routes');
const withdrawalsRoutes = require('./api/routes/withdrawals.routes');

class PaymentServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 3003;
    this.routesConfigured = false;

    this.configureApp();
  }

  configureApp() {
    if (this.routesConfigured) {
      return;
    }

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

    this.app.use('/health', healthRoutes);

    this.app.use('/api/payments', paymentsRoutes);
    this.app.use('/api/payment-methods', paymentMethodsRoutes);
    this.app.use('/api/payment-gateways', gatewaysRoutes);
    this.app.use('/api/commissions', commissionsRoutes);
    this.app.use('/api/wallets', walletsRoutes);
    this.app.use('/api/refunds', refundsRoutes);
    this.app.use('/api/withdrawals', withdrawalsRoutes);

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

    const { specs: swaggerSpecs, swaggerUi, swaggerUiOptions } = require('./config/swagger');
    this.app.use('/docs', swaggerUi.serve);
    this.app.get('/docs', swaggerUi.setup(swaggerSpecs, swaggerUiOptions));

    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path
      });
    });

    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });

    this.routesConfigured = true;
  }

  async start() {
    try {
      logger.info('Starting Payment Service...');

      console.log('Starting Payment Service bootstrap...');
      await bootstrap.initialize();
      console.log('Payment Service bootstrap completed');

      this.server = this.app.listen(this.port, () => {
        logger.info(`Payment Service running on port ${this.port}`);
        console.log(`Payment Service running on http://localhost:${this.port}`);
        console.log(`API documentation: http://localhost:${this.port}/docs`);
        console.log(`Health check: http://localhost:${this.port}/health`);
        console.log(`Database: ${process.env.DB_NAME || 'event_planner_payments'}`);
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start Payment Service:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  const paymentServer = new PaymentServer();
  paymentServer.start().catch((error) => {
    console.error('Failed to start Payment Service:', error.message);
    process.exit(1);
  });
}

module.exports = PaymentServer;

const testServerInstance = new PaymentServer();
module.exports.app = testServerInstance.app;
