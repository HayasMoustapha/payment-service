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

const PROVIDER_DEFINITIONS = {
  stripe: {
    type: 'real',
    requiredConfig: ['STRIPE_SECRET_KEY'],
  },
  paypal: {
    type: 'real',
    requiredConfig: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  },
  cinetpay: {
    type: 'real',
    requiredConfig: ['CINETPAY_BASE_URL', 'CINETPAY_INITIATE_PATH', 'CINETPAY_API_KEY', 'CINETPAY_SITE_ID'],
  },
  paydunya: {
    type: 'real',
    requiredConfig: [
      'PAYDUNYA_BASE_URL',
      'PAYDUNYA_INITIATE_PATH',
      'PAYDUNYA_MASTER_KEY',
      'PAYDUNYA_PRIVATE_KEY',
      'PAYDUNYA_PUBLIC_KEY',
      'PAYDUNYA_TOKEN',
    ],
  },
  paygate: {
    type: 'real',
    requiredConfig: ['PAYGATE_BASE_URL', 'PAYGATE_INITIATE_PATH', 'PAYGATE_API_KEY', 'PAYGATE_TOKEN'],
  },
  mtn_momo: {
    type: 'real',
    requiredConfig: [
      'MTN_MOMO_BASE_URL',
      'MTN_MOMO_INITIATE_PATH',
      'MTN_MOMO_API_KEY',
      'MTN_MOMO_SUBSCRIPTION_KEY',
      'MTN_MOMO_USER_ID',
    ],
  },
  orange_money: {
    type: 'real',
    requiredConfig: [
      'ORANGE_MONEY_BASE_URL',
      'ORANGE_MONEY_INITIATE_PATH',
      'ORANGE_MONEY_API_KEY',
      'ORANGE_MONEY_TOKEN',
    ],
  },
  mycoolpay: {
    type: 'real',
    requiredConfig: ['MYCOOLPAY_BASE_URL', 'MYCOOLPAY_INITIATE_PATH', 'MYCOOLPAY_API_KEY', 'MYCOOLPAY_TOKEN'],
  },
  mock: {
    type: 'mock',
    requiredConfig: [],
  },
};

function normalizeConfigValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderConfigValue(value) {
  const normalized = normalizeConfigValue(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  const placeholderPatterns = [
    'your_',
    'your-',
    'change_me',
    'changeme',
    'replace_me',
    'placeholder',
    'dummy',
    'sample',
    'example.com',
    'example.org',
    'example.net',
    'sk_test_your_',
    'pk_test_your_',
    'whsec_your_',
    'your_paypal_',
    'your_payment_',
  ];

  return placeholderPatterns.some((pattern) => normalized.includes(pattern));
}

function inspectConfigKeys(keys = []) {
  const presentConfig = [];
  const missingConfig = [];
  const placeholderConfig = [];

  for (const key of keys) {
    const normalized = normalizeConfigValue(process.env[key]);

    if (!normalized) {
      missingConfig.push(key);
      continue;
    }

    if (isPlaceholderConfigValue(normalized)) {
      placeholderConfig.push(key);
      continue;
    }

    presentConfig.push(key);
  }

  return { presentConfig, missingConfig, placeholderConfig };
}

function getProviderStatus(providerCode) {
  const definition = PROVIDER_DEFINITIONS[providerCode];
  if (!definition) {
    return null;
  }

  if (definition.type === 'mock') {
    return {
      provider: providerCode,
      type: 'mock',
      configured: true,
      healthy: true,
      healthSource: 'mock-provider',
      presentConfig: [],
      missingConfig: [],
      placeholderConfig: [],
    };
  }

  const inspectedConfig = inspectConfigKeys(definition.requiredConfig);
  const configured =
    inspectedConfig.missingConfig.length === 0 && inspectedConfig.placeholderConfig.length === 0;

  return {
    provider: providerCode,
    type: definition.type,
    configured,
    healthy: configured,
    healthSource: 'configuration',
    requiredConfig: definition.requiredConfig,
    presentConfig: inspectedConfig.presentConfig,
    missingConfig: inspectedConfig.missingConfig,
    placeholderConfig: inspectedConfig.placeholderConfig,
  };
}

function getProvidersStatus() {
  return Object.keys(gatewayManager.providers || {}).reduce((acc, providerCode) => {
    const status = getProviderStatus(providerCode);
    if (status) {
      acc[providerCode] = status;
    }
    return acc;
  }, {});
}

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

  const providerStatus = getProviderStatus(component);
  const httpStatus = providerStatus?.healthy ? 200 : 503;

  return res.status(httpStatus).json({
    success: true,
    healthy: providerStatus?.healthy ?? false,
    configured: providerStatus?.configured ?? false,
    healthSource: providerStatus?.healthSource || 'configuration',
    missingConfig: providerStatus?.missingConfig || [],
    placeholderConfig: providerStatus?.placeholderConfig || [],
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
  const providers = getProvidersStatus();
  const realProviders = Object.values(providers).filter((provider) => provider.type === 'real');

  return res.status(200).json({
    success: true,
    providers,
    overall: {
      anyRealProviderConfigured: realProviders.some((provider) => provider.configured),
      anyRealProviderHealthy: realProviders.some((provider) => provider.healthy),
      mockAvailable: Boolean(providers.mock?.healthy),
    },
  });
});

router.get('/config', (req, res) => {
  const providers = getProvidersStatus();

  return res.status(200).json({
    success: true,
    config: {
      currency: process.env.DEFAULT_CURRENCY || 'EUR',
      stripe: Boolean(providers.stripe?.configured),
      paypal: Boolean(providers.paypal?.configured),
      anyRealProviderConfigured: Object.values(providers).some(
        (provider) => provider.type === 'real' && provider.configured,
      ),
      mock: Boolean(providers.mock?.healthy),
      providers,
    },
  });
});

module.exports = router;
