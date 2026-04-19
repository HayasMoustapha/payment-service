-- Keep only cahier-de-charge payment methods active for customer-facing flows.
-- Mock is preserved for local development and test automation.

UPDATE payment_gateways
SET is_active = false
WHERE code IN ('cinetpay', 'paydunya', 'paygate', 'mtn_momo', 'orange_money', 'mycoolpay');
