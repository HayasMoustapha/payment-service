# � Payment Service - Service Technique de Paiement

## 🎯 Vue d'Ensemble

Le **Payment Service** est un microservice Node.js/Express technique qui gère toutes les opérations de paiement pour la plateforme Event Planner. Il offre une abstraction unifiée pour multiple fournisseurs de paiement (Stripe, PayPal, CinetPay, MTN Mobile Money, etc.) avec gestion automatique des secours et des webhooks.

### 🏗️ Architecture Technique

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Core Service  │───▶│  Payment Service │───▶│  Passerelles    │
│   (Orchestration)│   │   (Ce Service)   │    │   (Stripe, etc) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   (Base de      │
                       │    données)     │
                       └─────────────────┘
```

## � Rôle Technique

### ✅ Responsabilités Techniques
- **Traitement des paiements** : Exécution des transactions via gateways
- **Intégration multi-passereles** : Stripe, PayPal, CinetPay, Mobile Money
- **Gestion des wallets** : Opérations techniques sur les wallets
- **Remboursements** : Traitement technique des remboursements
- **Factures** : Génération technique des factures
- **Webhooks** : Réception et traitement des webhooks externes

### ❌ Hors Périmètre
- **Logique métier** : Définie par event-planner-core
- **Authentification** : Gérée par event-planner-core
- **Gestion utilisateurs** : Déléguée à auth-service
- **Validation métier** : Gérée par event-planner-core

## 🚀 Fonctionnalités Techniques

### 💳 Traitement des Paiements
- **Multi-passereles** : Stripe, PayPal, CinetPay, MTN Mobile Money, Orange Money
- **Sélection automatique** : Choix de la meilleure passerelle selon montant, devise, pays
- **Gestion des secours** : Basculement automatique vers une autre passerelle en cas d'échec
- **Validation cryptographique** : Vérification de l'authenticité des transactions

### � Gestion des Wallets
- **Opérations techniques** : Solde, transactions, statistiques
- **Retraits** : Traitement des demandes de retrait
- **Commissions** : Calcul et gestion technique des commissions
- **Projections** : Projections de revenus et règlements

### 📡 Webhooks et Notifications
- **Webhooks sécurisés** : Vérification cryptographique des signatures
- **Événements temps réel** : Notifications instantanées des changements de statut
- **Gestion des erreurs** : Retry automatique en cas d'échec de webhook

### 📊 Statistiques et Monitoring
- **Rapports techniques** : Statistiques par passerelle, devise, période
- **Health checks** : Surveillance de l'état du service et des passerelles
- **Métriques Prometheus** : Monitoring des performances

## 🛠️ Stack Technique

### Backend
- **Node.js** : Runtime JavaScript (v18+)
- **Express** : Framework web
- **PostgreSQL** : Base de données principale
- **SQL Natif** : Requêtes directes (pas d'ORM)
- **Joi** : Validation des données

### Passerelles de Paiement
- **Stripe** : Cartes de crédit/débit
- **PayPal** : Portefeuille PayPal
- **CinetPay** : Paiements africains
- **MTN Mobile Money** : Mobile Money MTN
- **Orange Money** : Mobile Money Orange

### Monitoring et Sécurité
- **Prometheus** : Métriques
- **Winston** : Logging
- **Helmet** : Sécurité HTTP
- **Rate Limiting** : Protection contre les abus

## 📡 API Technique

### Routes Principales

#### 💳 Paiements
```
POST /api/payments/process              # Traiter un paiement
POST /api/payments/templates/purchase    # Acheter un template
GET  /api/payments/:paymentId/status     # Statut paiement
GET  /api/payments                       # Liste paiements
GET  /api/payments/:paymentId            # Détail paiement
POST /api/payments/:paymentId/cancel     # Annuler paiement
```

#### 🏦 Wallets
```
GET  /api/wallets/balance                # Solde wallet
GET  /api/wallets/transactions           # Historique transactions
GET  /api/wallets/statistics             # Statistiques wallet
POST /api/wallets/withdrawals            # Créer retrait
GET  /api/wallets/withdrawals            # Liste retraits
```

#### 💰 Commissions
```
GET  /api/wallets/commissions/statistics # Statistiques commissions
GET  /api/wallets/commissions/user      # Commissions utilisateur
GET  /api/wallets/commissions/rates      # Taux de commission
POST /api/wallets/commissions/projections # Projection commission
```

#### 🔄 Gateways
```
POST /api/stripe/charge                  # Paiement Stripe
POST /api/paypal/payment                 # Paiement PayPal
POST /api/refunds/create                 # Créer remboursement
GET  /api/invoices/:id                   # Obtenir facture
```

#### 🏥 Santé
```
GET  /health                             # Santé service
```

## 🔧 Configuration

### Variables d'Environnement

```bash
# Service
PORT=3003
NODE_ENV=production

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_planner_payments
DB_USER=payment_user
DB_PASSWORD=secure_password

