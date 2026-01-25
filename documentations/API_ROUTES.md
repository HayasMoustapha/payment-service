# Payment Service - API Routes Documentation

## Overview

Le Payment Service gère tous les aspects des paiements pour Event Planner, incluant Stripe, PayPal, les refunds, les factures et les méthodes de paiement.

## Base URL
```
http://localhost:3003/api/payments
```

## Authentication

Toutes les routes (sauf health checks) nécessitent une authentification JWT:
```
Authorization: Bearer <token>
```

## Permissions

Les permissions requises pour chaque route sont spécifiées ci-dessous.

---

## 🏠 **Health Routes**

### Simple Health Check
```
GET /health
```
- **Description**: Vérification simple de santé du service
- **Authentification**: Non requise
- **Permissions**: Aucune
- **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-25T15:30:00.000Z",
  "service": "payment-service",
  "version": "1.0.0"
}
```

### Detailed Health Check
```
GET /health/detailed
```
- **Description**: Vérification détaillée incluant tous les composants
- **Authentification**: Non requise
- **Permissions**: Aucune
- **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-25T15:30:00.000Z",
  "service": "payment-service",
  "version": "1.0.0",
  "components": {
    "database": { "status": "healthy" },
    "stripe": { "status": "healthy" },
    "paypal": { "status": "healthy" }
  }
}
```

---

## 💳 **Stripe Routes**

### Create Payment Intent
```
POST /api/payments/stripe/payment-intent
```
- **Description**: Crée un Payment Intent Stripe
- **Authentification**: Requise
- **Permissions**: `payments.create`
- **Request Body**:
```json
{
  "amount": 2999,
  "currency": "eur",
  "customerEmail": "user@example.com",
  "description": "Paiement pour événement EVT-123",
  "metadata": {
    "eventId": "EVT-123"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Stripe Payment Intent created successfully",
  "data": {
    "id": "pi_1234567890",
    "clientSecret": "pi_1234567890_secret_abc123",
    "amount": 2999,
    "currency": "eur",
    "status": "requires_payment_method",
    "created": 1643123456
  }
}
```

### Get Payment Intent
```
GET /api/payments/stripe/payment-intent/:paymentIntentId
```
- **Description**: Récupère un Payment Intent Stripe
- **Authentification**: Requise
- **Permissions**: `payments.read`
- **Response**:
```json
{
  "success": true,
  "message": "Payment Intent retrieved successfully",
  "data": {
    "id": "pi_1234567890",
    "amount": 2999,
    "currency": "eur",
    "status": "succeeded",
    "clientSecret": "pi_1234567890_secret_abc123",
    "created": 1643123456,
    "metadata": {
      "eventId": "EVT-123"
    }
  }
}
```

### Confirm Payment Intent
```
POST /api/payments/stripe/confirm
```
- **Description**: Confirme un Payment Intent Stripe
- **Authentification**: Requise
- **Permissions**: `payments.update`
- **Request Body**:
```json
{
  "paymentIntentId": "pi_1234567890",
  "paymentMethodId": "pm_1234567890"
}
```

