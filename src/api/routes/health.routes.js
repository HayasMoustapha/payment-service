const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Health check route (no authentication required)
router.get('/', healthController.simpleHealthCheck);

// Detailed health check (authentication required)
router.get('/detailed', healthController.detailedHealthCheck);

// Readiness check
router.get('/ready', healthController.readinessCheck);

// Liveness check
router.get('/live', healthController.livenessCheck);

// Provider status
router.get('/providers', healthController.providersStatus);

module.exports = router;
