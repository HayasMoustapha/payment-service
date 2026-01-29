# 💳 PAYMENT SERVICE - DOCUMENTATION

## 🎯 Présentation

Le **Payment Service** gère toutes les transactions financières de la plateforme Event Planner SaaS.

### Rôle principal
- 💳 **Paiements** : Intégration Stripe/PayPal
- 📄 **Facturation** : Génération de factures PDF
- 🔄 **Remboursements** : Gestion automatique et manuelle
- 📊 **Webhooks** : Traitement des événements de paiement

### Caractéristiques techniques
```
🚀 Port : 3003
💳 Providers : Stripe, PayPal
📄 Génération : Factures PDF avec templates
🔒 Sécurité : PCI DSS compliance
📊 Monitoring : Transactions en temps réel
```

## 🏗️ Architecture

### Stack Technique
```
┌─────────────────────────────────────────┐
│           PAYMENT SERVICE                │
├─────────────────────────────────────────┤
│ 📦 Node.js + Express.js                  │
│ 🗄️ PostgreSQL (transactions)             │
│ 💳 Stripe SDK                           │
│ 🅿️ PayPal SDK                          │
│ 📄 PDFKit (factures)                    │
│ 📊 Winston (logs)                        │
└─────────────────────────────────────────┘
```

## ⚡ Fonctionnalités

### 💳 Processus de paiement

#### Création de paiement
```javascript
POST /api/payments/create
{
  "eventId": 456,
  "guestId": 123,
  "amount": 299.99,
  "currency": "EUR",
  "provider": "stripe",
  "items": [
    {
      "name": "VIP Ticket",
      "quantity": 1,
      "price": 299.99
    }
  ],
  "metadata": {
    "ticketType": "VIP",
    "eventName": "Tech Conference 2024"
  }
}
```

#### Confirmation de paiement
```javascript
POST /api/payments/confirm
{
  "paymentIntentId": "pi_1234567890",
  "paymentMethodId": "pm_1234567890"
}
```

### 📄 Facturation

#### Génération de facture
```javascript
POST /api/invoices/generate
{
  "paymentId": 789,
  "template": "standard",
  "options": {
    "includeVAT": true,
    "VATRate": 0.20
  }
}
```

### 🔄 Remboursements

#### Remboursement partiel/complet
```javascript
POST /api/refunds/create
{
  "paymentId": 789,
  "amount": 149.99,
  "reason": "Customer request"
}
```

## 📚 API Reference

### Endpoints principaux

#### POST /api/payments/create
```javascript
// Response
{
  "success": true,
  "data": {
    "paymentId": 789,
    "clientSecret": "pi_1234567890_secret_...",
    "amount": 299.99,
    "currency": "EUR",
    "status": "requires_payment_method"
  }
}
```

#### GET /api/payments/:paymentId
```javascript
// Response
{
  "success": true,
  "data": {
    "id": 789,
    "status": "succeeded",
    "amount": 299.99,
    "currency": "EUR",
    "provider": "stripe",
    "paymentIntentId": "pi_1234567890",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

## 🚀 Guide de déploiement

### Configuration
```bash
# .env
NODE_ENV=production
PORT=3003

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Base de données
DB_HOST=localhost
DB_NAME=event_planner_payments
```

---

**Version** : 1.0.0  
**Port** : 3003
