# 📁 ARBORESCENCE COMPLÈTE - PAYMENT SERVICE

## 🎯 Vue d'ensemble

Le **Payment Service** est le service spécialisé dans la gestion des transactions financières de la plateforme Event Planner SaaS. Il gère les paiements, factures, remboursements et webhooks.

```
📁 payment-service/
├── 📁 src/                    # Code source principal
├── 📁 database/               # Gestion base de données
├── 📁 tests/                  # Tests automatisés
├── 📁 docs/                   # Documentation
├── 📁 postman/                # Collections API
├── 📁 documentations/         # Documentation détaillée
├── 📁 logs/                   # Logs applicatifs
└── 📄 Configuration files     # Fichiers de config
```

---

## 📁 DÉTAIL DE L'ARBORESCENCE

### 📁 src/ - Code source principal

```
📁 src/
├── 📁 api/                    # API REST
│   ├── 📁 routes/             # Routes API
│   │   ├── 📄 payments.routes.js
│   │   ├── 📄 invoices.routes.js
│   │   ├── 📄 refunds.routes.js
│   │   ├── 📄 webhooks.routes.js
│   │   └── 📄 statistics.routes.js
│   │
│   └── 📁 controllers/        # Contrôleurs API
│       ├── 📄 payments.controller.js
│       ├── 📄 invoices.controller.js
│       ├── 📄 refunds.controller.js
│       ├── 📄 webhooks.controller.js
│       └── 📄 statistics.controller.js
│
├── 📁 core/                   # Cœur métier
│   ├── 📁 services/           # Services métier
│   │   ├── 📄 payment.service.js
│   │   ├── 📄 invoice.service.js
│   │   ├── 📄 refund.service.js
│   │   ├── 📄 webhook.service.js
│   │   └── 📄 statistics.service.js
│   │
│   ├── 📁 providers/          # Fournisseurs externes
│   │   ├── 📄 stripe.provider.js
│   │   ├── 📄 paypal.provider.js
│   │   ├── 📄 square.provider.js
│   │   └── 📄 adyen.provider.js
│   │
│   └── 📁 processors/         # Processeurs
│       ├── 📄 payment.processor.js
│       ├── 📄 refund.processor.js
│       ├── 📄 invoice.processor.js
│       └── 📄 webhook.processor.js
│
├── 📁 services/              # Services partagés
│   ├── 📄 database.service.js
│   ├── 📄 redis.service.js
│   ├── 📄 queue.service.js
│   ├── 📄 pdf.service.js
│   └── 📄 metrics.service.js
│
├── 📁 database/              # Base de données
│   ├── 📁 bootstrap/          # Scripts bootstrap
│   │   ├── 📄 001_create_schema_migrations.sql
│   │   └── 📄 002_create_database.sql
│   │
│   ├── 📁 migrations/         # Migrations SQL
│   │   ├── 📄 001_initial_schema.sql
│   │   ├── 📄 002_add_indexes.sql
│   │   └── 📄 003_add_webhooks.sql
│   │
│   └── 📄 connection.js       # Connexion BDD
│
├── 📁 middleware/            # Middlewares
│   ├── 📄 validation.middleware.js
│   ├── 📄 rate-limit.middleware.js
│   ├── 📄 auth.middleware.js
│   └── 📄 error.middleware.js
│
├── 📁 config/                # Configuration
│   ├── 📄 database.js
│   ├── 📄 redis.js
│   ├── 📄 stripe.js
│   ├── 📄 paypal.js
│   ├── 📄 webhooks.js
│   └── 📄 pdf.js
│
├── 📁 utils/                 # Utilitaires
│   ├── 📄 logger.js
│   ├── 📄 helpers.js
│   ├── 📄 validators.js
│   └── 📄 constants.js
│
├── 📁 error/                 # Gestion erreurs
│   ├── 📄 error-handler.js
│   ├── 📄 custom-errors.js
│   └── 📄 error-types.js
│
├── 📁 health/                # Health checks
│   ├── 📄 health.controller.js
│   ├── 📄 health.routes.js
│   └── 📄 health.service.js
│
├── 📄 server.js              # Serveur principal
├── 📄 bootstrap.js           # Initialisation
└── 📄 index.js               # Export principal
```

