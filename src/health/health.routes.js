const express = require('express');
const router = express.Router();
const stripeService = require('../core/stripe/stripe.service');
const paypalService = require('../core/paypal/paypal.service');
const invoiceService = require('../core/invoices/invoice.service');
const refundService = require('../core/refunds/refund.service');
const logger = require('../utils/logger');

/**
 * Routes de santé pour le Payment Service
 */

// GET /health - Health check simple
router.get('/', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'payment',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// GET /health/detailed - Health check détaillé
router.get('/detailed', async (req, res) => {
  try {
    const [stripeHealth, paypalHealth, invoiceHealth, refundHealth] = await Promise.all([
      stripeService.healthCheck(),
      paypalService.healthCheck(),
      invoiceService.healthCheck(),
      refundService.healthCheck()
    ]);

    const detailedStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'payment',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid
      },
      dependencies: {
        redis: await checkRedisConnection(),
        database: await checkDatabaseConnection()
      },
      services: {
        stripe: stripeHealth,
        paypal: paypalHealth,
        invoice: invoiceHealth,
        refund: refundHealth
      },
      overall: {
        healthy: stripeHealth.healthy || paypalHealth.healthy,
        providers: {
          stripe: stripeHealth.healthy,
          paypal: paypalHealth.healthy
        }
      }
    };

    res.status(200).json(detailedStatus);
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error.message
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// GET /health/ready - Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Vérifier que les dépendances critiques sont prêtes
    const redisReady = await checkRedisConnection();
    const databaseReady = await checkDatabaseConnection();
    
    // Vérifier qu'au moins un provider de paiement est prêt
    const [stripeHealth, paypalHealth] = await Promise.all([
      stripeService.healthCheck(),
      paypalService.healthCheck()
    ]);
    
    const paymentsReady = stripeHealth.healthy || paypalHealth.healthy;
    const isReady = redisReady && databaseReady && paymentsReady;
    
    const status = {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisReady,
        database: databaseReady,
        payments: paymentsReady
      },
      providers: {
        stripe: stripeHealth.healthy,
        paypal: paypalHealth.healthy
      }
    };

    res.status(isReady ? 200 : 503).json(status);
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error.message
    });

    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// GET /health/live - Liveness probe