# Passerelles
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
CINETPAY_API_KEY=...
CINETPAY_SECRET_KEY=...

# Sécurité
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Déploiement

### Docker
```bash
# Build
docker build -t payment-service .

# Run
docker run -p 3003:3003 --env-file .env payment-service
```

### Docker Compose
```yaml
version: '3.8'
services:
  payment-service:
    build: .
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    depends_on:
      - postgres
```

## 📊 Monitoring

### Métriques Prometheus
- `payment_transactions_total` : Nombre total de transactions
- `payment_success_rate` : Taux de succès des paiements
- `payment_gateway_response_time` : Temps de réponse des gateways
- `payment_errors_total` : Nombre total d'erreurs

### Health Checks
- `/health` : Santé générale du service
- `/health/database` : Connexion base de données
- `/health/gateways` : État des passerelles

## 🔒 Sécurité

### Protection
- **Rate Limiting** : 100 requêtes/15 minutes
- **CORS** : Origines autorisées uniquement
- **Helmet** : En-têtes de sécurité
- **Validation Joi** : Validation stricte des entrées

### Webhooks
- **Signature verification** : Vérification cryptographique
- **Replay protection** : Protection contre les attaques replay
- **IP whitelisting** : Adresses IP autorisées

## 🔄 Communication Inter-Services

### Appels par event-planner-core
- **Traitement paiements** : `POST /api/payments/process`
- **Achat templates** : `POST /api/payments/templates/purchase`
- **Statuts paiements** : `GET /api/payments/:id/status`
- **Gestion wallets** : Routes `/api/wallets/*`

### Notifications
- **Webhooks vers core** : Changements de statut
- **Events Redis** : Notifications temps réel
- **Logs centralisés** : Partage des logs

## 📈 Performance

### Optimisations
- **Connection pooling** : Pool de connexions PostgreSQL
- **Caching Redis** : Mise en cache des réponses
- **Compression Gzip** : Compression des réponses
- **Async processing** : Traitement asynchrone

### Scalabilité
- **Horizontal scaling** : Plusieurs instances
- **Load balancing** : Répartition de charge
- **Database sharding** : Partitionnement des données

## 🚨 Gestion des Erreurs

### Types d'Erreurs
- **Gateway errors** : Erreurs des passerelles
- **Validation errors** : Erreurs de validation
- **Database errors** : Erreurs de base de données
- **Network errors** : Erreurs réseau

### Stratégies
- **Retry automatique** : 3 tentatives maximum
- **Circuit breaker** : Isolation des services défaillants
- **Fallback** : Basculement vers d'autres passerelles
- **Logging détaillé** : Traçabilité complète

## 📝 Développement

### Installation
```bash
npm install
npm run dev
```

