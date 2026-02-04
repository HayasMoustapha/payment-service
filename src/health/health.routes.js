const express = require('express');
const router = express.Router();
const { database } = require('../config/database');
const gatewayManager = require('../core/gateways/gateway-manager.service');

router.get('/', async (req, res) => {
  try {
    await database.query('SELECT 1');
    return res.status(200).json({
      service: 'payment',
      serviceName: 'payment-service',
      status: 'healthy',
      database: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      service: 'payment',
      serviceName: 'payment-service',
      status: 'degraded',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/live', (req, res) => {
  return res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

router.get('/ready', async (req, res) => {
  try {
    await database.query('SELECT 1');
    return res.status(200).json({
      status: 'ready',
      checks: {
        database: 'healthy'
      }
    });
  } catch (error) {
    return res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'unhealthy',
        error: error.message
      }
    });
  }
});

router.get('/components/:component', async (req, res) => {
  const component = req.params.component;
  if (['invoice', 'refund'].includes(component)) {
    return res.status(200).json({
      success: true,
      healthy: true,
      provider: component
    });
  }

  const provider = gatewayManager.getProvider(component);

  if (!provider) {
    return res.status(404).json({
      success: false,
      available: Object.keys(gatewayManager.providers || {})
    });
  }

  return res.status(200).json({
    success: true,
    healthy: true,
    provider: component
  });
});

router.get('/detailed', async (req, res) => {
  try {
    await database.query('SELECT 1');
    return res.status(200).json({
      status: 'healthy',
      dependencies: {
        database: 'healthy'
      },
      services: {
        payment: 'healthy'
      },
      system: {
        uptime: process.uptime()
      }
    });
  } catch (error) {
    return res.status(503).json({
      status: 'degraded',
      dependencies: {
        database: 'unhealthy'
      },
      error: error.message
    });
  }
});

router.get('/providers', (req, res) => {
  return res.status(200).json({
    success: true,
    providers: Object.keys(gatewayManager.providers || {}).reduce((acc, key) => {
      acc[key] = 'connected';
      return acc;
    }, {})
  });
});

router.get('/config', (req, res) => {
  return res.status(200).json({
    success: true,
    config: {
      currency: process.env.DEFAULT_CURRENCY || 'EUR',
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      paypal: Boolean(process.env.PAYPAL_CLIENT_ID)
    }
  });
});

module.exports = router;