router.get('/live', (req, res) => {
  try {
    const livenessStatus = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      memory: process.memoryUsage()
    };

    res.status(200).json(livenessStatus);
  } catch (error) {
    logger.error('Liveness check failed', {
      error: error.message
    });

    res.status(503).json({
      status: 'not alive',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// GET /health/components/:component - Health check d'un composant spécifique
router.get('/components/:component', async (req, res) => {
  try {
    const { component } = req.params;
    
    let result;
    
    switch (component) {
      case 'stripe':
        result = await stripeService.healthCheck();
        break;
      case 'paypal':
        result = await paypalService.healthCheck();
        break;
      case 'invoice':
        result = await invoiceService.healthCheck();
        break;
      case 'refund':
        result = await refundService.healthCheck();
        break;
      case 'redis':
        const redisStatus = await checkRedisConnection();
        result = {
          success: true,
          healthy: redisStatus,
          connection: redisStatus ? 'connected' : 'disconnected'
        };
        break;
      case 'database':
        const dbStatus = await checkDatabaseConnection();
        result = {
          success: true,
          healthy: dbStatus,
          connection: dbStatus ? 'connected' : 'disconnected'
        };
        break;
      default:
        return res.status(404).json({
          success: false,
          message: `Component ${component} not found`,
          available: ['stripe', 'paypal', 'invoice', 'refund', 'redis', 'database']
        });
    }

    res.status(result.success && result.healthy ? 200 : 503).json(result);
  } catch (error) {
    logger.error(`Component health check failed for ${req.params.component}`, {
      error: error.message
    });

    res.status(503).json({
      success: false,
      healthy: false,
      error: error.message
    });
  }
});

// GET /health/providers - État des providers de paiement
router.get('/providers', async (req, res) => {
  try {
    const [stripeHealth, paypalHealth] = await Promise.all([
      stripeService.healthCheck(),
      paypalService.healthCheck()
    ]);

    const stripeConfig = stripeService.getConfig ? stripeService.getConfig() : {};
    const paypalConfig = paypalService.getConfig ? paypalService.getConfig() : {};

    const stripeConfigured = !!(stripeConfig.secretKey || stripeConfig.apiKey || stripeConfig.clientId);
    const paypalConfigured = !!(paypalConfig.clientId || paypalConfig.clientSecret);

    const providers = {
      stripe: {
        ...stripeHealth,
        configured: stripeConfigured,
        healthy: stripeHealth.healthy && stripeConfigured
      },
      paypal: {
        ...paypalHealth,
        configured: paypalConfigured,
        healthy: paypalHealth.healthy && paypalConfigured
      }
    };

    res.status(200).json({
      success: true,
      providers,
      overall: {
        stripe: providers.stripe.healthy,
        paypal: providers.paypal.healthy,
        any: providers.stripe.healthy || providers.paypal.healthy
      }
    });
  } catch (error) {
    logger.error('Providers health check failed', {
      error: error.message
    });

    res.status(503).json({
      success: false,
      error: error.message
    });
  }
});

// GET /health/config - Configuration du service
router.get('/config', (req, res) => {
  try {
    const config = {
      currency: process.env.CURRENCY || 'EUR',
      minAmount: parseInt(process.env.MIN_AMOUNT) || 100,
      maxAmount: parseInt(process.env.MAX_AMOUNT) || 1000000,
      refundWindowDays: parseInt(process.env.REFUND_WINDOW_DAYS) || 30,
      stripe: {
        configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
        apiVersion: process.env.STRIPE_API_VERSION || '2024-06-20'
      },
      paypal: {
        configured: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
        mode: process.env.PAYPAL_MODE || 'sandbox'
      },
      invoice: {
        prefix: process.env.INVOICE_PREFIX || 'INV',
        taxRate: parseFloat(process.env.INVOICE_TAX_RATE) || 0.20
      },
      features: {
        webhooks: process.env.WEBHOOK_SIGNATURE_VALIDATION === 'true',
        metrics: process.env.ENABLE_METRICS === 'true',
        rateLimiting: true
      }
    };

    res.status(200).json({
      success: true,
      config
    });
  } catch (error) {
    logger.error('Config health check failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /health/test - Test de connectivité
router.post('/test', async (req, res) => {
  try {
    const { component } = req.body;
    
    let result;
    
    switch (component) {
      case 'stripe':
        result = await stripeService.healthCheck();
        break;
      case 'paypal':
        result = await paypalService.healthCheck();
        break;
      case 'invoice':
        result = await invoiceService.healthCheck();
        break;
      case 'refund':
        result = await refundService.healthCheck();
        break;
      case 'redis':
        result = await checkRedisConnection();
        break;
      case 'database':
        result = await checkDatabaseConnection();
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Component must be: stripe, paypal, invoice, refund, redis, or database'
        });
    }

    res.status(result.success || result ? 200 : 503).json({
      success: result.success || result,
      component,
      testedAt: new Date().toISOString(),
      result
    });
  } catch (error) {
    logger.error('Health test failed', {
      error: error.message,
      component: req.body.component
    });

    res.status(503).json({
      success: false,
      error: error.message
    });
  }
});

// GET /health/metrics - Métriques du service
router.get('/metrics', async (req, res) => {
  try {
    const [stripeStats, paypalStats, invoiceStats, refundStats] = await Promise.all([
      stripeService.getStats ? stripeService.getStats() : stripeService.healthCheck(),
      paypalService.getStats ? paypalService.getStats() : paypalService.healthCheck(),
      invoiceService.getStats(),
      refundService.getStats()
    ]);

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      providers: {
        stripe: stripeStats,
        paypal: paypalStats
      },
      services: {
        invoice: invoiceStats,
        refund: refundStats
      },
      configuration: {
        currency: process.env.CURRENCY || 'EUR',
        refundWindowDays: process.env.REFUND_WINDOW_DAYS || 30
      }
    };

    res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Metrics health check failed', {
      error: error.message
    });

    res.status(503).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Vérifie la connexion Redis
 * @returns {Promise<boolean>} True si connecté
 */
async function checkRedisConnection() {
  try {
    // Importer le service Redis si disponible
    // const redis = require('../config/redis');
    // await redis.ping();
    // return true;
    
    // Placeholder pour l'instant
    return true;
  } catch (error) {
    logger.error('Redis connection check failed', {
      error: error.message
    });
    return false;
  }
}

/**
 * Vérifie la connexion à la base de données
 * @returns {Promise<boolean>} True si connectée
 */
async function checkDatabaseConnection() {
  try {
    // Importer la configuration de la base de données
    // const database = require('../config/database');
    // await query('SELECT 1');
    // return true;
    
    // Placeholder pour l'instant
    return true;
  } catch (error) {
    logger.error('Database connection check failed', {
      error: error.message
    });
    return false;
  }
}

module.exports = router;
