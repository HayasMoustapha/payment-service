const express = require('express');

const router = express.Router();

const { database } = require('../config/database');
const gatewayManager = require('../core/gateways/gateway-manager.service');

const REQUIRED_TABLES = [
  'payments',
  'payment_methods',
  'payment_gateways',
  'commissions',
  'refunds',
  'wallets',
  'withdrawals',
];

const REQUIRED_GATEWAY_CODES = ['stripe', 'paypal', 'orange_money', 'mtn_momo'];

async function inspectReadiness() {
  await database.query('SELECT 1');

  const tablesResult = await database.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES],
  );

  const presentTables = new Set(tablesResult.rows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !presentTables.has(tableName));

  let missingGatewayCodes = [...REQUIRED_GATEWAY_CODES];

  if (!missingTables.includes('payment_gateways')) {
    const gatewayResult = await database.query(
      `SELECT code
         FROM payment_gateways
        WHERE code = ANY($1::text[])`,
      [REQUIRED_GATEWAY_CODES],
    );

    const presentGatewayCodes = new Set(
      gatewayResult.rows.map((row) => String(row.code || '').trim().toLowerCase()),
    );

    missingGatewayCodes = REQUIRED_GATEWAY_CODES.filter(
      (code) => !presentGatewayCodes.has(code),
    );
  }

  return {
    missingTables,
    missingGatewayCodes,
    ready: missingTables.length === 0 && missingGatewayCodes.length === 0,
  };
}

function buildReadinessPayload(readiness) {
  return {
    schema: readiness.ready ? 'ready' : 'incomplete',
    missingTables: readiness.missingTables,
    missingGatewayCodes: readiness.missingGatewayCodes,
  };
}

router.get('/', async (req, res) => {
  try {
    const readiness = await inspectReadiness();
    const healthy = readiness.ready;

    return res.status(healthy ? 200 : 503).json({
      service: 'payment',
      serviceName: 'payment-service',
      status: healthy ? 'healthy' : 'degraded',
      database: 'ok',
      ...buildReadinessPayload(readiness),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      service: 'payment',
      serviceName: 'payment-service',
      status: 'degraded',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/live', (req, res) => {
  return res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (req, res) => {
  try {
    const readiness = await inspectReadiness();
    return res.status(readiness.ready ? 200 : 503).json({
      status: readiness.ready ? 'ready' : 'not_ready',
      checks: {
        database: 'healthy',
        schema: readiness.ready ? 'healthy' : 'incomplete',
        missingTables: readiness.missingTables,
        missingGatewayCodes: readiness.missingGatewayCodes,
      },
    });
  } catch (error) {
    return res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'unhealthy',
        error: error.message,
      },
    });
  }
});

router.get('/components/:component', async (req, res) => {
  const component = req.params.component;
  if (['invoice', 'refund'].includes(component)) {
    return res.status(200).json({
      success: true,
      healthy: true,
      provider: component,
    });
  }

  const provider = gatewayManager.getProvider(component);

  if (!provider) {
    return res.status(404).json({
      success: false,
      available: Object.keys(gatewayManager.providers || {}),
    });
  }

  return res.status(200).json({
    success: true,
    healthy: true,
    provider: component,
  });
});

router.get('/detailed', async (req, res) => {
  try {
    const readiness = await inspectReadiness();
    return res.status(readiness.ready ? 200 : 503).json({
      status: readiness.ready ? 'healthy' : 'degraded',
      dependencies: {
        database: 'healthy',
        schema: readiness.ready ? 'healthy' : 'incomplete',
      },
      services: {
        payment: readiness.ready ? 'healthy' : 'degraded',
      },
      readiness: buildReadinessPayload(readiness),
      system: {
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    return res.status(503).json({
      status: 'degraded',
      dependencies: {
        database: 'unhealthy',
      },
      error: error.message,
    });
  }
});

router.get('/providers', (req, res) => {
  return res.status(200).json({
    success: true,
    providers: Object.keys(gatewayManager.providers || {}).reduce((acc, key) => {
      acc[key] = 'connected';
      return acc;
    }, {}),
  });
});

router.get('/config', (req, res) => {
  return res.status(200).json({
    success: true,
    config: {
      currency: process.env.DEFAULT_CURRENCY || 'EUR',
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      paypal: Boolean(process.env.PAYPAL_CLIENT_ID),
    },
  });
});

module.exports = router;
