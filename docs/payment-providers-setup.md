# Payment Providers — Procédures officielles (référence)

Ce document rassemble les procédures d’intégration officielles pour chaque provider présent dans `.env.example` du `payment-service`.
Il sert de checklist de configuration et de flux de paiement, sans modifier la logique métier.

## 1) Flux global recommandé (tous providers)

1. **Init paiement** (server-side) : création d’une transaction locale en `PENDING`, appel API provider.
2. **Redirection / autorisation client** : lien/flow provider, ou STK push (mobile money).
3. **Callback/Webhook** : provider notifie le résultat.
4. **Vérification côté serveur** : toujours revalider le statut via API provider.
5. **Persistance DB** : mise à jour `SUCCESS/FAILED` et métadonnées.
6. **Notification** : informer `event-planner-core` du statut.

---

## 2) Stripe (Payment Intents + Webhooks)

### Procédure officielle (résumé)
- Créer un **PaymentIntent** côté serveur avec `amount` + `currency`.
- Renvoyer le **client_secret** au client pour confirmation.
- Le client confirme le paiement (`stripe.confirm...` côté front).
- Utiliser **les webhooks** (`payment_intent.succeeded`, `payment_intent.payment_failed`).
- **Vérifier la signature** `Stripe-Signature` avec le secret webhook et le **raw body**.

### Variables d’environnement
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_API_VERSION`
- `STRIPE_DEFAULT_CURRENCY`

### Points d’attention
- La validation webhook échoue si le body est modifié.
- Toujours traiter les statuts finaux via webhook.

---

## 3) PayPal (Orders v2 + Webhooks)

### Procédure officielle (résumé)
- Obtenir un **access token** via `CLIENT_ID` + `CLIENT_SECRET`.
- Créer un **Order** (`intent: CAPTURE`).
- Rediriger le client vers le lien **`rel=approve`**.
- Capturer l’ordre via `/v2/checkout/orders/{id}/capture`.
- Vérifier la **signature webhook** (`PAYPAL-AUTH-ALGO`, `PAYPAL-TRANSMISSION-ID`, etc.).

### Variables d’environnement
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MODE`
- `PAYPAL_API_BASE_URL`
- `PAYPAL_WEBHOOK_ID`

### Points d’attention
- Toujours capturer l’ordre après l’approbation du client.
- Utiliser la vérification de signature PayPal en webhook.

---

## 4) MTN Mobile Money (MoMo API)

### Procédure officielle (résumé)
- Utiliser **Subscription Key** (`Ocp-Apim-Subscription-Key`) pour chaque appel.
- Créer un **API User** + **API Key** (sandbox via provisioning API, prod via portail).
- Initier un **Request to Pay** (asynchrone).
- Recevoir le **callback** et/ou **poller** le statut final.

### Variables d’environnement
- `MTN_MOMO_BASE_URL`
- `MTN_MOMO_SUBSCRIPTION_KEY`
- `MTN_MOMO_USER_ID`
- `MTN_MOMO_API_KEY`
- `MTN_MOMO_INITIATE_PATH`
- `MTN_MOMO_STATUS_PATH`

### Points d’attention
- Le callback peut être **unique**, prévoir un polling de statut.
- Le subscription key est requis sur chaque requête.

---

## 5) Orange Money — Cameroun (OM Web Payment / M Payment)

### Procédure officielle (résumé)
- S’inscrire comme **marchand Orange Money** (Cameroun) et obtenir l’accès à l’API Web Payment / M Payment. citeturn2view2
- Intégrer les APIs après souscription, conformément aux règles de conformité et de sécurité Orange Money. citeturn2view2
- Flux type : init paiement → validation OTP côté client → notification/confirmation → vérification statut via API. citeturn2view2

### Variables d’environnement (mapping)
- `ORANGE_MONEY_BASE_URL`
- `ORANGE_MONEY_API_KEY`
- `ORANGE_MONEY_TOKEN`
- `ORANGE_MONEY_INITIATE_PATH`
- `ORANGE_MONEY_STATUS_PATH`

### Référence officielle
- Portail Orange Money Web Payment / M Payment (Cameroun) : https://developer.orange.com/apis/om-webpay citeturn2view2

