# Payment Service API Routes Documentation

## Overview

This document provides a comprehensive overview of all available API routes in the Payment Service. The service runs on port **3003** and provides complete payment processing functionality with Stripe and PayPal integration, invoice generation, refunds, wallet management, and commission tracking.

## Base URL

```
http://localhost:3003/api
```

## Authentication

All routes (except health endpoints) require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Modules

### 1. Payments Module

#### Payment Operations
- `POST /api/payments` - Create a new payment
- `GET /api/payments/:paymentId` - Get payment details by ID
- `GET /api/payments/user/:userId` - Get payments for a specific user
- `POST /api/payments/:paymentId/capture` - Capture a payment
- `POST /api/payments/:paymentId/cancel` - Cancel a payment
- `GET /api/payments` - List payments with filters

#### Query Parameters (List Payments)
- `eventId` - Filter by event ID
- `status` - Filter by status (pending, completed, failed, cancelled)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

---

### 2. Stripe Payments Module

#### Payment Intents
- `POST /api/stripe/payment-intent` - Create a Stripe payment intent
- `GET /api/stripe/payment-intent/:paymentIntentId` - Get payment intent details
- `POST /api/stripe/confirm` - Confirm a payment intent

#### Customer Management
- `POST /api/stripe/customers` - Create a Stripe customer
- `GET /api/stripe/customers/:customerId` - Get customer details

#### Payment Methods
- `POST /api/stripe/payment-methods` - Create a Stripe payment method
- `GET /api/stripe/customers/:customerId/payment-methods` - Get customer's payment methods

---

### 3. Invoices Module

#### Invoice Operations
- `POST /api/invoices/generate` - Generate invoice PDF
- `GET /api/invoices/:invoiceId` - Get invoice details
- `GET /api/invoices/:invoiceId/download` - Download invoice PDF
- `GET /api/invoices` - List invoices with filters

#### Query Parameters (List Invoices)
- `status` - Filter by status (draft, sent, paid, void)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

---

### 4. Refunds Module

#### Refund Operations
- `POST /api/refunds/stripe` - Create a Stripe refund
- `POST /api/refunds/paypal` - Create a PayPal refund
- `GET /api/refunds/:refundId` - Get refund status by ID
- `GET /api/refunds` - List refunds with filters

#### Query Parameters (List Refunds)
- `status` - Filter by status (pending, succeeded, failed, cancelled)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

---

### 5. Payment Methods Module

#### Payment Method Management
- `GET /api/payment-methods` - Get user's payment methods
- `POST /api/payment-methods` - Add a new payment method
- `PUT /api/payment-methods/:methodId` - Update payment method
- `DELETE /api/payment-methods/:methodId` - Delete payment method

#### Query Parameters (Get Payment Methods)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

---

### 6. Wallets Module

#### Wallet Management
- `GET /api/wallets/balance` - Get wallet balance
- `GET /api/wallets/transactions` - Get wallet transactions
- `GET /api/wallets/statistics` - Get wallet statistics

#### Withdrawals
- `POST /api/wallets/withdrawals` - Create withdrawal request
- `GET /api/wallets/withdrawals` - Get withdrawal requests

#### Commissions
- `GET /api/wallets/commissions/statistics` - Get commission statistics
- `GET /api/wallets/commissions/user` - Get user commissions
- `GET /api/wallets/commissions/rates` - Get commission rates

#### Commission Projections
- `POST /api/wallets/commissions/projections` - Create commission projection
- `GET /api/wallets/commissions/projections` - Get commission projections
- `GET /api/wallets/commissions/projections/:projectionId` - Get projection by ID
- `POST /api/wallets/commissions/projections/:projectionId/settle` - Settle projection

#### Query Parameters
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

---

### 7. Health & Monitoring

#### Health Checks
- `GET /health` - Basic health check (no authentication required)
- `GET /health/detailed` - Detailed health check (authentication required)
- `GET /health/ready` - Readiness probe for Kubernetes
- `GET /health/live` - Liveness probe for Kubernetes
- `GET /health/providers` - Get payment providers status

---

## Payment Flow Examples

### Stripe Payment Flow
1. `POST /api/stripe/payment-intent` - Create payment intent
2. `POST /api/stripe/confirm` - Confirm payment
3. `POST /api/invoices/generate` - Generate invoice (optional)

### Refund Flow
1. `POST /api/refunds/stripe` - Create refund
2. `GET /api/refunds/:refundId` - Check refund status

### Wallet Withdrawal Flow
1. `POST /api/wallets/withdrawals` - Request withdrawal
2. `GET /api/wallets/withdrawals` - Track withdrawal status

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

## Success Responses

Most endpoints return consistent success responses:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

## Payment Status Values

- `pending` - Payment initiated but not completed
- `completed` - Payment successfully processed
- `failed` - Payment failed
- `cancelled` - Payment cancelled
- `refunded` - Payment refunded

## Refund Status Values

- `pending` - Refund initiated but not processed
- `succeeded` - Refund successfully processed
- `failed` - Refund failed
- `cancelled` - Refund cancelled

## Rate Limiting

API endpoints may be rate limited. Check response headers for rate limit information.

## Permissions

All endpoints require specific permissions. Permission format: `module.action` (e.g., `payments.create`, `wallets.read`).

## Webhooks

The service supports webhooks for:
- Payment status updates
- Refund status updates
- Withdrawal completions

Configure webhooks in your payment provider dashboard.

## Postman Collection

A complete Postman collection with all 35 routes is available in:
- `postman/payment-service.postman_collection.json`

## Environment Variables

Required environment variables are defined in:
- `postman/Payment-Service.postman_environment.json`

---

**Last Updated:** January 27, 2026  
**Version:** 3.0.0  
**Total Routes:** 35
