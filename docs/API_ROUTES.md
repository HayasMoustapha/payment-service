# 💳 **Payment Service API Documentation**

## 🔐 **Authentication**

All protected routes require JWT authentication and appropriate permissions.

---

## 🏥 **Health Routes**

### Health Check
```
GET /health
```
- **Description**: Vérifier l'état général du service
- **Authentification**: Non requise
- **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-25T10:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Readiness Check
```
GET /health/ready
```
- **Description**: Vérifier si le service est prêt à accepter du trafic
- **Authentification**: Non requise
- **Response**:
```json
{
  "status": "ready",
  "checks": {
    "database": "healthy",
    "stripe": "healthy",
    "paypal": "healthy"
  }
}
```

### Liveness Check
```
GET /health/live
```
- **Description**: Vérifier si le service est en cours d'exécution
- **Authentification**: Non requise
- **Response**:
```json
{
  "status": "alive",
  "timestamp": "2024-01-25T10:00:00.000Z"
}
```

### Stripe Health
```
GET /health/components/stripe
```
- **Description**: Vérifier la connexion avec Stripe
- **Authentification**: Non requise
- **Response**:
```json
{
  "status": "healthy",
  "provider": "stripe",
  "last_check": "2024-01-25T10:00:00.000Z"
}
```

### PayPal Health
```
GET /health/components/paypal
```
- **Description**: Vérifier la connexion avec PayPal
- **Authentification**: Non requise
- **Response**:
```json
{
  "status": "healthy",
  "provider": "paypal",
  "last_check": "2024-01-25T10:00:00.000Z"
}
```

---

## 💳 **Payment Processing Routes**

### Create Stripe Payment Intent
```
POST /api/payments/stripe/payment-intent
```
- **Description**: Créer une intention de paiement Stripe
- **Authentification**: Requise
- **Permissions**: `payments.create`
- **Request Body**:
```json
{
  "userId": "user_123456",
  "eventId": "event_123456",
  "amount": 9999,
  "currency": "EUR",
  "paymentMethod": "stripe",
  "customerEmail": "user@example.com",
  "description": "Event ticket purchase",
  "metadata": {
    "ticketType": "VIP"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "transactionId": "txn_123456789",
  "status": "pending",
  "gateway": "stripe",
  "amount": 9999,
  "currency": "EUR",
  "clientSecret": "pi_123456789_secret",
  "requiresAction": false
}
```

### Create Stripe Checkout Session
```
POST /api/payments/stripe/checkout-session
```
- **Description**: Créer une session de checkout Stripe
- **Authentification**: Requise
- **Permissions**: `payments.create`
- **Request Body**:
```json
{
  "userId": "user_123456",
  "eventId": "event_123456",
  "amount": 9999,
  "currency": "EUR",
  "paymentMethod": "stripe",
  "successUrl": "https://app.example.com/payment/success",
  "cancelUrl": "https://app.example.com/payment/cancel",
  "customerEmail": "user@example.com",
  "description": "Event ticket purchase"
}
```
- **Response**:
```json
{
  "success": true,
  "transactionId": "txn_123456789",
  "status": "pending",
  "gateway": "stripe",
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_123456",
  "sessionId": "cs_123456789"
}
```

### Create PayPal Order
```
POST /api/payments/paypal/orders
```
- **Description**: Créer une commande PayPal
- **Authentification**: Requise
- **Permissions**: `payments.create`
- **Request Body**:
```json
{
  "userId": "user_123456",
  "eventId": "event_123456",
  "amount": 9999,
  "currency": "EUR",
  "paymentMethod": "paypal",
  "description": "Event ticket purchase",
  "returnUrl": "https://app.example.com/payment/success",
  "cancelUrl": "https://app.example.com/payment/cancel"
}
```
- **Response**:
```json
{
  "success": true,
  "transactionId": "txn_123456789",
  "status": "pending",
  "gateway": "paypal",
  "orderId": "PAY-123456789",
  "approvalUrl": "https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout"
}
```

---

## 🔄 **Refund Routes**

### Create Stripe Refund
```
POST /api/payments/refunds/stripe
```
- **Description**: Créer un remboursement Stripe
- **Authentification**: Requise
- **Permissions**: `refunds.create`
- **Request Body**:
```json
{
  "paymentIntentId": "pi_1234567890",
  "amount": 9999,
  "reason": "requested_by_customer",
  "metadata": {
    "refundReason": "Customer requested refund"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "refundId": "re_123456789",
  "status": "succeeded",
  "amount": 9999,
  "currency": "EUR"
}
```

