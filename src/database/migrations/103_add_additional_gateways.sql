-- ========================================
-- PAYMENT SERVICE - Add missing gateways
-- ========================================
-- Purpose: ensure all providers from spec are seeded even if previous seed already ran

INSERT INTO payment_gateways (name, code, is_active, config)
VALUES
  ('Stripe', 'stripe', true, '{}'::jsonb),
  ('PayPal', 'paypal', true, '{}'::jsonb),
  ('CinetPay', 'cinetpay', true, '{}'::jsonb),
  ('PayDunya', 'paydunya', true, '{}'::jsonb),
  ('PayGate', 'paygate', true, '{}'::jsonb),
  ('MTN Mobile Money', 'mtn_momo', true, '{}'::jsonb),
  ('Orange Money', 'orange_money', true, '{}'::jsonb),
  ('MyCoolPay', 'mycoolpay', true, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;
