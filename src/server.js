// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();

// Importation des modules nécessaires pour le serveur
const express = require('express'); // Framework web Node.js
const cors = require('cors'); // Middleware pour gérer le CORS (partage entre domaines)
const compression = require('compression'); // Middleware pour compresser les réponses
const morgan = require('morgan'); // Middleware pour les logs de requêtes HTTP
const rawBody = require('raw-body'); // Utilitaire pour lire les corps bruts des requêtes

// Importation des modules locaux
const logger = require('./utils/logger'); // Utilitaire de logging
const healthRoutes = require('./health/health.routes'); // Routes de santé
const paymentsRoutes = require('./api/routes/payments.routes'); // Routes de paiements
const stripeRoutes = require('./api/routes/stripe.routes'); // Routes Stripe
const paypalRoutes = require('./api/routes/paypal.routes'); // Routes PayPal
const refundsRoutes = require('./api/routes/refunds.routes'); // Routes de remboursements
const invoicesRoutes = require('./api/routes/invoices.routes'); // Routes de factures
const paymentMethodsRoutes = require('./api/routes/payment-methods.routes'); // Routes méthodes paiement
const healthApiRoutes = require('./api/routes/health.routes'); // Routes santé API
const bootstrap = require("./bootstrap"); // Initialisation de la base de données

/**
 * Serveur Principal du Service de Paiement
 * Ce serveur gère toutes les requêtes HTTP pour les paiements
 * Il configure les routes, middlewares et démarre le serveur
 */
class PaymentServer {
  constructor() {
    this.app = express(); // Crée l'application Express
    this.port = process.env.PORT || 3003; // Port du serveur (3003 par défaut)
    this.setupMiddleware(); // Configure les middlewares
    this.setupRoutes(); // Configure les routes
    this.setupErrorHandling(); // Configure la gestion des erreurs
  }

