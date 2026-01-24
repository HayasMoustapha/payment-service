const { authClient } = require('../config');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate with Auth Service only (no local JWT verification)
    const authResult = await authClient.validateToken(token);

    if (!authResult.success) {
      return res.status(401).json({
        error: 'Invalid token',
        message: authResult.error
      });
    }

    // Attach user info to request
    const user = authResult.data.user;

    // Ensure user has required fields for downstream middleware
    if (!user) {
      return res.status(401).json({
        error: 'Invalid user data',
        message: 'User information not available'
      });
    }

    // Normalize user ID field (handle both userId and id)
    if (!user.id && user.userId) {
      user.id = user.userId;
    }

    if (!user.id) {
      return res.status(401).json({
        error: 'Invalid user data',
        message: 'User ID not found'
      });
    }

    // Ensure roles array exists
    if (!user.roles || !Array.isArray(user.roles)) {
      user.roles = [];
    }

    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
      requestId: req.id || 'unknown'
    });
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.replace('Bearer ', '');
    // Validate with Auth Service only (consistent with authenticate middleware)
    const authResult = await authClient.validateToken(token);

    if (authResult.success) {
      req.user = authResult.data.user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Middleware pour valider une clé API
 * @param {string} envKeyName - Nom de la variable d'environnement contenant la clé attendue
 */
const requireAPIKey = (envKeyName) => {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const expectedKey = process.env[envKeyName];

    if (!expectedKey) {
      console.error(`API key environment variable ${envKeyName} not configured`);
      return res.status(500).json({
        error: 'Configuration error',
        message: 'API key not configured'
      });
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide an API key via X-API-Key header or api_key query parameter'
      });
    }

    if (apiKey !== expectedKey) {
      return res.status(403).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    next();
  };
};

/**
 * Middleware pour valider les webhooks Stripe
 * Vérifie la présence de la signature Stripe et stocke les informations pour le handler
 */
const requireStripeWebhook = () => {
  return (req, res, next) => {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET environment variable not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Stripe webhook secret not configured'
      });
    }

    if (!signature) {
      return res.status(401).json({
        error: 'Stripe signature required',
        message: 'Please provide a valid Stripe signature'
      });
    }

    // Store signature for webhook handler to use with Stripe SDK verification
    req.stripeSignature = signature;
    req.stripeWebhookSecret = webhookSecret;

    next();
  };
};

/**
 * Middleware pour valider les webhooks PayPal
 * Vérifie la présence des headers PayPal et stocke les informations pour le handler
 */
const requirePayPalWebhook = () => {
  return (req, res, next) => {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      console.error('PAYPAL_WEBHOOK_ID environment variable not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'PayPal webhook ID not configured'
      });
    }

    // PayPal sends these headers for webhook verification
    const paypalHeaders = {
      transmissionId: req.headers['paypal-transmission-id'],
      transmissionTime: req.headers['paypal-transmission-time'],
      certUrl: req.headers['paypal-cert-url'],
      authAlgo: req.headers['paypal-auth-algo'],
      transmissionSig: req.headers['paypal-transmission-sig']
    };

    // Check that at least the transmission ID is present
    if (!paypalHeaders.transmissionId) {
      return res.status(401).json({
        error: 'PayPal webhook headers required',
        message: 'Please provide valid PayPal webhook headers'
      });
    }

    // Store headers for webhook handler to use with PayPal SDK verification
    req.paypalWebhookHeaders = paypalHeaders;
    req.paypalWebhookId = webhookId;

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAPIKey,
  requireStripeWebhook,
  requirePayPalWebhook
};
