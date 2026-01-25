# Payment Service API Documentation

## Overview

The Payment Service provides a comprehensive REST API for handling financial operations in the Event Planner platform. All endpoints require JWT authentication and proper permissions.

## Base URL

```
Production: https://api.eventplanner.com/payment
Development: http://localhost:3003
```

## Authentication

All requests must include a valid JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-25T12:00:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-25T12:00:00Z"
}
```

---

## Payments API

### Process Payment

Process a new payment transaction.

```http
POST /api/payments/process
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "eventId": "event-uuid",
  "amount": 100.00,
  "currency": "EUR",
  "paymentMethod": "stripe",
  "description": "Event ticket purchase",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "preferredGateways": ["stripe", "paypal"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn-uuid",
    "amount": 100.00,
    "currency": "EUR",
    "status": "pending",
    "gateway": "stripe",
    "clientSecret": "pi_...",
    "paymentUrl": "https://checkout.stripe.com/pay/..."
  }
}
```

### Purchase Template

Purchase a design template with automatic designer commission.

```http
POST /api/payments/templates/purchase
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "templateId": "template-uuid",
  "designerId": "designer-uuid",
  "amount": 50.00,
  "currency": "EUR",
  "paymentMethod": "stripe",
  "customerEmail": "buyer@example.com",
  "customerName": "Jane Smith"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn-uuid",
    "templateId": "template-uuid",
    "designerId": "designer-uuid",
    "amount": 50.00,
    "commissionAmount": 5.00,
    "designerEarnings": 45.00,
    "status": "pending",
    "paymentUrl": "https://checkout.stripe.com/pay/..."
  }
}
```

### Get Payment Status

Retrieve the current status of a payment transaction.

```http
GET /api/payments/status/{transactionId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn-uuid",
    "userId": "user-uuid",
    "amount": 100.00,
    "currency": "EUR",
    "status": "completed",
    "gateway": "stripe",
    "gatewayTransactionId": "pi_...",
    "createdAt": "2024-01-25T10:00:00Z",
    "updatedAt": "2024-01-25T10:05:00Z",
    "metadata": { ... }
  }
}
```

### Get Payment Statistics

Retrieve payment statistics for a user or globally.

```http
GET /api/payments/statistics?userId=user-uuid&startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 150,
    "totalAmount": 15000.00,
    "successRate": 95.5,
    "averageAmount": 100.00,
    "gatewayStats": {
      "stripe": { "count": 100, "amount": 10000.00 },
      "paypal": { "count": 50, "amount": 5000.00 }
    },
    "currencyBreakdown": {
      "EUR": { "count": 120, "amount": 12000.00 },
      "USD": { "count": 30, "amount": 3000.00 }
    }
  }
}
```

### Get Available Gateways

List all available payment gateways with their capabilities.

```http
GET /api/payments/gateways
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "stripe",
      "name": "Stripe",
      "isDefault": true,
      "supportedCurrencies": ["EUR", "USD", "GBP"],
      "minAmount": 0.50,
      "maxAmount": 100000.00,
      "features": ["cards", "apple_pay", "google_pay"]
    },
    {
      "code": "paypal",
      "name": "PayPal",
      "isDefault": false,
      "supportedCurrencies": ["EUR", "USD"],
      "minAmount": 0.50,
      "maxAmount": 100000.00,
      "features": ["paypal_balance", "cards"]
    }
  ]
}
```

---

## Wallets API

### Get Wallet Balance

Retrieve the current balance of a user's wallet.

```http
GET /api/wallets/balance?userType=designer
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1250.50,
    "currency": "EUR",
    "userId": "user-uuid",
    "userType": "designer",
    "lastUpdated": "2024-01-25T11:30:00Z"
  }
}
```

### Get Wallet Transactions

Retrieve transaction history for a user's wallet.

```http
GET /api/wallets/transactions?userType=designer&page=1&limit=20&transactionType=credit
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn-uuid",
        "amount": 45.00,
        "transactionType": "credit",
        "referenceType": "template_sale",
        "referenceId": "template-uuid",
        "description": "Template sale commission",
        "balanceBefore": 1205.50,
        "balanceAfter": 1250.50,
        "createdAt": "2024-01-25T10:00:00Z",
        "metadata": { ... }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Get Wallet Statistics

