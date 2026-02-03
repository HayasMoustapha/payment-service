const express = require('express');
const router = express.Router();
const { database } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    await database.query('SELECT 1');
    return res.status(200).json({
      service: 'payment-service',
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      service: 'payment-service',
      status: 'degraded',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
