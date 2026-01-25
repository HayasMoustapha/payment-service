# Event Planner Payment Service

Service de paiements multi-providers pour Event Planner - Gestion complète des transactions, wallets, commissions et paiements sortants.

## 🎯 **Vue d'Ensemble**

Le Payment Service est le cœur financier de la plateforme Event Planner, gérant :
- **Paiements entrants** : Vente tickets, achats templates
- **Wallets virtuels** : Portefeuilles designers et organisateurs
- **Commissions plateforme** : Calcul automatique des frais
- **Paiements sortants** : Reversements vers comptes bancaires/mobile money
- **Multi-providers** : Stripe, PayPal, CinetPay, MTN Mobile Money

---

## 🏗️ **Architecture**

### **Services Principaux**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Payment      │    │     Wallet        │    │   Commission     │
│   Service      │    │     Service        │    │   Service        │
│                │    │                    │    │                  │
│ • Transactions │    │ • Balance Mgmt    │    │ • Rate Calc      │
│ • Webhooks      │    │ • Transactions   │    │ • Processing    │
│ • Multi-Payments│    │ • Transfers       │    │ • Statistics    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                   ┌───────────────────────────────┐
                   │     Gateway Manager (Abstraction)     │
                   │                                     │
                   │ • Stripe • PayPal • CinetPay • MTN │
                   └───────────────────────────────┘
```

### **Base de Données**
```sql
-- Tables principales
transactions          -- Paiements entrants
wallets               -- Portefeuilles utilisateurs
wallet_transactions    -- Historique immuable
commissions           -- Commissions plateforme
withdrawals           -- Paiements sortants
payment_gateways       -- Configuration providers
```

---

## 🚀 **Fonctionnalités**

### 💳 **Paiements Entrants**
- **Multi-providers** : Stripe, PayPal, CinetPay, MTN Mobile Money
- **Multi-devises** : EUR, USD, XOF, XAF, UGX, GHS
- **Webhooks sécurisés** : Vérification signatures et parsing
- **Gestion d'erreurs** : Retry automatique et fallback
- **Templates** : Achat templates avec crédit designer automatique

### 👛 **Wallets Virtuels**
- **Un par utilisateur** : Designer ou Organisateur
- **Transactions immuables** : Historique complet non modifiable
- **Transferts** : Wallet-to-wallet avec validation
- **Multi-currency** : Support devises locales et internationales
- **Statistiques détaillées** : Suivi des mouvements

### 💼 **Commissions Plateforme**
- **Taux configurables** : Template (10%), Tickets (5%), etc.
- **Calcul automatique** : Déduction lors des ventes
- **Statistiques** : Suivi revenus plateforme
- **Projections** : Calculs commissions futures
- **Taux spéciaux** : Premium designers, entreprises

### 🏦 **Paiements Sortants**
- **Multi-méthodes** : Virement bancaire, PayPal, Mobile Money
- **Validation limites** : Quotidien/mensuel par utilisateur
- **Frais traitement** : Calcul automatique par méthode
- **Processing asynchrone** : Traitement automatique des demandes
- **Annulation & Remboursement** : Gestion des échecs

---

## 📊 **API Endpoints**

### **Paiements**
```http
POST   /api/payments/process          # Traiter un paiement
POST   /api/payments/templates/purchase # Acheter template
POST   /api/payments/webhooks/{gateway} # Webhook provider
GET    /api/payments/status/{id}       # Statut paiement
GET    /api/payments/statistics       # Statistiques
GET    /api/payments/gateways         # Providers disponibles
```

### **Wallets**
```http
GET    /api/wallets/balance           # Solde wallet
GET    /api/wallets/transactions       # Historique
POST   /api/wallets/withdrawals        # Demande retrait
GET    /api/wallets/statistics        # Statistiques wallet
POST   /api/wallets/transfer          # Transfert (admin)
```

### **Commissions**
```http
GET    /api/commissions/statistics    # Statistiques commissions
GET    /api/commissions/user          # Commissions utilisateur
GET    /api/commissions/rates          # Taux commissions
POST   /api/commissions/projections   # Projections
```

---

## 🔧 **Configuration**

### **Variables d'Environnement**
```bash
# Base de données
DB_NAME=event_planner_payments
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password

# Providers
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Services
TICKET_GENERATOR_URL=http://localhost:3004
SCAN_SERVICE_URL=http://localhost:3005

# Application
NODE_ENV=production
PORT=3003
JWT_SECRET=your-jwt-secret
```

### **Configuration Providers**
```sql
INSERT INTO payment_gateways (name, code, is_active, config, supported_currencies, min_amount, max_amount) VALUES
('Stripe', 'stripe', true, '{"api_key": "sk_test_..."}', '{"EUR", "USD"}', 0.50, 100000.00),
('PayPal', 'paypal', true, '{"client_id": "..."}', '{"EUR", "USD"}', 0.50, 100000.00),
('CinetPay', 'cinetpay', true, '{"api_key": "..."}', '{"XOF", "XAF", "EUR"}', 100.00, 1000000.00),
('MTN Mobile Money', 'mtn_momo', true, '{"api_key": "..."}', '{"XOF", "XAF", "UGX"}', 100.00, 500000.00);
```

---

## 🧪 **Tests**

### **Exécution des Tests**
```bash
# Installer les dépendances de test
npm install