### Create Customer
```
POST /api/payments/stripe/customers
```
- **Description**: Crée un client Stripe
- **Authentification**: Requise
- **Permissions**: `customers.create`
- **Request Body**:
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+33612345678"
}
```

### Get Customer
```
GET /api/payments/stripe/customers/:customerId
```
- **Description**: Récupère un client Stripe
- **Authentification**: Requise
- **Permissions**: `customers.read`

### Create Payment Method
```
POST /api/payments/stripe/payment-methods
```
- **Description**: Crée une méthode de paiement Stripe
- **Authentification**: Requise
- **Permissions**: `payment-methods.create`
- **Request Body**:
```json
{
  "customerId": "cus_1234567890",
  "paymentMethodId": "pm_1234567890",
  "isDefault": false
}
```

### Get Customer Payment Methods
```
GET /api/payments/stripe/customers/:customerId/payment-methods
```
- **Description**: Récupère les méthodes de paiement d'un client
- **Authentification**: Requise
- **Permissions**: `payment-methods.read`

---

## 🅿️ **PayPal Routes**

### Create Order
```
POST /api/payments/paypal/orders
```
- **Description**: Crée un ordre PayPal
- **Authentification**: Requise
- **Permissions**: `payments.create`
- **Request Body**:
```json
{
  "amount": {
    "currency_code": "EUR",
    "value": "29.99"
  },
  "description": "Billets pour événement EVT-123",
  "returnUrl": "https://app.eventplanner.com/payment/success",
  "cancelUrl": "https://app.eventplanner.com/payment/cancel"
}
```

### Get Order
```
GET /api/payments/paypal/orders/:orderId
```
- **Description**: Récupère un ordre PayPal
- **Authentification**: Requise
- **Permissions**: `payments.read`

### Capture Order
```
POST /api/payments/paypal/orders/:orderId/capture
```
- **Description**: Capture un ordre PayPal
- **Authentification**: Requise
- **Permissions**: `payments.update`

### Create Invoice
```
POST /api/payments/paypal/invoices
```
- **Description**: Crée une facture PayPal
- **Authentification**: Requise
- **Permissions**: `invoices.create`
- **Request Body**:
```json
{
  "amount": {
    "currency_code": "EUR",
    "value": "29.99"
  },
  "description": "Facture pour événement EVT-123",
  "merchantInfo": {
    "email": "merchant@eventplanner.com"
  },
  "billingInfo": [
    {
      "email": "customer@example.com",
      "name": {
        "given_name": "John",
        "surname": "Doe"
      }
    }
  ]
}
```

### Get Invoice
```
GET /api/payments/paypal/invoices/:invoiceId
```
- **Description**: Récupère une facture PayPal
- **Authentification**: Requise
- **Permissions**: `invoices.read`

---

## 🔄 **Refunds Routes**

### Create Stripe Refund
```
POST /api/payments/refunds/stripe
```
- **Description**: Crée un remboursement Stripe
- **Authentification**: Requise
- **Permissions**: `refunds.create`
- **Request Body**:
```json
{
  "paymentIntentId": "pi_1234567890",
  "amount": 1499,
  "reason": "requested_by_customer",
  "metadata": {
    "reason": "Customer requested partial refund"
  }
}
```

### Create PayPal Refund
```
POST /api/payments/refunds/paypal
```
- **Description**: Crée un remboursement PayPal
- **Authentification**: Requise
- **Permissions**: `refunds.create`
- **Request Body**:
```json
{
  "captureId": "CAPTURE-1234567890",
  "amount": {
    "currency_code": "EUR",
    "value": "14.99"
  },
  "reason": "Customer requested refund"
}
```

### Get Refund Status
```
GET /api/payments/refunds/:refundId
```
- **Description**: Récupère le statut d'un remboursement
- **Authentification**: Requise
- **Permissions**: `refunds.read`

### List Refunds
```
GET /api/payments/refunds
```
- **Description**: Liste les remboursements
- **Authentification**: Requise
- **Permissions**: `refunds.read`
- **Query Parameters**:
- `page`: Numéro de page (défaut: 1)
- `limit`: Nombre par page (défaut: 20)
- `provider`: Filtre par provider (stripe/paypal)
- `status`: Filtre par statut

---

## 🧾 **Invoices Routes**

### Generate Invoice PDF
```
POST /api/payments/invoices/generate
```
- **Description**: Génère un PDF de facture
- **Authentification**: Requise
- **Permissions**: `invoices.create`
- **Request Body**:
```json
{
  "transactionId": "TXN-1234567890",
  "template": "default",
  "includeTax": true
}
```

### Get Invoice
```
GET /api/payments/invoices/:invoiceId
```
- **Description**: Récupère une facture
- **Authentification**: Requise
- **Permissions**: `invoices.read`

### Download Invoice PDF
```
GET /api/payments/invoices/:invoiceId/download
```
- **Description**: Télécharge le PDF d'une facture
- **Authentification**: Requise
- **Permissions**: `invoices.read`
- **Response**: PDF file

### List Invoices
```
GET /api/payments/invoices
```
- **Description**: Liste les factures
- **Authentification**: Requise
- **Permissions**: `invoices.read`
- **Query Parameters**:
- `page`: Numéro de page (défaut: 1)
- `limit`: Nombre par page (défaut: 20)
- `provider`: Filtre par provider (stripe/paypal)
- `status`: Filtre par statut
- `customerId`: Filtre par client

---

## 💳 **Payment Methods Routes**

### Add Payment Method
```
POST /api/payments/payment-methods
```
- **Description**: Ajoute une méthode de paiement
- **Authentification**: Requise
- **Permissions**: `payment-methods.create`
- **Request Body**:
```json
{
  "type": "card",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  },
  "billing_details": {
    "name": "John Doe",
    "email": "john@example.com",
    "address": {
      "line1": "123 Rue de la République",
      "city": "Paris",
      "postal_code": "75001",
      "country": "FR"
    }
  },
  "isDefault": false
}
```

### Get User Payment Methods
```
GET /api/payments/payment-methods
```
- **Description**: Récupère les méthodes de paiement de l'utilisateur
- **Authentification**: Requise
- **Permissions**: `payment-methods.read`

### Update Payment Method
```
PUT /api/payments/payment-methods/:paymentMethodId
```
- **Description**: Met à jour une méthode de paiement
- **Authentification**: Requise
- **Permissions**: `payment-methods.update`
- **Request Body**:
```json
{
  "isDefault": true,
  "metadata": {
    "nickname": "Carte principale"
  }
}
```

### Delete Payment Method
```
DELETE /api/payments/payment-methods/:paymentMethodId
```
- **Description**: Supprime une méthode de paiement
- **Authentification**: Requise
- **Permissions**: `payment-methods.delete`

---

## 🔄 **Legacy Routes (Backward Compatibility)**

### Process Payment
```
POST /api/payments/process
```
- **Description**: Route générique de traitement de paiement (legacy)
- **Authentification**: Requise
- **Permissions**: `payments.create`

### Purchase Template
```
POST /api/payments/templates/purchase
```
- **Description**: Achat de template (legacy)
- **Authentification**: Requise
- **Permissions**: `payments.create`

### Get Payment Status
```
GET /api/payments/status/:transactionId
```
- **Description**: Statut de transaction (legacy)
- **Authentification**: Requise
- **Permissions**: `payments.read`

### Get Payment Statistics
```
GET /api/payments/statistics
```
- **Description**: Statistiques de paiements (legacy)
- **Authentification**: Requise
- **Permissions**: `payments.read`

### Get Available Gateways
```
GET /api/payments/gateways
```
- **Description**: Passerelles disponibles (legacy)
- **Authentification**: Requise
- **Permissions**: `payments.read`

### Handle Webhooks
```
POST /api/payments/webhooks/:gateway
```
- **Description**: Gestion des webhooks (legacy)
- **Authentification**: Non requise (signature verification)
- **Permissions**: Aucune

---

## 📊 **Error Responses**

Toutes les erreurs suivent ce format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description de l'erreur",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be at least 100 cents"
      }
    ]
  }
}
```

### Codes d'erreur communs:
- `VALIDATION_ERROR`: Erreur de validation des données
- `PAYMENT_FAILED`: Échec du paiement
- `INSUFFICIENT_PERMISSIONS`: Permissions insuffisantes
- `RESOURCE_NOT_FOUND`: Ressource non trouvée
- `PROVIDER_ERROR`: Erreur du provider (Stripe/PayPal)
- `RATE_LIMIT_EXCEEDED`: Limite de taux dépassée

---

## 🚀 **Rate Limiting**

- **Limite générale**: 100 requêtes par 15 minutes par IP
- **Limite paiements**: 5 paiements par minute par IP

---

## 📝 **Notes**

- Tous les montants sont en centimes pour Stripe, en format décimal pour PayPal
- Les timestamps sont en format ISO 8601
- Les IDs sont sensibles à la casse
- Les webhooks utilisent la vérification de signature pour la sécurité

---

## 🔗 **Liens Utiles**

- [Documentation Stripe](https://stripe.com/docs)
- [Documentation PayPal](https://developer.paypal.com/docs/)
- [Postman Collection](../postman/Payment-Service.postman_collection.json)