Retrieve wallet statistics for a user.

```http
GET /api/wallets/statistics?userType=designer&startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalTransactions": 50,
      "creditTransactions": 35,
      "debitTransactions": 15,
      "totalCredits": 2000.00,
      "totalDebits": 750.00,
      "netAmount": 1250.00,
      "averageCredit": 57.14,
      "averageDebit": 50.00
    },
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  }
}
```

### Create Withdrawal Request

Request a withdrawal from wallet to bank account or other payment method.

```http
POST /api/wallets/withdrawals
```

**Request Body:**
```json
{
  "amount": 500.00,
  "withdrawalMethod": "bank_transfer",
  "withdrawalDetails": {
    "recipientName": "John Designer",
    "bankAccount": "FR7630006000011234567890189",
    "iban": "FR7630006000011234567890189",
    "swift": "BNPAFRPPXXX"
  },
  "userType": "designer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "withdrawalId": "withdrawal-uuid",
    "amount": 500.00,
    "processingFee": 10.00,
    "totalAmount": 510.00,
    "status": "pending",
    "requestedAt": "2024-01-25T12:00:00Z",
    "estimatedProcessingTime": "3-5 business days"
  }
}
```

### Get Withdrawals

Retrieve withdrawal history for a user.

```http
GET /api/wallets/withdrawals?userType=designer&page=1&limit=20&status=completed
```

**Response:**
```json
{
  "success": true,
  "data": {
    "withdrawals": [
      {
        "id": "withdrawal-uuid",
        "amount": 500.00,
        "status": "completed",
        "withdrawalMethod": "bank_transfer",
        "withdrawalDetails": { ... },
        "requestedAt": "2024-01-25T12:00:00Z",
        "processedAt": "2024-01-28T15:30:00Z",
        "providerWithdrawalId": "po_...",
        "rejectionReason": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  }
}
```

---

## Commissions API

### Get Commission Statistics

Retrieve platform commission statistics.

```http
GET /api/commissions/statistics?startDate=2024-01-01&endDate=2024-01-31&commissionType=template_sale
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalCommissions": 500,
      "totalAmount": 5000.00,
      "totalCollected": 4750.00,
      "totalPending": 250.00,
      "collectionRate": 95.0,
      "details": [
        {
          "commissionType": "template_sale",
          "status": "completed",
          "count": 400,
          "totalAmount": 4000.00,
          "averageAmount": 10.00,
          "collectedAmount": 4000.00,
          "pendingAmount": 0.00
        }
      ]
    },
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  }
}
```

### Get User Commissions

Retrieve commission history for a specific user.

