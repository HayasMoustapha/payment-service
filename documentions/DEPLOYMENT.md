# Payment Service Deployment Guide

## Overview

This guide covers the deployment of the Event Planner Payment Service in production environments, including Docker setup, monitoring, and best practices.

## Prerequisites

- Node.js 18+ runtime
- PostgreSQL 13+ database
- Redis 6+ for caching (optional)
- Docker & Docker Compose
- SSL certificates for production
- Payment provider accounts (Stripe, PayPal, etc.)

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file:

```bash
# Application
NODE_ENV=production
PORT=3003
LOG_LEVEL=info

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=event_planner_payments
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSL=true

# Redis (optional)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=24h

# Payment Providers
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id

CINETPAY_API_KEY=your-cinetpay-api-key
CINETPAY_SITE_ID=your-cinetpay-site-id
CINETPAY_SECRET_KEY=your-cinetpay-secret-key

MTN_MOMO_API_KEY=your-mtn-momo-api-key
MTN_MOMO_SECRET_KEY=your-mtn-momo-secret-key
MTN_MOMO_USER_ID=your-mtn-momo-user-id

# External Services
TICKET_GENERATOR_URL=https://ticket-generator.eventplanner.com
SCAN_SERVICE_URL=https://scan-validation.eventplanner.com
NOTIFICATION_SERVICE_URL=https://notifications.eventplanner.com

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Security
CORS_ORIGIN=https://app.eventplanner.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Development Environment Variables

Create a `.env.development` file:

```bash
NODE_ENV=development
PORT=3003
DB_HOST=localhost
DB_NAME=event_planner_payments_dev
DB_USER=postgres
DB_PASSWORD=password
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

---

## Database Setup

### Production Database

1. **Create Database:**
```sql
CREATE DATABASE event_planner_payments;
CREATE USER payment_service WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE event_planner_payments TO payment_service;
```

2. **Run Migrations:**
```bash
npm run migrate:prod
```

3. **Set Up Replication (High Availability):**
```sql
-- Primary server setup
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_password';
```

### Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_transactions_user_id ON transactions(user_id);
CREATE INDEX CONCURRENTLY idx_transactions_status ON transactions(status);
CREATE INDEX CONCURRENTLY idx_transactions_created_at ON transactions(created_at);
CREATE INDEX CONCURRENTLY idx_wallets_user_id ON wallets(user_id, user_type);
CREATE INDEX CONCURRENTLY idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX CONCURRENTLY idx_commissions_transaction_id ON commissions(transaction_id);
CREATE INDEX CONCURRENTLY idx_withdrawals_status ON withdrawals(status);

-- Partition large tables (optional for high volume)
CREATE TABLE transactions_2024 PARTITION OF transactions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

EXPOSE 3003

CMD ["node", "src/server.js"]
```

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  payment-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: event_planner_payments
      POSTGRES_USER: payment_service
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payment_service -d event_planner_payments"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - payment-service
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Nginx Configuration

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream payment_service {
        server payment-service:3003;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=payments:10m rate=5r/s;

    server {
        listen 80;
        server_name api.eventplanner.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.eventplanner.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Payment endpoints with stricter rate limiting
        location /api/payments/process {
            limit_req zone=payments burst=5 nodelay;
            proxy_pass http://payment_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # General API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://payment_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://payment_service;
            access_log off;
        }
    }
}
```

---

## Kubernetes Deployment

### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: payment-service

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: payment-config
  namespace: payment-service
data:
  NODE_ENV: "production"
  PORT: "3003"
  DB_HOST: "postgres-service"
  REDIS_HOST: "redis-service"
```

### Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: payment-secrets
  namespace: payment-service
type: Opaque
data:
  DB_PASSWORD: <base64-encoded-password>
  JWT_SECRET: <base64-encoded-jwt-secret>
  STRIPE_SECRET_KEY: <base64-encoded-stripe-key>
  PAYPAL_CLIENT_SECRET: <base64-encoded-paypal-secret>
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  namespace: payment-service
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
        image: eventplanner/payment-service:latest
        ports:
        - containerPort: 3003
        envFrom:
        - configMapRef:
            name: payment-config
        - secretRef:
            name: payment-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: payment-service
  namespace: payment-service
spec:
  selector:
    app: payment-service
  ports:
  - port: 80
    targetPort: 3003
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payment-ingress
  namespace: payment-service
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.eventplanner.com
    secretName: payment-tls
  rules:
  - host: api.eventplanner.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 80
```

---

## Monitoring and Logging

### Prometheus Metrics