# Tests unitaires
npm run test:unit

# Tests d'intégration
npm run test:integration

# Tests complets
npm test

# Couverture
npm run test:coverage

# Tests spécifiques
npm run test:payment
npm run test:wallet
npm run test:full-flow
```

### **Structure des Tests**
```
tests/
├── unit/
│   ├── payment.service.test.js      # Tests service paiements
│   ├── wallet.service.test.js        # Tests service wallets
│   └── commission.service.test.js    # Tests commissions
├── integration/
│   └── full-flow.test.js             # Tests flux complet
└── setup.js                        # Configuration Jest
```

---

## 📈 **Monitoring & Logging**

### **Métriques Clés**
- **Volume transactions** : Nombre et montant des paiements
- **Taux de conversion** : Success/failure par provider
- **Temps de traitement** : Moyenne par type de paiement
- **Solde wallets** : Total et distribution par type
- **Commissions** : Revenus plateforme par type

### **Logs Structurés**
```json
{
  "timestamp": "2024-01-25T12:00:00Z",
  "service": "payment-service",
  "operation": "process_payment",
  "user_id": "user-123",
  "transaction_id": "txn-456",
  "gateway": "stripe",
  "amount": 100.00,
  "currency": "EUR",
  "status": "success",
  "duration_ms": 1250
}
```

---

## 🔒 **Sécurité**

### **Validation des Entrées**
- **Schema validation** avec Joi pour tous les endpoints
- **Sanitization** des données utilisateur
- **Rate limiting** par IP et utilisateur
- **JWT authentication** pour tous les endpoints

### **Protection des Données**
- **Chiffrement** des données sensibles en base
- **Masquage** des logs pour les informations PII
- **HTTPS obligatoire** en production
- **CORS configuré** pour les domaines autorisés

### **Webhooks Sécurisés**
- **Signature verification** pour chaque provider
- **Replay protection** avec ID unique
- **Validation payload** avant traitement
- **Retry limit** pour éviter les boucles infinies

---

## 🚀 **Déploiement**

### **Docker**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3003

CMD ["npm", "start"]
```

### **Docker Compose**
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
      - DB_PORT=5432
      - DB_NAME=event_planner_payments
    depends_on:
      - postgres
    restart: unless-stopped
```

### **Health Checks**
```http
GET /health
{
  "status": "healthy",
  "timestamp": "2024-01-25T12:00:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "database": "connected",
  "gateways": {
    "stripe": "connected",
    "paypal": "connected",
    "cinetpay": "connected",
    "mtn_momo": "connected"
  }
}
```

---

## 📚 **Documentation Technique**

### **Architecture Décisions**
- **Séparation stricte** : Logique métier vs technique
- **Abstraction providers** : Interface unifiée pour tous les providers
- **Transactions ACID** : Garanties de consistance
- **Event-driven** : Webhooks pour communication asynchrone

### **Patterns Implémentés**
- **Gateway Pattern** : Abstraction multi-providers
- **Repository Pattern** : Accès base de données
- **Observer Pattern** : Notifications événements
- **Factory Pattern** : Création instances providers

### **Anti-Patterns Évités**
- **Pas de logique métier dans les providers**
- **Pas d'états partagés entre services**
- **Pas de synchronisation bloquante
- **Pas de requêtes N+1 dans les boucles

---

## 🤝 **Support & Maintenance**

### **Dépannage Commun**
```bash
# Vérifier l'état des services
curl http://localhost:3003/health

# Logs de l'application
docker logs payment-service

# Connexions base de données
docker exec -it postgres psql -U postgres -d event_planner_payments -c "SELECT COUNT(*) FROM transactions;"
```

### **Performance Monitoring**
- **Response times** : < 500ms pour 95% des requêtes
- **Database queries** : < 100ms pour requêtes simples
- **Memory usage** : < 512MB en fonctionnement normal
- **CPU usage** : < 70% en pic de charge

---

## 📝 **Changelog**

### **v1.0.0** (2024-01-25)
- ✅ Architecture multi-providers complète
- ✅ Wallets virtuels avec transactions immuables
- ✅ Système de commissions automatiques
- ✅ Paiements sortants multi-méthodes
- ✅ Tests unitaires et d'intégration complets
- ✅ Documentation technique complète

---

## 📞 **Contact & Support**

- **Documentation** : `/docs/api` (Swagger/OpenAPI)
- **Issues** : GitHub Issues
- **Support** : `support@eventplanner.com`
- **Status** : [status.eventplanner.com](https://status.eventplanner.com)

---

*Ce service est conçu pour être robuste, sécurisé et prêt pour une montée en charge internationale.*
npm run dev
```

## Docker

```bash
docker-compose up -d
```