  /**
   * Configure les middlewares du serveur
   * Les middlewares sont des fonctions qui s'exécutent avant les routes
   */
  setupMiddleware() {
    // MIDDLEWARE CORS : Permet les requêtes depuis d'autres domaines
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Domaine autorisé
      credentials: true, // Autorise les cookies et authentification
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Méthodes HTTP autorisées
      allowedHeaders: [ // En-têtes HTTP autorisés
        'Content-Type', 
        'X-API-Key', 
        'Stripe-Signature', // Pour les webhooks Stripe
        'PayPal-Auth-Algo', // Pour les webhooks PayPal
        'PayPal-Cert-Id', 
        'PayPal-Transmission-Id', 
        'PayPal-Transmission-Sig', 
        'PayPal-Transmission-Time'
      ]
    }));

    // MIDDLEWARE COMPRESSION : Compresse les réponses pour économiser la bande passante
    this.app.use(compression());

    // MIDDLEWARE PARSING : Analyse les corps des requêtes JSON
    // Support spécial pour les webhooks qui peuvent avoir des formats différents
    this.app.use(express.json({ 
      limit: '10mb', // Limite la taille des requêtes à 10MB
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Sécurité contre les injections NoSQL - CORRECTION : désactiver mongoSanitize défectueux
    // TODO: Remplacer par une solution plus stable comme mongo-express-sanitize
    // this.app.use(mongoSanitize());

    // Logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim())
        }
      }));
    }

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
      });
      next();
    });
  }

  /**
   * Configure les routes
   */
  setupRoutes() {
    // Route racine
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Payment Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        capabilities: {
          stripe: true,
          paypal: true,
          refunds: true,
          invoices: true,
          webhooks: true
        }
      });
    });

    // Routes de santé (publiques)
    this.app.use('/health', healthRoutes);

    // Routes API
    this.app.use('/api/payments', paymentsRoutes);
    
    // Nouvelles routes structurées selon Postman
    this.app.use('/api/payments/stripe', stripeRoutes);
    this.app.use('/api/payments/paypal', paypalRoutes);
    this.app.use('/api/payments/refunds', refundsRoutes);
    this.app.use('/api/payments/invoices', invoicesRoutes);
    this.app.use('/api/payments/payment-methods', paymentMethodsRoutes);
    this.app.use('/health', healthApiRoutes);

    // Route API racine
    this.app.get('/api', (req, res) => {
      res.json({
        service: 'Payment API',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
          payments: '/api/payments',
          health: '/health'
        },
        documentation: '/api/docs',
        timestamp: new Date().toISOString()
      });
    });

    // Route pour les métriques Prometheus si activé
    if (process.env.ENABLE_METRICS === 'true') {
      const promClient = require('prom-client');
      
      // Créer un registre de métriques
      const register = new promClient.Registry();
      
      // Ajouter des métriques par défaut
      promClient.collectDefaultMetrics({ register });
      
      // Métriques personnalisées
      const paymentCounter = new promClient.Counter({
        name: 'payment_service_payments_total',
        help: 'Total number of payments processed',
        labelNames: ['provider', 'status', 'currency']
      });
      
      const refundCounter = new promClient.Counter({
        name: 'payment_service_refunds_total',
        help: 'Total number of refunds processed',
        labelNames: ['provider', 'status', 'currency']
      });
      
      const invoiceCounter = new promClient.Counter({
        name: 'payment_service_invoices_total',
        help: 'Total number of invoices generated',
        labelNames: ['status']
      });
      
      const paymentAmountHistogram = new promClient.Histogram({
        name: 'payment_service_payment_amount',
        help: 'Payment amount distribution',
        labelNames: ['provider', 'currency'],
        buckets: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]
      });
      
      register.registerMetric(paymentCounter);
      register.registerMetric(refundCounter);
      register.registerMetric(invoiceCounter);
      register.registerMetric(paymentAmountHistogram);
      
      // Endpoint pour les métriques
      this.app.get('/metrics', async (req, res) => {
        try {
          res.set('Content-Type', register.contentType);
          res.end(await register.metrics());
        } catch (error) {
          logger.error('Failed to generate metrics', {
            error: error.message
          });
          res.status(500).end();
        }
      });
    }

    // Route 404
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        error: {
          code: 'NOT_FOUND',
          path: req.originalUrl
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Configure la gestion des erreurs
   */
  setupErrorHandling() {
    // Gestionnaire d'erreurs global
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Ne pas envoyer le stack trace en production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const errorResponse = {
        success: false,
        message: isDevelopment ? error.message : 'Erreur interne du serveur',
        error: {
          code: 'INTERNAL_SERVER_ERROR'
        },
        timestamp: new Date().toISOString()
      };

      if (isDevelopment) {
        errorResponse.error.stack = error.stack;
      }

      res.status(error.status || 500).json(errorResponse);
    });

    // Gestion des promesses rejetées non capturées
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', {
        promise,
        reason: reason.message || reason
      });
    });

    // Gestion des exceptions non capturées
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
      });
      
      // Arrêter le serveur proprement
      this.gracefulShutdown('SIGTERM');
    });

    // Gestion des signaux système
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Démarre le serveur
   */
  async start() {
    try {
      // Bootstrap automatique (crée la BD et applique les migrations)
      await bootstrap.initialize();
      
      logger.info('🚀 Starting Payment Service server...');
      
      this.server = this.app.listen(this.port, () => {
        logger.info(`Payment Service started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0',
          pid: process.pid,
          capabilities: {
            stripe: true,
            paypal: true,
            refunds: true,
            invoices: true,
            webhooks: true,
            metrics: process.env.ENABLE_METRICS === 'true'
          }
        });
      });
    } catch (error) {
      logger.error('❌ Failed to start server:', error);
      process.exit(1);
    }

    this.server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof this.port === 'string'
        ? 'Pipe ' + this.port
        : 'Port ' + this.port;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  }

  /**
   * Arrête proprement le serveur
   * @param {string} signal - Signal reçu
   */
  async gracefulShutdown(signal) {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    try {
      // Arrêter d'accepter de nouvelles connexions
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error.message
      });
      process.exit(1);
    }
  }
}

// Démarrer le serveur si ce fichier est exécuté directement
if (require.main === module) {
  const server = new PaymentServer();
  server.start().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = PaymentServer;
