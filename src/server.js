/**
 * 💳 PAYMENT SERVICE - SERVEUR PRINCIPAL
 * 
 * RÔLE : Service technique de traitement des paiements
 * UTILISATION : Exécution des transactions via gateways (Stripe, PayPal, etc.)
 * PORT : 3003
 * 
 * FONCTIONNEMENT :
 * - Reçoit les requêtes de paiement de event-planner-core
 * - Traite les transactions via les gateways appropriées
 * - Gère les wallets et commissions de manière technique
 * - Émet des webhooks pour les changements de statut
 * 
 * NOTE : Service technique sans authentification
 * La sécurité est gérée par event-planner-core
 */

// Chargement des variables d'environnement
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
 * 🏗️ CLASSE SERVEUR PAYMENT
 * 
 * Configure et démarre le serveur de paiement technique
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
   * 🔧 CONFIGURATION DES MIDDLEWARES
   * 
   * Les middlewares sont des fonctions qui s'exécutent avant les routes
   */
  setupMiddleware() {
    // 🌐 MIDDLEWARE CORS : Permet les requêtes depuis d'autres domaines
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Domaine autorisé
      credentials: true, // Autorise les cookies et authentification
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Méthodes HTTP autorisées
      allowedHeaders: [ // En-têtes HTTP autorisés
        'Content-Type', 
        'X-API-Key', 
        'Stripe-Signature', // Pour les webhooks Stripe
        'PayPal-Auth-Algo', // Pour les webhooks PayPal
        'PayPal-Trans-ID',   // Pour les webhooks PayPal
        'PayPal-Cert-ID',    // Pour les webhooks PayPal
        'CinetPay-Signature' // Pour les webhooks CinetPay
      ]
    }));

    // 🗜️ MIDDLEWARE COMPRESSION : Compresse les réponses pour améliorer la performance
    this.app.use(compression());

    // 📝 MIDDLEWARE LOGGING : Enregistre les requêtes HTTP
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim())
        }
      }));
    }

    // 📄 MIDDLEWARE PARSING : Analyse les corps des requêtes
    this.app.use(express.json({ limit: '10mb' })); // JSON avec limite de 10MB
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded

    // 🔍 MIDDLEWARE WEBHOOK RAW BODY : Pour les webhooks qui nécessitent le corps brut
    this.app.use('/api/webhooks', async (req, res, next) => {
      if (req.headers['stripe-signature'] || 
          req.headers['paypal-auth-algo'] || 
          req.headers['cinetpay-signature']) {
        req.rawBody = await rawBody(req, {
          length: req.headers['content-length'],
          limit: '1mb'
        });
      }
      next();
    });

    // 📊 MIDDLEWARE REQUEST ID : Ajoute un ID unique à chaque requête
    this.app.use((req, res, next) => {
      req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.id);
      
      // Log avec ID de requête pour traçabilité
      logger.info(`Request started: ${req.method} ${req.path}`, {
        requestId: req.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      next();
    });
  }

  /**
   * 🛣️ CONFIGURATION DES ROUTES
   * 
   * Définit toutes les routes du service de paiement
   */
  setupRoutes() {
    // 🏥 ROUTES DE SANTÉ : Vérification de l'état du service
    this.app.use('/health', healthRoutes);
    this.app.use('/api/health', healthApiRoutes);

    // 💳 ROUTES DE PAIEMENT : Traitement des transactions
    this.app.use('/api/payments', paymentsRoutes);

    // 🔄 ROUTES DES PASSERELLES : Intégration avec les fournisseurs de paiement
    this.app.use('/api/stripe', stripeRoutes);
    this.app.use('/api/paypal', paypalRoutes);

    // 💰 ROUTES DE GESTION : Remboursements, factures, méthodes de paiement
    this.app.use('/api/refunds', refundsRoutes);
    this.app.use('/api/invoices', invoicesRoutes);
    this.app.use('/api/payment-methods', paymentMethodsRoutes);

    // 🏦 ROUTES WALLETS : Gestion technique des wallets et commissions
    this.app.use('/api/wallets', require('./api/routes/wallets.routes'));

    // 📊 ROUTE INFO : Informations sur le service (pour monitoring)
    this.app.get('/api/info', (req, res) => {
      res.json({
        service: 'Payment Service',
        version: '2.0.0',
        description: 'Service technique de traitement des paiements',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        gateways: {
          stripe: !!process.env.STRIPE_SECRET_KEY,
          paypal: !!process.env.PAYPAL_CLIENT_SECRET,
          cinetpay: !!process.env.CINETPAY_API_KEY
        }
      });
    });

    // ❌ ROUTE 404 : Gestion des routes non trouvées
    this.app.use('*', (req, res) => {
      logger.warn(`Route not found: ${req.method} ${req.path}`, {
        requestId: req.id,
        method: req.method,
        path: req.path
      });
      
      res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.path}`,
        code: 'ROUTE_NOT_FOUND',
        requestId: req.id
      });
    });
  }

  /**
   * 🚨 CONFIGURATION DE LA GESTION DES ERREURS
   * 
   * Gère toutes les erreurs du serveur de manière centralisée
   */
  setupErrorHandling() {
    // 🚨 MIDDLEWARE D'ERREUR GLOBAL
    this.app.use((error, req, res, next) => {
      // Log détaillé de l'erreur
      logger.error('Unhandled error occurred', {
        requestId: req.id,
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        ip: req.ip
      });

      // En développement, on renvoie le stack complet
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message,
          stack: error.stack,
          code: 'INTERNAL_ERROR',
          requestId: req.id
        });
      }

      // En production, on masque les détails sensibles
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        requestId: req.id
      });
    });
  }

  /**
   * 🚀 DÉMARRAGE DU SERVEUR
   * 
   * Démarre le serveur et gère les erreurs de démarrage
   */
  async start() {
    try {
      // 🗄️ INITIALISATION DE LA BASE DE DONNÉES
      logger.info('Initializing database...');
      await bootstrap();
      logger.info('Database initialized successfully');

      // 🚀 DÉMARRAGE DU SERVEUR HTTP
      const server = this.app.listen(this.port, () => {
        logger.info(`Payment Service started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        });

        // 📊 LOG DES PASSERELLES CONFIGURÉES
        const gateways = {
          stripe: !!process.env.STRIPE_SECRET_KEY,
          paypal: !!process.env.PAYPAL_CLIENT_SECRET,
          cinetpay: !!process.env.CINETPAY_API_KEY
        };
        
        logger.info('Payment gateways configured', gateways);
      });

      // 🛑 GESTION GRACIEUSE DE L'ARRÊT
      const gracefulShutdown = async (signal) => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        server.close(async () => {
          logger.info('HTTP server closed');
          
          try {
            // Fermeture des connexions à la base de données
            const database = require('./database');
            if (database.pool) {
              await database.pool.end();
              logger.info('Database connections closed');
            }
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
          }
        });

        // Timeout forcé après 30 secondes
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);
      };

      // 🎧 ÉCOUTE DES SIGNAUX D'ARRÊT
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // 🚨 GESTION DES ERREURS NON CAPTURÉES
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        gracefulShutdown('uncaughtException');
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        gracefulShutdown('unhandledRejection');
      });

      return server;

    } catch (error) {
      logger.error('Failed to start Payment Service:', error);
      process.exit(1);
    }
  }
}

// ========================================
// 🚀 DÉMARRAGE DU SERVICE
// ========================================

// Démarrage du serveur si ce fichier est exécuté directement
if (require.main === module) {
  const paymentServer = new PaymentServer();
  paymentServer.start();
}

// Export pour les tests
module.exports = PaymentServer;