### 📁 database/ - Gestion base de données

```
📁 database/
├── 📁 bootstrap/              # Scripts bootstrap
│   ├── 📄 001_create_schema_migrations.sql
│   ├── 📄 002_create_database.sql
│   └── 📄 003_create_extensions.sql
│
├── 📁 migrations/             # Migrations SQL
│   ├── 📄 001_initial_schema.sql
│   ├── 📄 002_add_indexes.sql
│   ├── 📄 003_add_webhooks.sql
│   ├── 📄 004_add_audit_tables.sql
│   └── 📄 005_add_statistics.sql
│
├── 📁 schema/                 # Documentation schéma
│   ├── 📄 payments.sql
│   ├── 📄 payment_intents.sql
│   ├── 📄 invoices.sql
│   ├── 📄 refunds.sql
│   └── 📄 webhooks.sql
│
├── 📁 seeds/                  # Données initiales
│   ├── 📄 001_test_payments.sql
│   ├── 📄 002_sample_invoices.sql
│   └── 📄 003_webhook_configs.sql
│
├── 📄 DATABASE_BOOTSTRAP.md   # Documentation BDD
├── 📄 README.md               # README database
└── 📄 connection.js           # Configuration connexion
```

### 📁 tests/ - Tests automatisés

```
📁 tests/
├── 📁 unit/                   # Tests unitaires
│   ├── 📁 services/
│   │   ├── 📄 payment.service.test.js
│   │   ├── 📄 invoice.service.test.js
│   │   ├── 📄 refund.service.test.js
│   │   └── 📄 webhook.service.test.js
│   ├── 📁 providers/
│   │   ├── 📄 stripe.test.js
│   │   ├── 📄 paypal.test.js
│   │   └── 📄 square.test.js
│   └── 📁 utils/
│       ├── 📄 logger.test.js
│       └── 📄 helpers.test.js
│
├── 📁 integration/            # Tests d'intégration
│   ├── 📄 payment.integration.test.js
│   ├── 📄 invoice.integration.test.js
│   ├── 📄 refund.integration.test.js
│   └── 📄 webhook.integration.test.js
│
├── 📁 e2e/                    # Tests end-to-end
│   ├── 📄 payment-flow.e2e.test.js
│   ├── 📄 invoice-generation.e2e.test.js
│   ├── 📄 refund-processing.e2e.test.js
│   └── 📄 webhook-handling.e2e.test.js
│
├── 📁 fixtures/               # Données de test
│   ├── 📄 payments.json
│   ├── 📄 invoices.json
│   ├── 📄 refunds.json
│   └── 📄 webhooks.json
│
├── 📁 helpers/                # Helpers de test
│   ├── 📄 database.helper.js
│   ├── 📄 stripe.helper.js
│   └── 📄 mock.helper.js
│
├── 📄 setup.js                # Configuration tests
├── 📄 teardown.js             # Nettoyage tests
└── 📄 test.config.js          # Config tests
```

### 📁 docs/ - Documentation

```
📁 docs/
├── 📄 README.md               # Documentation principale
├── 📄 API_ROUTES.md           # Routes API
├── 📄 PROVIDERS.md            # Fournisseurs externes
├── 📄 WEBHOOKS.md             # Gestion webhooks
├── 📄 INVOICES.md             # Gestion factures
├── 📄 DEPLOYMENT.md           # Guide déploiement
└── 📄 TROUBLESHOOTING.md      # Dépannage
```

### 📁 documentations/ - Documentation détaillée

```
📁 documentations/
├── 📄 API.md                   # Documentation API détaillée
├── 📄 ARCHITECTURE.md          # Architecture du service
└── 📄 DEPLOYMENT.md           # Guide de déploiement
```

### 📁 postman/ - Collections API

```
📁 postman/
├── 📄 Payment-Service.postman_collection.json
├── 📄 Payment-Service.postman_environment.json
├── 📄 Payment-Service.postman_collection.json.backup
└── 📁 examples/
    ├── 📄 create-payment.json
    ├── 📄 create-invoice.json
    ├── 📄 process-refund.json
    └── 📄 handle-webhook.json
```

