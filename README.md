# 💳 Event Planner - Service de Paiement

## 📋 Description

Le service de Paiement gère toutes les transactions financières de la plateforme Event Planner: achats de billets, abonnements, remboursements, et intégrations avec les providers de paiement.

## 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                PAYMENT SERVICE (Port 3003)                  │
├─────────────────────────────────────────────────────────────┤
│  📦 Modules Principaux:                                      │
│  ├── payments/       (Transactions Stripe/PayPal)           │
│  ├── refunds/        (Gestion remboursements)                │
│  ├── invoices/       (Facturation PDF)                       │
│  ├── webhooks/       (Webhooks providers)                    │
│  └── subscriptions/  (Abonnements récurrents)                │
│                                                             │
│  🔧 Technologies:                                            │
│  ├── Node.js + Express                                      │
│  ├── PostgreSQL (Historique transactions)                    │
│  ├── Stripe (Paiement cartes)                               │
│  ├── PayPal (Paiement PayPal)                               │
│  ├── PDFKit (Génération factures)                           │
│  └── Redis (Cache sessions)                                 │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Démarrage Rapide

### Installation
```bash
cd event-planner-backend/payment-service
npm install
cp .env.example .env
npm run db:up && npm run db:migrate
npm run dev
```

### Vérification
```bash
curl http://localhost:3003/health
# Retourne: {"status": "healthy", "service": "payment-service"}
```

## 📡 API Endpoints

### 💳 Paiements
```http
POST /api/payments/create           (Créer intention paiement)
POST /api/payments/confirm          (Confirmer paiement)
GET  /api/payments/:id              (Détails paiement)
POST /api/payments/:id/cancel       (Annuler paiement)
```

### 💰 Remboursements
```http
POST /api/refunds/create            (Créer remboursement)
GET  /api/refunds/:id               (Détails remboursement)
POST /api/refunds/:id/cancel        (Annuler remboursement)
```

### 🧾 Factures
```http
GET  /api/invoices/:id              (Télécharger facture PDF)
POST /api/invoices/create           (Générer facture)
GET  /api/invoices/list             (Lister factures)
```

### 🔄 Webhooks
```http
POST /api/webhooks/stripe           (Webhook Stripe)
POST /api/webhooks/paypal           (Webhook PayPal)
```

## 🔧 Configuration Essentielle

```bash
# Base de données
DATABASE_URL=postgresql://user:pass@localhost:5432/event_planner_payments

# Redis
REDIS_URL=redis://localhost:6379

# Authentification
SHARED_SERVICE_TOKEN=shared-service-token-abcdef12345678901234567890
AUTH_SERVICE_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxx

# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret
PAYPAL_WEBHOOK_ID=your-webhook-id

# Serveur
PORT=3003
NODE_ENV=development
```

## 💳 Flux de Paiement

### 1. Création Paiement
```mermaid
sequenceDiagram
    participant Client
    participant PaymentAPI
    participant Stripe
    participant Database

    Client->>PaymentAPI: POST /api/payments/create
    PaymentAPI->>Stripe: Créer PaymentIntent
    Stripe-->>PaymentAPI: client_secret
    PaymentAPI->>Database: Sauvegarder transaction
    PaymentAPI-->>Client: client_secret
```

### 2. Confirmation Paiement
```mermaid
sequenceDiagram
    participant Client
    participant PaymentAPI
    participant Stripe
    participant Database
    participant NotifService

    Client->>PaymentAPI: POST /api/payments/confirm
    PaymentAPI->>Stripe: Confirmer PaymentIntent
    Stripe-->>PaymentAPI: Paiement réussi
    PaymentAPI->>Database: Mettre à jour statut
    PaymentAPI->>NotifService: Notifier succès
    PaymentAPI-->>Client: Confirmation
```

## 📊 Base de Données

### Tables Principales
```sql
payments         -- Transactions principales
refunds          -- Remboursements
invoices         -- Factures générées
payment_methods  -- Méthodes paiement sauvegardées
webhook_logs     -- Logs webhooks providers
```

## 🧪 Tests Rapides

```bash
# Créer paiement
curl -X POST http://localhost:3003/api/payments/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 4900,
    "currency": "eur",
    "eventId": 123,
    "ticketType": "vip"
  }'

# Confirmer paiement
curl -X POST http://localhost:3003/api/payments/confirm \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "pi_xxxxxxxxxxxxxx",
    "paymentMethodId": "pm_xxxxxxxxxxxxxx"
  }'
```

## 🚨 Erreurs Communes

### 1. "Payment failed"
- Vérifier validité carte
- Confirmer 3D Secure si requis

### 2. "Insufficient funds"
- Vérifier solde compte
- Proposer autre méthode paiement

### 3. "Webhook signature invalid"
- Vérifier secret webhook
- Confirmer endpoint correct

## 📈 Monitoring

```bash
# Transactions réussies
grep "payment.*success" logs/payment.log

# Erreurs Stripe
grep "stripe.*error" logs/payment.log

# Webhooks reçus
grep "webhook.*received" logs/payment.log
```

## 💡 Tips Importants

- **Toujours** vérifier le statut du paiement avant de générer un billet
- **Utiliser** les webhooks pour les mises à jour de statut en temps réel
- **Sauvegarder** les méthodes de paiement pour les achats futurs
- **Implémenter** des retries pour les webhooks en cas d'échec

---

**💳 Ce service transforme les clics en transactions sécurisées !**
