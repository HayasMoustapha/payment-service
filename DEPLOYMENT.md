# Déploiement — Payment Service

**Service**: `payment-service`  
**Port**: `3003`

---

## 1. Prérequis

1. PostgreSQL (DB: `event_planner_payment`)
2. Redis (queues)
3. Node.js LTS + npm

---

## 2. Variables d’Environnement

1. Copier `.env.example` → `.env`
2. Renseigner:
   - DB + Redis
   - Stripe / PayPal (sandbox ou prod)
   - Gateways locaux (Orange Money, MTN, etc.)
   - `JWT_SECRET`

---

## 3. Installation

```
npm install
```

---

## 4. Démarrage

```
npm run start
```

---

## 5. Healthcheck

```
GET http://localhost:3003/api/health
```

