const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Health Check Routes (no authentication required)
router.get('/',
  healthController.simpleHealthCheck
);

router.get('/detailed',
  healthController.detailedHealthCheck
);

router.get('/ready',
  healthController.readinessCheck
);

router.get('/live',
  healthController.livenessCheck
);

// Component Health Checks
router.get('/components/stripe',
  healthController.stripeHealthCheck
);

router.get('/components/paypal',
  healthController.paypalHealthCheck
);

router.get('/components/invoices',
  healthController.invoicesHealthCheck
);

router.get('/components/refunds',
  healthController.refundsHealthCheck
);

// Providers Status
router.get('/providers',
  healthController.providersStatus
);

module.exports = router;