---

## 📄 Fichiers de configuration

### 📄 Fichiers principaux

```
📄 package.json              # Dépendances et scripts
📄 package-lock.json          # Lock versions
📄 .env.example              # Variables environnement
📄 .env.test                 # Env test
📄 .gitignore                # Fichiers ignorés Git
📄 Dockerfile                # Configuration Docker
├── 📄 README.md               # README principal
├── 📄 API_ROUTES.md           # Documentation routes API
└── 📄 Dockerfile                # Configuration Docker
```

---

## 🎯 Rôle de chaque dossier

### 📁 src/ - Code métier
Contient toute la logique applicative organisée en couches pour une meilleure maintenabilité.

### 📁 database/ - Persistance
Gère tout ce qui concerne la base de données : schéma, migrations, seeds et connexions.

### 📁 tests/ - Qualité
Assure la qualité du code avec des tests unitaires, d'intégration et end-to-end.

### 📁 docs/ - Documentation
Centralise toute la documentation technique et utilisateur.

### 📁 postman/ - API Testing
Facilite les tests manuels et l'exploration des API avec des collections Postman.

### 📁 logs/ - Logging
Centralise tous les logs applicatifs pour le debugging et le monitoring.

---

## 🚀 Points d'entrée principaux

### 📄 server.js
Point d'entrée principal du serveur Express. Configure et démarre l'application.

### 📄 bootstrap.js
Script d'initialisation : connexion BDD, migrations, démarrage services.

### 📄 index.js
Export principal pour les tests et l'utilisation comme module.

---

## 🔧 Configuration

### Variables d'environnement clés
- `NODE_ENV` : Environnement (development/production)
- `PORT` : Port d'écoute (3003)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` : BDD
- `REDIS_URL` : Redis
- `STRIPE_SECRET_KEY` : Clé secrète Stripe
- `STRIPE_WEBHOOK_SECRET` : Secret webhook Stripe
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` : PayPal
- `SQUARE_ACCESS_TOKEN` : Square
- `ADYEN_API_KEY` : Adyen

### Scripts npm principaux
- `npm start` : Démarrage production
- `npm run dev` : Développement avec nodemon
- `npm test` : Tests unitaires
- `npm run test:integration` : Tests intégration
- `npm run test:e2e` : Tests E2E
- `npm run build` : Build production
- `npm run migrate` : Migrations BDD
- `npm run seed` : Seeding BDD

---

## 🔄 Fournisseurs externes

Le Payment Service supporte plusieurs fournisseurs de paiement :

### 💳 Payment Providers
- **Stripe** : Service de paiement principal
- **PayPal** : Alternative populaire
- **Square** : Pour les paiements en personne
- **Adyen** : Pour les transactions internationales

### 📄 Invoice Generation
- **PDFKit** : Génération de factures PDF
- **Handlebars** : Templates de factures
- **Puppeteer** : Alternative pour PDF complexes

### 🔄 Webhook Processing
- **Stripe Webhooks** : Événements Stripe
- **PayPal Webhooks** : Événements PayPal
- **Custom Webhooks** : Webhooks personnalisés

---

## 📊 Flux de paiement

### 1. Création de paiement
```
Client → Core Service → Payment Service → Stripe/PayPal → Payment Intent
```

### 2. Confirmation de paiement
```
Client → Payment Service → Provider → Webhook → Core Service
```

### 3. Génération facture
```
Payment Service → PDF Service → Stockage → Notification Client
```

### 4. Remboursement
```
Client/Admin → Payment Service → Provider → Webhook → Core Service
```

---

## 🛡️ Sécurité

### PCI DSS Compliance
- Tokenisation des cartes
- Chiffrement des données sensibles
- Audit trails complets
- Validation stricte des entrées

### Webhook Security
- Signature verification
- IP whitelisting
- Rate limiting
- Replay attack prevention

---

**Version** : 1.0.0  
**Dernière mise à jour** : 29 janvier 2026