### Tests
```bash
npm test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## 🔄 Versioning

### API Versioning
- **v1** : Version actuelle stable
- **v2** : En développement (breaking changes)

### Changelog
- **v1.2.0** : Ajout support CinetPay
- **v1.1.0** : Amélioration gestion wallets
- **v1.0.0** : Version initiale

---

**Note** : Ce service est purement technique. Toute logique métier doit être implémentée dans event-planner-core.
- **Express.js** : Framework web HTTP
- **PostgreSQL** : Base de données relationnelle
- **Joi** : Validation des schémas de données

### Passerelles de Paiement
- **Stripe** : Cartes bancaires internationales
- **PayPal** : Portefeuille en ligne international
- **CinetPay** : Solution de paiement africaine
- **MTN Mobile Money** : Mobile money africain
- **Orange Money** : Mobile money Orange

### Développement et Déploiement
- **Docker** : Conteneurisation
- **Docker Compose** : Orchestration locale
- **Git** : Version control
- **ESLint** : Qualité du code

## 📁 Structure du Projet

```
payment-service/
├── src/
│   ├── api/
│   │   ├── controllers/     # Logique des contrôleurs
│   │   │   ├── payments.controller.js
│   │   │   ├── stripe.controller.js
│   │   │   ├── paypal.controller.js
│   │   │   └── ...
│   │   └── routes/          # Définition des routes API
│   │       ├── payments.routes.js
│   │       ├── stripe.routes.js
│   │       └── ...
│   ├── core/
│   │   ├── payments/        # Service de paiement principal
│   │   ├── providers/       # Gestionnaire de passerelles
│   │   ├── stripe/          # Intégration Stripe
│   │   ├── paypal/          # Intégration PayPal
│   │   └── african/         # Passerelles africaines
│   ├── config/
│   │   ├── database.js      # Configuration PostgreSQL
│   │   └── index.js         # Configuration générale
│   ├── utils/
│   │   ├── logger.js        # Gestion des logs
│   │   ├── response.js      # Utilitaires de réponse HTTP
│   │   └── database-wrapper.js # Wrapper SQL
│   └── server.js            # Point d'entrée du serveur
├── database/
│   ├── migrations/          # Migrations SQL
│   ├── seeds/              # Données de test
│   └── schema/             # Schéma de la base
├── docs/                   # Documentation technique
├── postman/               # Collections Postman
├── .env.example           # Variables d'environnement
├── Dockerfile             # Configuration Docker
└── package.json           # Dépendances Node.js
```

## 🗄️ Schéma de la Base de Données

### Tables Principales

#### `transactions`
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    event_id UUID,
    amount INTEGER NOT NULL,           -- Montant en centimes
    currency VARCHAR(3) DEFAULT 'EUR',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(100),
    provider_transaction_id VARCHAR(255),
    provider_response JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `payment_gateways`
```sql
CREATE TABLE payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,  -- stripe, paypal, etc.
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    config JSONB,                       -- Clés API, secrets
    supported_currencies TEXT[],
    supported_countries TEXT[],
    min_amount DECIMAL(10,2),
    max_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `commissions`
```sql
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    commission_rate DECIMAL(5,4),
    commission_amount INTEGER,
    commission_type VARCHAR(50),        -- ticket_sale, template_sale
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `wallets`
```sql
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    user_type VARCHAR(50),              -- designer, organizer
    balance DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Installation et Configuration

### Prérequis
- Node.js 18+ 
- PostgreSQL 13+
- Docker (optionnel)

### Installation Locale

1. **Cloner le projet**
```bash
git clone <repository-url>
cd payment-service
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer la base de données**
```bash
# Créer la base de données
createdb event_planner_payments

# Appliquer les migrations
npm run migrate
```

4. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

5. **Démarrer le service**
```bash
npm start
```

### Installation avec Docker

1. **Construire l'image**
```bash
docker build -t payment-service .
```

2. **Démarrer avec Docker Compose**
```bash
docker-compose up -d
```

## ⚙️ Configuration

### Variables d'Environnement

```bash
# Configuration du serveur
PORT=3003
NODE_ENV=development

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_planner_payments
DB_USER=postgres
DB_PASSWORD=your_password

# Passerelles de paiement
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
CINETPAY_API_KEY=...
CINETPAY_SECRET_KEY=...

