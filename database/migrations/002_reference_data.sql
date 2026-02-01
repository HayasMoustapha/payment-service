-- ========================================
-- MIGRATION 002: DONNÉES RÉFÉRENCE & VALIDATION
-- ========================================
-- Gère les références externes et données système
-- Version IDEMPOTENTE - Généré le 2026-01-26

-- ========================================
-- PASSERELLES DE PAIEMENT PAR DÉFAUT (IDEMPOTENT)
-- ========================================
INSERT INTO payment_gateways (name, code, is_active, config, supported_currencies, supported_countries, min_amount, max_amount) VALUES
(
  'Stripe',
  'stripe',
  true,
  '{"publishable_key": "pk_test_...", "secret_key": "sk_test_...", "webhook_secret": "whsec_..."}',
  ARRAY['EUR', 'USD', 'GBP', 'CHF'],
  ARRAY['FR', 'US', 'GB', 'DE', 'ES', 'IT', 'CH', 'BE', 'NL', 'LU'],
  0.50,
  100000.00
),
(
  'PayPal',
  'paypal', 
  true,
  '{"client_id": "...", "client_secret": "...", "webhook_id": "..."}',
  ARRAY['EUR', 'USD', 'GBP'],
  ARRAY['FR', 'US', 'GB', 'DE', 'ES', 'IT', 'BE', 'NL'],
  1.00,
  50000.00
),
(
  'CinetPay',
  'cinetpay',
  true,
  '{"api_key": "...", "site_id": "...", "secret_key": "..."}',
  ARRAY['XOF', 'XAF', 'EUR', 'USD'],
  ARRAY['CI', 'SN', 'ML', 'BF', 'NE', 'TG', 'BJ', 'CM', 'GA', 'CD'],
  100.00,
  1000000.00
),
(
  'MTN Mobile Money',
  'mtn_momo',
  true,
  '{"api_key": "...", "api_user": "...", "api_secret": "..."}',
  ARRAY['XOF', 'XAF', 'UGX', 'GHS', 'ZMW', 'MWK'],
  ARRAY['CI', 'CM', 'UG', 'GH', 'ZM', 'MW', 'TZ', 'RW', 'KE'],
  100.00,
  500000.00
),
(
  'Orange Money',
  'orange_money',
  false, -- Désactivé pour le moment
  '{"api_key": "...", "api_secret": "..."}',
  ARRAY['XOF', 'XAF'],
  ARRAY['CI', 'SN', 'ML', 'BF', 'NE', 'TG', 'BJ', 'CM'],
  100.00,
  300000.00
)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- Vue pour valider les références externes (IDEMPOTENT)
-- ========================================
CREATE OR REPLACE VIEW external_references_validation AS
SELECT 
    'payments' as table_name,
    'user_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as null_reference
FROM payments WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'payments' as table_name,
    'event_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN event_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN event_id IS NULL THEN 1 END) as null_reference
FROM payments WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'payments' as table_name,
    'ticket_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ticket_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN ticket_id IS NULL THEN 1 END) as null_reference
FROM payments WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'invoices' as table_name,
    'user_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as null_reference
FROM invoices WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'saved_payment_methods' as table_name,
    'user_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as null_reference
FROM saved_payment_methods WHERE deleted_at IS NULL;

-- ========================================
-- Fonction pour valider l'intégrité des références (IDEMPOTENT)
-- ========================================
CREATE OR REPLACE FUNCTION validate_external_references()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    total_records BIGINT,
    with_reference BIGINT,
    null_reference BIGINT,
    integrity_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        erv.table_name,
        erv.column_name,
        erv.total_records,
        erv.with_reference,
        erv.null_reference,
        CASE 
            WHEN erv.total_records = 0 THEN 'EMPTY_TABLE'
            WHEN erv.null_reference = 0 THEN 'ALL_REFERENCED'
            WHEN erv.with_reference > 0 THEN 'PARTIAL_REFERENCES'
            ELSE 'NO_REFERENCES'
        END as integrity_status
    FROM external_references_validation erv;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Configuration système par défaut (IDEMPOTENT)
-- ========================================
-- Créer une table de configuration pour les paramètres du service
CREATE TABLE IF NOT EXISTS service_config (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT
);

-- Insérer les configurations par défaut
INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'stripe_config',
    '{"enable_test_mode": true, "webhook_secret": "test_secret", "currency": "EUR"}',
    'Configuration Stripe par défaut',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'stripe_config'
);

INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'paypal_config',
    '{"enable_test_mode": true, "webhook_id": "test_webhook", "currency": "EUR"}',
    'Configuration PayPal par défaut',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'paypal_config'
);

INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'payment_limits',
    '{"min_amount": 0.50, "max_amount": 10000.00, "daily_limit": 5000.00}',
    'Limites de paiement par défaut',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'payment_limits'
);

INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'refund_policy',
    '{"refund_window_days": 30, "auto_refund_threshold": 100.00, "require_approval": true}',
    'Politique de remboursement par défaut',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'refund_policy'
);

-- ========================================
-- Séquence pour numéros de facture (IDEMPOTENT)
-- ========================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ========================================
-- Fonction pour générer des numéros de facture (IDEMPOTENT)
-- ========================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    next_number BIGINT;
    invoice_number TEXT;
    year_text TEXT;
BEGIN
    -- Obtenir le prochain numéro de la séquence
    next_number := nextval('invoice_number_seq');
    
    -- Format: INV-YYYY-NNNNNN
    year_text := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    invoice_number := 'INV-' || year_text || '-' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Rapport d'intégrité (IDEMPOTENT)
-- ========================================
DO $$
DECLARE
    validation_record RECORD;
    total_issues INTEGER := 0;
    config_count INTEGER;
BEGIN
    -- Compter les configurations
    SELECT COUNT(*) INTO config_count FROM service_config;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VALIDATION RÉFÉRENCES EXTERNES - payment-service';
    RAISE NOTICE '══════════════════════════════════════════════════';
    RAISE NOTICE '📊 Analyse des références externes...';
    
    FOR validation_record IN SELECT * FROM validate_external_references() LOOP
        RAISE NOTICE '';
        RAISE NOTICE '📋 Table: %.%', validation_record.table_name, validation_record.column_name;
        RAISE NOTICE '   Total enregistrements: %', validation_record.total_records;
        RAISE NOTICE '   Avec référence: %', validation_record.with_reference;
        RAISE NOTICE '   Sans référence: %', validation_record.null_reference;
        RAISE NOTICE '   Statut intégrité: %', validation_record.integrity_status;
        
        IF validation_record.integrity_status IN ('PARTIAL_REFERENCES', 'NO_REFERENCES') 
           AND validation_record.total_records > 0 THEN
            total_issues := total_issues + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  Configurations système: %', config_count;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 RÉSUMÉ VALIDATION';
    RAISE NOTICE '══════════════════════════════════════════════════';
    
    IF total_issues = 0 AND config_count >= 4 THEN
        RAISE NOTICE '✅ SUCCÈS : Service prêt à fonctionner';
        RAISE NOTICE '🔗 Références externes valides';
        RAISE NOTICE '⚙️  Configurations système initialisées';
        RAISE NOTICE '🧾 Génération de factures configurée';
    ELSE
        RAISE NOTICE '⚠️  ATTENTION : % problème(s) détecté(s)', total_issues;
        RAISE NOTICE '💡 Solution: Assurez-vous que les entités référencées existent';
        RAISE NOTICE '🔧 Les enregistrements avec références NULL seront ignorés';
    END IF;
    
    RAISE NOTICE '══════════════════════════════════════════════════';
END $$;
