/**
 * Configuration centrale du Payment Service
 * Exporte tous les modules de configuration
 */

const authClient = require('./auth-client');
const database = require('./database');

module.exports = {
  authClient,
  database
};