```javascript
// src/metrics.js
const promClient = require('prom-client');

const register = new promClient.Registry();

// Default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const paymentTransactionsTotal = new promClient.Counter({
  name: 'payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['gateway', 'status'],
  registers: [register]
});

const walletBalance = new promClient.Gauge({
  name: 'wallet_balance',
  help: 'Current wallet balance',
  labelNames: ['user_type', 'currency'],
  registers: [register]
});

module.exports = {
  register,
  httpRequestDuration,
  paymentTransactionsTotal,
  walletBalance
};
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Payment Service Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Payment Transactions",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(payment_transactions_total[1h])",
            "legendFormat": "{{gateway}} - {{status}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx Errors"
          }
        ]
      }
    ]
  }
}
```

### Structured Logging

```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'payment-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

---

## Security Best Practices

### SSL/TLS Configuration

```bash
# Generate SSL certificates with Let's Encrypt
certbot certonly --webroot -w /var/www/html -d api.eventplanner.com

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### Environment Security

```bash
# Secure environment files
chmod 600 .env.production
chown app:app .env.production

# Use secrets management in production
# AWS Secrets Manager, HashiCorp Vault, or Kubernetes Secrets
```

### Database Security

```sql
-- Enable row-level security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY user_transactions ON transactions
    FOR ALL TO payment_service
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- Encrypt sensitive columns
ALTER TABLE wallets 
    ALTER COLUMN balance TYPE numeric(15,2) USING balance::numeric(15,2);
```

---

## Performance Optimization

### Caching Strategy

```javascript
// src/cache/redis.js
const redis = require('redis');

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

// Cache wallet balances for 5 minutes
const cacheWalletBalance = async (userId, userType, balance) => {
  const key = `wallet:${userId}:${userType}`;
  await client.setex(key, 300, JSON.stringify(balance));
};

const getCachedWalletBalance = async (userId, userType) => {
  const key = `wallet:${userId}:${userType}`;
  const cached = await client.get(key);
  return cached ? JSON.parse(cached) : null;
};
```

### Database Connection Pooling

```javascript
// src/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## Deployment Scripts

### Automated Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting Payment Service Deployment..."

# Build Docker image
echo "📦 Building Docker image..."
docker build -t eventplanner/payment-service:$BUILD_NUMBER .

# Push to registry
echo "📤 Pushing to registry..."
docker push eventplanner/payment-service:$BUILD_NUMBER

# Deploy to Kubernetes
echo "☸️ Deploying to Kubernetes..."
kubectl set image deployment/payment-service payment-service=eventplanner/payment-service:$BUILD_NUMBER -n payment-service

# Wait for rollout
echo "⏳ Waiting for rollout..."
kubectl rollout status deployment/payment-service -n payment-service --timeout=300s

# Health check
echo "🏥 Running health check..."
kubectl exec -n payment-service deployment/payment-service -- curl -f http://localhost:3003/health

echo "✅ Deployment completed successfully!"
```

### Database Migration Script

```bash
#!/bin/bash
# migrate.sh

set -e

echo "🗄️ Running database migrations..."

# Backup current database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run migrate:prod

echo "✅ Database migrations completed!"
```

---

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
```bash
# Check database connectivity
docker exec -it payment-service npm run db:check

# View connection pool status
docker exec -it payment-service npm run db:pool-status
```

2. **Payment Gateway Issues**
```bash
# Test gateway connectivity
curl -X POST http://localhost:3003/api/payments/gateways/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"gateway": "stripe"}'
```

3. **High Memory Usage**
```bash
# Monitor memory usage
docker stats payment-service

# Check for memory leaks
docker exec -it payment-service npm run memory:profile
```

### Log Analysis

```bash
# View error logs
docker logs payment-service | grep ERROR

# Monitor payment failures
docker logs payment-service | grep "payment.*failed"

# Analyze response times
docker logs payment-service | grep "duration_ms" | awk '{print $NF}' | sort -n
```

---

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/payment-service"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Upload to S3 (or other storage)
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://eventplanner-backups/payment-service/

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Disaster Recovery

```bash
#!/bin/bash
# recovery.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

echo "🔄 Starting disaster recovery..."

# Stop application
kubectl scale deployment payment-service --replicas=0 -n payment-service

# Restore database
gunzip -c $BACKUP_FILE | psql $DATABASE_URL

# Restart application
kubectl scale deployment payment-service --replicas=3 -n payment-service

echo "✅ Disaster recovery completed!"
```

---

This deployment guide provides a comprehensive approach to deploying the Payment Service in production with proper security, monitoring, and reliability measures.