```http
GET /api/commissions/user?page=1&limit=20&commissionType=template_sale
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "id": "commission-uuid",
        "transactionId": "txn-uuid",
        "commissionRate": 0.10,
        "commissionAmount": 10.00,
        "commissionType": "template_sale",
        "status": "completed",
        "transactionAmount": 100.00,
        "currency": "EUR",
        "processedAt": "2024-01-25T10:05:00Z",
        "createdAt": "2024-01-25T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Get Commission Rates

Retrieve current commission rates.

```http
GET /api/commissions/rates
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "type": "template_sale",
        "rate": 0.10,
        "percentage": 10.0
      },
      {
        "type": "ticket_sale",
        "rate": 0.05,
        "percentage": 5.0
      },
      {
        "type": "service_fee",
        "rate": 0.02,
        "percentage": 2.0
      }
    ]
  }
}
```

### Calculate Projected Commissions

Calculate projected commissions for future revenue.

```http
POST /api/commissions/projections
```

**Request Body:**
```json
{
  "templateSales": 10000.00,
  "ticketSales": 50000.00,
  "serviceFees": 2000.00,
  "withdrawals": 5000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templateSales": {
      "amount": 10000.00,
      "commission": {
        "originalAmount": 10000.00,
        "commissionRate": 0.10,
        "commissionAmount": 1000.00,
        "netAmount": 9000.00
      }
    },
    "ticketSales": {
      "amount": 50000.00,
      "commission": {
        "originalAmount": 50000.00,
        "commissionRate": 0.05,
        "commissionAmount": 2500.00,
        "netAmount": 47500.00
      }
    },
    "total": {
      "grossRevenue": 62000.00,
      "totalCommission": 3500.00,
      "netRevenue": 58500.00
    }
  }
}
```

---

## Webhooks API

### Process Webhook

Process incoming webhook from payment providers.

```http
POST /api/payments/webhooks/{gateway}
```

**Headers:**
```
Stripe-Signature: <signature>
PayPal-Transmission-Sig: <signature>
```

**Request Body:** (varies by provider)

**Response:**
```json
{
  "success": true,
  "data": {
    "eventType": "payment_intent.succeeded",
    "processed": true,
    "transactionId": "txn-uuid",
    "gateway": "stripe"
  }
}
```

---

## Health Check

### Service Health

Check the health status of the payment service.

```http
GET /health
```

**Response:**
```json
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

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request validation failed |
| `INSUFFICIENT_BALANCE` | Wallet balance insufficient |
| `INVALID_AMOUNT` | Amount outside allowed range |
| `GATEWAY_ERROR` | Payment gateway error |
| `TRANSACTION_NOT_FOUND` | Transaction not found |
| `WALLET_NOT_FOUND` | Wallet not found |
| `COMMISSION_ERROR` | Commission calculation error |
| `WITHDRAWAL_LIMIT_EXCEEDED` | Daily/monthly limit exceeded |
| `INVALID_GATEWAY` | Payment gateway not available |
| `WEBHOOK_VERIFICATION_FAILED` | Webhook signature invalid |

---

## Rate Limits

| Endpoint | Limit | Period |
|----------|-------|--------|
| `POST /api/payments/process` | 10 requests | 1 minute |
| `POST /api/wallets/withdrawals` | 5 requests | 1 minute |
| `GET /api/wallets/transactions` | 100 requests | 1 minute |
| Other endpoints | 1000 requests | 1 hour |

---

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class PaymentClient {
  constructor(baseURL, apiKey) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async processPayment(paymentData) {
    try {
      const response = await this.client.post('/api/payments/process', paymentData);
      return response.data;
    } catch (error) {
      throw new Error(error.response.data.error);
    }
  }

  async getWalletBalance(userId, userType = 'designer') {
    const response = await this.client.get(`/api/wallets/balance?userType=${userType}`);
    return response.data;
  }
}

// Usage
const client = new PaymentClient('https://api.eventplanner.com/payment', 'your-jwt-token');

const payment = await client.processPayment({
  userId: 'user-uuid',
  amount: 100.00,
  currency: 'EUR',
  paymentMethod: 'stripe'
});
```

### Python

```python
import requests

class PaymentClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def process_payment(self, payment_data):
        response = requests.post(
            f'{self.base_url}/api/payments/process',
            json=payment_data,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def get_wallet_balance(self, user_id, user_type='designer'):
        response = requests.get(
            f'{self.base_url}/api/wallets/balance',
            params={'userType': user_type},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Usage
client = PaymentClient('https://api.eventplanner.com/payment', 'your-jwt-token')
payment = client.process_payment({
    'userId': 'user-uuid',
    'amount': 100.00,
    'currency': 'EUR',
    'paymentMethod': 'stripe'
})
```
