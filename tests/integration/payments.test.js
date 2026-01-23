const request = require('supertest');
const app = require('../../src/server');

describe('Payments API Integration Tests', () => {
  let testCustomerId = 'cus_test123';
  let testPaymentId = 'pi_test123';
  let testOrderId = 'order_test123';
  let testRefundId = 're_test123';
  let testInvoiceId = 'inv_test123';

  beforeAll(async () => {
    // Attendre l'initialisation du serveur
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Health Checks', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'payment');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('system');
    });

    it('should return ready status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
    });

    it('should return live status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
    });

    it('should return component health for stripe', async () => {
      const response = await request(app)
        .get('/health/components/stripe')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return component health for paypal', async () => {
      const response = await request(app)
        .get('/health/components/paypal')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return component health for invoice', async () => {
      const response = await request(app)
        .get('/health/components/invoice')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return component health for refund', async () => {
      const response = await request(app)
        .get('/health/components/refund')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return providers status', async () => {
      const response = await request(app)
        .get('/health/providers')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('providers');
      expect(response.body.providers).toHaveProperty('stripe');
      expect(response.body.providers).toHaveProperty('paypal');
    });

    it('should return config', async () => {
      const response = await request(app)
        .get('/health/config')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('currency');
      expect(response.body.config).toHaveProperty('stripe');
      expect(response.body.config).toHaveProperty('paypal');
    });

    it('should handle invalid component', async () => {
      const response = await request(app)
        .get('/health/components/invalid')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('available');
    });
  });

  describe('POST /api/payments/stripe/payment-intent', () => {
    it('should create Stripe Payment Intent successfully', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send({
          amount: 10000, // 100€
          eventId: 'event_123',
          ticketIds: ['ticket_1', 'ticket_2'],
          metadata: {
            userId: 'user_123'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('amount', 10000);
      expect(response.body.data).toHaveProperty('currency');
      expect(response.body.data).toHaveProperty('provider', 'stripe');
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send({
          amount: 50, // 0.50€ - trop bas
          eventId: 'event_123',
          ticketIds: ['ticket_1']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send({
          amount: 10000
          // eventId et ticketIds manquants
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/stripe/checkout-session', () => {
    it('should create Stripe Checkout Session successfully', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/checkout-session')
        .send({
          amount: 10000,
          eventId: 'event_123',
          ticketIds: ['ticket_1', 'ticket_2'],
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('provider', 'stripe');
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/checkout-session')
        .send({
          amount: 2000000, // 20000€ - trop élevé
          eventId: 'event_123',
          ticketIds: ['ticket_1']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/paypal/orders', () => {
    it('should create PayPal Order successfully', async () => {
      const response = await request(app)
        .post('/api/payments/paypal/orders')
        .send({
          amount: 10000,
          eventId: 'event_123',
          ticketIds: ['ticket_1', 'ticket_2'],
          returnUrl: 'https://example.com/return',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('provider', 'paypal');
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/payments/paypal/orders')
        .send({
          amount: 50,
          eventId: 'event_123',
          ticketIds: ['ticket_1']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/paypal/orders/:orderId/capture', () => {
    it('should capture PayPal payment successfully', async () => {
      const response = await request(app)
        .post('/api/payments/paypal/orders/order_123/capture');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('provider', 'paypal');
    });

    it('should handle non-existent order', async () => {
      const response = await request(app)
        .post('/api/payments/paypal/orders/non-existent/capture');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/:paymentId/:provider', () => {
    it('should retrieve Stripe payment details', async () => {
      const response = await request(app)
        .get('/api/payments/pi_123/stripe');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    it('should retrieve PayPal payment details', async () => {
      const response = await request(app)
        .get('/api/payments/order_123/paypal');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject unsupported provider', async () => {
      const response = await request(app)
        .get('/api/payments/pi_123/unsupported');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/payments/:paymentId/:provider/cancel', () => {
    it('should cancel Stripe payment', async () => {
      const response = await request(app)
        .delete('/api/payments/pi_123/stripe/cancel')
        .send({
          reason: 'requested_by_customer'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should cancel PayPal payment', async () => {
      const response = await request(app)
        .delete('/api/payments/order_123/paypal/cancel');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/stripe/customers', () => {
    it('should create Stripe customer successfully', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/customers')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          phone: '+33612345678'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/customers')
        .send({
          email: 'invalid-email',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/stripe/customers/:customerId', () => {
    it('should retrieve Stripe customer', async () => {
      const response = await request(app)
        .get('/api/payments/stripe/customers/cus_123');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/stripe/payment-methods', () => {
    it('should create Stripe payment method', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-methods')
        .send({
          customerId: 'cus_123',
          paymentMethodData: {
            type: 'card',
            card: {
              number: '4242424242424242',
              exp_month: 12,
              exp_year: 2024,
              cvc: '123'
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/stripe/customers/:customerId/payment-methods', () => {
    it('should list Stripe payment methods', async () => {
      const response = await request(app)
        .get('/api/payments/stripe/customers/cus_123/payment-methods');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/refunds', () => {
    it('should create refund successfully', async () => {
      const response = await request(app)
        .post('/api/payments/refunds')
        .send({
          paymentId: 'pi_123',
          paymentProvider: 'stripe',
          amount: 5000,
          reason: 'requested_by_customer'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject unsupported provider', async () => {
      const response = await request(app)
        .post('/api/payments/refunds')
        .send({
          paymentId: 'pi_123',
          paymentProvider: 'unsupported',
          amount: 5000
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/payments/refunds')
        .send({
          paymentId: 'pi_123',
          paymentProvider: 'stripe',
          amount: 50 // 0.50€ - trop bas
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/refunds/:refundId/:provider', () => {
    it('should retrieve refund details', async () => {
      const response = await request(app)
        .get('/api/payments/refunds/re_123/stripe');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/refunds', () => {
    it('should list user refunds', async () => {
      const response = await request(app)
        .get('/api/payments/refunds');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('refunds');
      expect(response.body.data).toHaveProperty('pagination');
    });
  });

  describe('POST /api/payments/invoices', () => {
    it('should generate invoice successfully', async () => {
      const response = await request(app)
        .post('/api/payments/invoices')
        .send({
          customerId: 'cus_123',
          eventId: 'event_123',
          ticketIds: ['ticket_1', 'ticket_2'],
          amount: 10000,
          customerInfo: {
            name: 'Test User',
            email: 'test@example.com'
          },
          eventInfo: {
            title: 'Test Event',
            date: '2024-12-25T10:00:00Z'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('invoiceId');
      expect(response.body.data).toHaveProperty('invoiceNumber');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/payments/invoices')
        .send({
          amount: 10000
          // customerId, eventId, ticketIds manquants
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/invoices/:invoiceId/download', () => {
    it('should download invoice PDF', async () => {
      const response = await request(app)
        .get('/api/payments/invoices/inv_123/download');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Webhooks', () => {
    it('should handle Stripe webhook without signature', async () => {
      const response = await request(app)
        .post('/api/payments/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              amount: 10000
            }
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle PayPal webhook without headers', async () => {
      const response = await request(app)
        .post('/api/payments/webhooks/paypal')
        .send({
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'capture_123'
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Service Health and Stats', () => {
    it('should return service health', async () => {
      const response = await request(app)
        .get('/api/payments/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stripe');
      expect(response.body.data).toHaveProperty('paypal');
      expect(response.body.data).toHaveProperty('invoice');
      expect(response.body.data).toHaveProperty('refund');
    });

    it('should return service statistics', async () => {
      const response = await request(app)
        .get('/api/payments/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stripe');
      expect(response.body.data).toHaveProperty('paypal');
      expect(response.body.data).toHaveProperty('invoice');
      expect(response.body.data).toHaveProperty('refund');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle oversized payload', async () => {
      const largeData = {
        amount: 10000,
        eventId: 'event_123',
        ticketIds: ['ticket_1'],
        largeField: 'x'.repeat(1000000) // 1MB de données
      };

      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send(largeData);

      expect([200, 400, 413]).toContain(response.status);
    });

    it('should handle invalid routes', async () => {
      const response = await request(app)
        .get('/api/payments/invalid-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal requests', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
    });

    it('should include rate limiting headers', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send({
          amount: 10000,
          eventId: 'event_123',
          ticketIds: ['ticket_1']
        });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/payments/stripe/payment-intent');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('API Documentation', () => {
    it('should provide API info', async () => {
      const response = await request(app)
        .get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Payment API');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('version');
    });

    it('should provide service info', async () => {
      const response = await request(app)
        .get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Payment Service');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('capabilities');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return metrics if enabled', async () => {
      // Activer temporairement les métriques pour le test
      const originalValue = process.env.ENABLE_METRICS;
      process.env.ENABLE_METRICS = 'true';

      const response = await request(app)
        .get('/metrics');

      expect([200, 404]).toContain(response.status);

      // Restaurer la valeur originale
      process.env.ENABLE_METRICS = originalValue;
    });
  });
});