---

## 6) CinetPay

### Procédure officielle (résumé)
- Initier un paiement via `POST https://api-checkout.cinetpay.com/v2/payment`.
- Fournir `apikey`, `site_id`, `transaction_id`, `amount`.
- Configurer un **notify_url** : CinetPay appelle votre URL.
- **Toujours vérifier** le statut via `https://api-checkout.cinetpay.com/v2/payment/check`.
- Vérifier le header `x-token` (HMAC) sur le webhook.

### Variables d’environnement
- `CINETPAY_BASE_URL`
- `CINETPAY_INITIATE_PATH`
- `CINETPAY_STATUS_PATH`
- `CINETPAY_API_KEY`
- `CINETPAY_SITE_ID`

---

## 7) PayDunya

### Procédure officielle (résumé)
- Utiliser l’API **PAR** (Payment With Redistribution) pour créer une facture.
- Rediriger le client vers la page PayDunya.
- Configurer **IPN callback URL** (`callback_url`) pour recevoir le statut.
- Vérifier la réponse (response_code / response_text) et le hash.

### Variables d’environnement
- `PAYDUNYA_BASE_URL`
- `PAYDUNYA_INITIATE_PATH`
- `PAYDUNYA_STATUS_PATH`
- `PAYDUNYA_MASTER_KEY`
- `PAYDUNYA_PRIVATE_KEY`
- `PAYDUNYA_PUBLIC_KEY`
- `PAYDUNYA_TOKEN`

---

## 8) PayGate (paygate.to)

⚠️ Le site **paygate.to** ne fournit pas une doc publique complète sur la page d’accueil, mais affiche des liens “API Docs” pour passerelles cartes/crypto. citeturn2view0  
Merci de fournir le lien exact de la doc API PayGate utilisée pour documenter précisément les endpoints.

### Variables d’environnement
- `PAYGATE_BASE_URL`
- `PAYGATE_API_KEY`
- `PAYGATE_TOKEN`

---

## 9) MyCoolPay

Le portail My‑CoolPay référence une **API Documentation** publiée sur Postman (documenter.getpostman.com). citeturn2view1  
Merci de confirmer le lien exact du workspace Postman pour documenter les endpoints et signatures.

### Variables d’environnement
- `MYCOOLPAY_BASE_URL`
- `MYCOOLPAY_API_KEY`
- `MYCOOLPAY_TOKEN`

---

## 10) Checklist d’intégration

- [ ] Toutes les variables d’environnement sont renseignées.
- [ ] Tous les endpoints de webhook sont exposés et testés.
- [ ] Signature webhook vérifiée (Stripe, PayPal, CinetPay…)
- [ ] Persistance DB confirmée après callback.
- [ ] Notification vers `event-planner-core` confirmée.

---

## 11) Références officielles (URLs)

- Stripe Payment Intents + Webhooks: https://docs.stripe.com/payments/payment-intents
- Stripe Webhooks: https://docs.stripe.com/webhooks
- PayPal Orders API: https://developer.paypal.com/docs/api/orders/sdk/v2/
- PayPal Webhooks Signature: https://developer.paypal.com/docs/api/webhooks/v1/
- MTN MoMo API User & Key: https://momoapi.mtn.com/content/html_widgets/5uook.html
- MTN MoMo Getting Started (Sandbox): https://momodeveloper.mtn.com/content/html_widgets/vrv69.html
- CinetPay Init Payment: https://docs.cinetpay.com/api/1.0-en/checkout/initialisation
- CinetPay Notification URL: https://docs.cinetpay.com/api/1.0-en/checkout/notification
- CinetPay HMAC Verification: https://docs.cinetpay.com/api/1.0-en/checkout/hmac
- PayDunya HTTP/JSON: https://developers.paydunya.com/doc/EN/http_json
- PayDunya IPN Callback (ex): https://developers.paydunya.com/doc/EN/Python
- Orange Money Web Payment / M Payment (Cameroun): https://developer.orange.com/apis/om-webpay citeturn2view2
- PayGate (site): https://paygate.to/ citeturn2view0
- MyCoolPay (site + lien doc Postman): https://my-coolpay.com/en/ citeturn2view1
