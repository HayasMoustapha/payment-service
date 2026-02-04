INSERT INTO payment_gateways (name, code, is_active, config)
VALUES
  ('Stripe', 'stripe', true, '{}'::jsonb),
  ('PayPal', 'paypal', true, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;