# Sécurité
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9093
LOG_LEVEL=info
```

### Configuration des Passerelles

#### Stripe
```javascript
// Dans la base de données ou .env
STRIPE_SECRET_KEY=sk_test_123456789
STRIPE_WEBHOOK_SECRET=whsec_abcdef123456
```

#### PayPal
```javascript
PAYPAL_CLIENT_ID=AfAaBbBcCc...
PAYPAL_CLIENT_SECRET=EFGH123456...
PAYPAL_MODE=sandbox  // sandbox ou live
```

#### CinetPay (Afrique)
```javascript
CINETPAY_API_KEY=1234567890abcdef
CINETPAY_SECRET_KEY=fedcba0987654321
CINETPAY_SITE_ID=123456
```

## 📡 API Reference

### Endpoints Principaux

#### Paiements
```http
POST   /api/payments/process              # Traiter un paiement
POST   /api/payments/templates/purchase   # Acheter un template
GET    /api/payments/status/:id           # Statut d'une transaction
GET    /api/payments/statistics           # Statistiques
GET    /api/payments/gateways             # Passerelles disponibles
```

#### Stripe
```http
POST   /api/payments/stripe/payment-intent # Créer un paiement Stripe
GET    /api/payments/stripe/payment-intent/:id
POST   /api/payments/stripe/confirm       # Confirmer un paiement
POST   /api/payments/stripe/customers     # Gérer les clients
```

#### PayPal
```http
POST   /api/payments/paypal/orders         # Créer une commande PayPal
GET    /api/payments/paypal/orders/:id
POST   /api/payments/paypal/orders/:id/capture # Capturer le paiement
```

#### Remboursements
```http
POST   /api/payments/refunds/stripe        # Remboursement Stripe
POST   /api/payments/refunds/paypal        # Remboursement PayPal
GET    /api/payments/refunds/:id           # Statut d'un remboursement
```

#### Factures
```http
POST   /api/payments/invoices/generate     # Générer une facture
GET    /api/payments/invoices/:id          # Obtenir une facture
GET    /api/payments/invoices/:id/download # Télécharger une facture PDF
```

### Exemples d'Utilisation

#### Traiter un paiement
```bash
curl -X POST http://localhost:3003/api/payments/process \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2500,
    "currency": "EUR",
    "paymentMethod": "card",
    "customerEmail": "client@example.com",
    "description": "Achat ticket événement",
    "preferredGateways": ["stripe", "paypal"]
  }'
```

#### Réponse
```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "transactionId": "tx_123456789",
    "status": "pending",
    "gateway": "stripe",
    "clientSecret": "pi_123456789_secret_abcdef",
    "requiresAction": false
  }
}
```

#### Vérifier le statut
```bash
curl -X GET http://localhost:3003/api/payments/status/tx_123456789
```

## 🔐 Sécurité

### Validation des Entrées
- **Joi schemas** : Validation stricte de toutes les entrées
- **Sanitization** : Protection contre les injections
- **Rate limiting** : Limitation des requêtes par IP

### Sécurité des Paiements
- **Signatures HMAC** : Vérification des webhooks
- **HTTPS obligatoire** : Chiffrement des communications
- **Tokens JWT** : Authentification des requêtes
- **PCI DSS** : Conformité aux standards de sécurité

### Gestion des Secrets
- **Variables d'environnement** : Jamais de secrets dans le code
- **Rotation des clés** : Changement régulier des secrets
- **Audit trails** : Journalisation des accès sensibles

## 📊 Monitoring et Logging

### Logs Structurés
```javascript
// Exemple de log de paiement
logger.payment('Processing payment', {
  transactionId: 'tx_123456789',
  amount: 2500,
  currency: 'EUR',
  gateway: 'stripe',
  userId: 'user_123'
});
```

### Métriques Prometheus
```javascript
// Compteurs de transactions
payment_service_payments_total{
  provider="stripe",
  status="completed",
  currency="EUR"
} 1250

// Histogramme des montants
payment_service_payment_amount_bucket{
  provider="stripe",
  currency="EUR",
  le="1000"
} 850
```

### Health Checks
```bash
# Health check général
curl http://localhost:3003/health

# Health check détaillé
curl http://localhost:3003/health/detailed

# Statut des passerelles
curl http://localhost:3003/health/providers
```

Note:
- `/health/providers`, `/health/config` et `/health/components/:provider` évaluent maintenant la configuration réellement exploitable.
- Une valeur placeholder comme `your_paypal_client_id` ou `sk_test_your_stripe_secret_key` n'est plus comptée comme provider configuré.

## 🧪 Tests

### Tests Unitaires
```bash
# Lancer tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Tests spécifiques
npm test -- --grep "PaymentService"
```

### Tests d'Integration
```bash
# Tests des routes API
npm run test:integration

# Tests des passerelles
npm run test:gateways

# Tests des webhooks
npm run test:webhooks
```

### Tests de Performance
```bash
# Tests de charge avec Artillery
npm run test:load

