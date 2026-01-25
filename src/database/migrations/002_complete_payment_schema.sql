-- ============================================
-- PAYMENT SERVICE - Complete Schema v2.0
-- ============================================

-- Extension pour les UUID et cryptage
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLES PRINCIPALES
-- ============================================

-- Transactions principales (append-only)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(50) UNIQUE NOT NULL, -- Référence unique externe
    user_id UUID NOT NULL,
    event_id UUID,
    amount DECIMAL(12,2) NOT NULL, -- Augmenté pour gros montants
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, processing, success, failed, refunded
    type VARCHAR(20) NOT NULL, -- payment, refund, payout
    subtype VARCHAR(50), -- ticket_purchase, template_purchase, designer_payout, etc.
    payment_method VARCHAR(50) NOT NULL, -- stripe_card, paypal, mobile_money, etc.
    provider VARCHAR(50) NOT NULL, -- stripe, paypal, cinetpay, etc.
    provider_transaction_id VARCHAR(255),
    provider_response JSONB,
    metadata JSONB,
    idempotency_key VARCHAR(255) UNIQUE,
    webhook_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Wallets virtuels
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL,
    owner_type VARCHAR(20) NOT NULL, -- user, designer, organizer, platform
    balance DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL, -- active, frozen, closed
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Mouvements wallet (append-only)
CREATE TABLE IF NOT EXISTS wallet_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    transaction_id UUID REFERENCES transactions(id),
    type VARCHAR(20) NOT NULL, -- credit, debit, hold, release
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    reason VARCHAR(100),
    reference VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commissions plateforme
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    commission_rate DECIMAL(5,4) NOT NULL, -- 0.0250 = 2.5%
    commission_amount DECIMAL(12,2) NOT NULL,
    commission_type VARCHAR(50) NOT NULL, -- platform_fee, marketplace_fee, processing_fee
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, collected, refunded
    wallet_id UUID REFERENCES wallets(id), -- Platform wallet
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payouts (reversements)
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, processing, success, failed
    payout_method VARCHAR(50) NOT NULL, -- bank_transfer, mobile_money
    provider VARCHAR(50) NOT NULL,
    recipient_info JSONB NOT NULL, -- Informations cryptées du bénéficiaire
    provider_payout_id VARCHAR(255),
    provider_response JSONB,
    fees DECIMAL(12,2) DEFAULT 0.00,
    processing_date DATE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLES PROVIDER SPÉCIFIQUES
-- ============================================

-- Paiements Stripe
CREATE TABLE IF NOT EXISTS stripe_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    payment_intent_id VARCHAR(255) NOT NULL,
    charge_id VARCHAR(255),
    customer_id VARCHAR(255),
    payment_method_id VARCHAR(255),
    card_last_four VARCHAR(4),
    card_brand VARCHAR(50),
    card_fingerprint VARCHAR(255),
    3ds_secure BOOLEAN DEFAULT false,
    stripe_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Paiements PayPal
CREATE TABLE IF NOT EXISTS paypal_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    order_id VARCHAR(255) NOT NULL,
    payment_id VARCHAR(255),
    payer_id VARCHAR(255),
    payer_email VARCHAR(255),
    payment_method VARCHAR(50), -- paypal, card, etc.
    paypal_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Paiements Mobile Money (Africains)
CREATE TABLE IF NOT EXISTS mobile_money_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    provider VARCHAR(50) NOT NULL, -- mtn, orange, cinetpay, etc.
    phone_number VARCHAR(20) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    operator VARCHAR(50) NOT NULL,
    transaction_ref VARCHAR(255),
    otp_required BOOLEAN DEFAULT false,
    otp_verified BOOLEAN DEFAULT false,
    provider_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLES SUPPORT
-- ============================================

-- Remboursements
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    refund_id UUID UNIQUE NOT NULL, -- Référence unique de remboursement
    amount DECIMAL(12,2) NOT NULL,
    reason VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    provider_refund_id VARCHAR(255),
    provider_response JSONB,
    processed_by UUID, -- User who processed refund
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Webhooks entrants
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    processed BOOLEAN DEFAULT false,
    processing_attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES POUR PERFORMANCE
-- ============================================

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions(provider);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON transactions(idempotency_key);

-- Wallets
CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);

-- Wallet movements
CREATE INDEX IF NOT EXISTS idx_wallet_movements_wallet_id ON wallet_movements(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_movements_created_at ON wallet_movements(created_at);

-- Commissions
CREATE INDEX IF NOT EXISTS idx_commissions_transaction_id ON commissions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- Payouts
CREATE INDEX IF NOT EXISTS idx_payouts_wallet_id ON payouts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_processing_date ON payouts(processing_date);

-- Provider tables
CREATE INDEX IF NOT EXISTS idx_stripe_payments_payment_intent ON stripe_payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_order_id ON paypal_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_mobile_money_phone ON mobile_money_payments(phone_number);

-- Support tables
CREATE INDEX IF NOT EXISTS idx_refunds_transaction_id ON refunds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_provider ON webhooks(provider);
CREATE INDEX IF NOT EXISTS idx_webhooks_processed ON webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- ============================================
-- TRIGGERS ET FONCTIONS
-- ============================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger aux tables pertinentes
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour audit trail
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, created_at)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), NOW());
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NOW());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Appliquer audit trigger (optionnel, à activer selon besoins)
-- CREATE TRIGGER audit_transactions_trigger AFTER INSERT OR UPDATE OR DELETE ON transactions
--     FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================
-- CONTRAINTES CHECK
-- ============================================

-- Validation des montants positifs
ALTER TABLE transactions ADD CONSTRAINT chk_amount_positive CHECK (amount > 0);
ALTER TABLE wallet_movements ADD CONSTRAINT chk_movement_amount CHECK (amount > 0);
ALTER TABLE commissions ADD CONSTRAINT chk_commission_amount CHECK (commission_amount >= 0);
ALTER TABLE payouts ADD CONSTRAINT chk_payout_amount CHECK (amount > 0);
ALTER TABLE refunds ADD CONSTRAINT chk_refund_amount CHECK (amount > 0);

-- Validation des status
ALTER TABLE transactions ADD CONSTRAINT chk_transaction_status 
    CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'));
ALTER TABLE wallets ADD CONSTRAINT chk_wallet_status 
    CHECK (status IN ('active', 'frozen', 'closed'));
ALTER TABLE commissions ADD CONSTRAINT chk_commission_status 
    CHECK (status IN ('pending', 'collected', 'refunded'));
ALTER TABLE payouts ADD CONSTRAINT chk_payout_status 
    CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled'));

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue résumé wallets
CREATE OR REPLACE VIEW wallet_summary AS
SELECT 
    w.id,
    w.owner_id,
    w.owner_type,
    w.balance,
    w.currency,
    w.status,
    COUNT(wm.id) as movement_count,
    MAX(wm.created_at) as last_movement
FROM wallets w
LEFT JOIN wallet_movements wm ON w.id = wm.wallet_id
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.owner_id, w.owner_type, w.balance, w.currency, w.status;

-- Vue transactions par utilisateur
CREATE OR REPLACE VIEW user_transactions AS
SELECT 
    t.*,
    CASE 
        WHEN t.type = 'payment' THEN 'Débit'
        WHEN t.type = 'refund' THEN 'Crédit'
        ELSE t.type
    END as flow_direction
FROM transactions t
WHERE t.deleted_at IS NULL;

-- Inscrire cette migration
INSERT INTO migration_history (filename) VALUES ('002_complete_payment_schema.sql')
ON CONFLICT (filename) DO NOTHING;