### Create PayPal Refund
```
POST /api/payments/refunds/paypal
```
- **Description**: Créer un remboursement PayPal
- **Authentification**: Requise
- **Permissions**: `refunds.create`
- **Request Body**:
```json
{
  "captureId": "capture_123456",
  "amount": 9999,
  "reason": "Customer requested refund"
}
```
- **Response**:
```json
{
  "success": true,
  "refundId": "refund_123456",
  "status": "completed",
  "amount": 9999,
  "currency": "EUR"
}
```

---

## 🧾 **Invoice Routes**

### Generate Invoice
```
POST /api/payments/invoices/generate
```
- **Description**: Générer une facture
- **Authentification**: Requise
- **Permissions**: `invoices.create`
- **Request Body**:
```json
{
  "paymentId": "pay_123456",
  "customerInfo": {
    "name": "John Doe",
    "email": "user@example.com",
    "address": "123 Main St, City, State 12345"
  },
  "items": [
    {
      "description": "VIP Event Ticket",
      "quantity": 2,
      "unitPrice": 49.99,
      "total": 99.98
    }
  ],
  "taxAmount": 0.01,
  "totalAmount": 99.99,
  "notes": "Thank you for your purchase!"
}
```
- **Response**:
```json
{
  "success": true,
  "invoiceId": "inv_123456",
  "invoiceUrl": "https://example.com/invoices/inv_123456.pdf",
  "status": "generated"
}
```

---

## 🪝 **Webhook Routes**

### Stripe Webhook
```
POST /api/payments/webhooks/stripe
```
- **Description**: Webhook pour les événements Stripe
- **Authentification**: Non requise (signature vérifiée)
- **Request Body**:
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 9999,
      "currency": "eur",
      "status": "succeeded",
      "metadata": {
        "eventId": "event_123456"
      }
    }
  }
}
```
- **Response**:
```json
{
  "success": true,
  "processed": true
}
```

### PayPal Webhook
```
POST /api/payments/webhooks/paypal
```
- **Description**: Webhook pour les événements PayPal
- **Authentification**: Non requise (signature vérifiée)
- **Request Body**:
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "capture123",
    "status": "COMPLETED",
    "amount": {
      "currency_code": "EUR",
      "value": "99.99"
    }
  }
}
```
- **Response**:
```json
{
  "success": true,
  "processed": true
}
```

---

## 📊 **Transaction Management Routes**

### Get Transaction Status
```
GET /api/payments/transactions/:transactionId
```
- **Description**: Obtenir le statut d'une transaction
- **Authentification**: Requise
- **Permissions**: `transactions.read`
- **Response**:
```json
{
  "success": true,
  "transaction": {
    "id": "txn_123456789",
    "userId": "user_123456",
    "eventId": "event_123456",
    "amount": 9999,
    "currency": "EUR",
    "status": "completed",
    "paymentMethod": "stripe",
    "createdAt": "2024-01-25T10:00:00.000Z",
    "updatedAt": "2024-01-25T10:05:00.000Z"
  }
}
```

### Get User Transactions
```
GET /api/payments/transactions/user/:userId
```
- **Description**: Obtenir les transactions d'un utilisateur
- **Authentification**: Requise
- **Permissions**: `transactions.read`
- **Query Parameters**:
- `page`: Numéro de page (défaut: 1)
- `limit`: Nombre par page (défaut: 20)
- `status`: Filtre par statut (optionnel)
- **Response**:
```json
{
  "success": true,
  "transactions": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

## ❌ **Error Responses**

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation error",
  "message": "Invalid payment data",
  "details": {
    "amount": "Amount must be greater than 0",
    "currency": "Currency must be EUR or USD"
  }
}
```

### Authentication Error (401)
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Invalid or missing authentication token"
}
```

### Permission Error (403)
```json
{
  "success": false,
  "error": "Permission denied",
  "message": "Insufficient permissions to perform this action"
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "error": "Not found",
  "message": "Transaction not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## 🔒 **Rate Limiting**

- **Payment routes**: 10 requests per minute per user
- **Webhook routes**: 100 requests per minute per IP
- **Health routes**: No rate limiting

---

## 📝 **Notes**

- Tous les montants sont en **centimes** (ex: 9999 = 99.99 EUR)
- La devise par défaut est **EUR**
- Les webhooks sont authentifiés via signature cryptographique
- Les transactions sont automatiquement synchronisées avec la base de données
- Les commissions sont calculées et traitées automatiquement

---

*Last updated: January 25, 2026*