# Tests de stress
npm run test:stress
```

## 🚨 Gestion des Erreurs

### Types d'Erreurs

#### Erreurs de Passerelle
```javascript
{
  "success": false,
  "error": "PAYMENT_GATEWAY_ERROR",
  "message": "Stripe API error",
  "details": {
    "gateway": "stripe",
    "code": "card_declined",
    "type": "card_error"
  }
}
```

#### Erreurs de Validation
```javascript
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid payment data",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be greater than 0"
    }
  ]
}
```

#### Erreurs de Service
```javascript
{
  "success": false,
  "error": "SERVICE_UNAVAILABLE",
  "message": "Payment service temporarily unavailable",
  "retryAfter": 30
}
```

### Stratégie de Retry
- **Exponentiel backoff** : Délai croissant entre les tentatives
- **Circuit breaker** : Arrêt temporaire en cas d'échecs répétés
- **Dead letter queue** : Stockage des transactions échouées

## 🔄 Déploiement

### Déploiement en Production

1. **Build de l'image**
```bash
docker build -t payment-service:latest .
```

2. **Push dans le registre**
```bash
docker push registry.example.com/payment-service:latest
```

3. **Déploiement Kubernetes**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payment-service
  template:
    metadata:
      labels:
        app: payment-service
    spec:
      containers:
      - name: payment-service
        image: payment-service:latest
        ports:
        - containerPort: 3003
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
```

### Configuration de l'Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payment-service-ingress
spec:
  rules:
  - host: payments.eventplanner.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 3003
```

## 📈 Performance et Scalabilité

### Optimisations
- **Connection pooling** : Pool de connexions PostgreSQL
- **Caching Redis** : Mise en cache des données fréquemment accessibles
- **Async/await** : Opérations asynchrones pour la concurrence
- **Compression gzip** : Réduction de la taille des réponses

### Scalabilité Horizontale
- **Stateless design** : Pas d'état local dans le service
- **Load balancing** : Répartition de charge entre les instances
- **Auto-scaling** : Adaptation automatique du nombre d'instances

### Monitoring de Performance
- **Response time** : Temps de réponse moyen < 200ms
- **Throughput** : > 1000 transactions/secondes
- **Error rate** : < 0.1% d'erreurs
- **Availability** : > 99.9% de disponibilité

## 🔧 Maintenance

### Mises à Jour
1. **Backup de la base de données**
2. **Migration des schémas**
3. **Rolling update des instances**
4. **Vérification post-déploiement**

### Nettoyage
- **Purge des logs** : Rotation automatique après 30 jours
- **Archivage des transactions** : Transactions > 2 ans archivées
- **Nettoyage du cache** : Cache Redis nettoyé quotidiennement

### Sauvegardes
- **Base de données** : Backup quotidien automatique
- **Configuration** : Versioning dans Git
- **Secrets** : Stockage sécurisé dans Vault

## 🤝 Contribution

### Guidelines de Développement
1. **Code style** : ESLint + Prettier
2. **Commits** : Conventional commits
3. **Tests** : Couverture minimale de 80%
4. **Documentation** : Mise à jour des README et API docs

### Processus de Review
1. **Pull request** : Création avec description détaillée
2. **Review automatique** : Tests et linting
3. **Review manuel** : Validation par un autre développeur
4. **Merge** : Intégration dans la branche principale

## 📞 Support

### Documentation Technique
- **API docs** : `/api/docs` (Swagger)
- **Architecture docs** : `/docs/architecture.md`
- **Database schema** : `/docs/database.md`

### Support Opérationnel
- **Monitoring** : Grafana + Prometheus
- **Alerting** : Slack/Email notifications
- **On-call** : Rotation d'équipe 24/7

### Contact
- **Équipe de développement** : dev-team@eventplanner.com
- **Support production** : ops-team@eventplanner.com
- **Documentation** : docs@eventplanner.com

---

## 📝 Historique des Versions

### v2.1.0 (Dernière)
- ✅ Ajout support MTN Mobile Money
- ✅ Amélioration des webhooks
- ✅ Optimisation des performances

### v2.0.0
- ✅ Refactor architecture microservices
- ✅ Ajout gestion des wallets
- ✅ Nouveau système de commissions

### v1.0.0
- ✅ Version initiale
- ✅ Support Stripe et PayPal
- ✅ API REST complète

---

**🎉 Merci d'utiliser le Payment Service !**

Pour toute question ou suggestion, n'hésitez pas à contacter l'équipe de développement.
