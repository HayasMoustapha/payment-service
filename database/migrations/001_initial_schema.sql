-- ========================================
-- MIGRATION 001: SCHÉMA INITIAL PAYMENT SERVICE
-- ========================================
-- Création des tables essentielles pour le service de paiement
-- Basé sur les standards PCI DSS et bonnes pratiques
-- Version IDEMPOTENTE - Généré le 2026-01-26

-- Extension UUID pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types énumérés pour les paiements
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
    CREATE TYPE payment_method AS ENUM ('credit_card', 'paypal', 'stripe', 'bank_transfer', 'crypto');
    CREATE TYPE refund_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    CREATE TYPE webhook_status AS ENUM ('pending', 'processed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- Table des paiements (IDEMPOTENT)
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE, -- ID externe (Stripe, PayPal, etc.)
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    status payment_status DEFAULT 'pending',
    method payment_method NOT NULL,
    description TEXT,
    metadata JSONB,
    -- Références externes (gérées avec NULL par défaut)
    user_id BIGINT,
    event_id BIGINT,
    ticket_id BIGINT,
    invoice_id VARCHAR(255),
    -- Champs d'audit complets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- ========================================
-- Table des remboursements (IDEMPOTENT)
-- ========================================
CREATE TABLE IF NOT EXISTS refunds (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    external_refund_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status refund_status DEFAULT 'pending',
    metadata JSONB,
    -- Champs d'audit complets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- ========================================
-- Table des webhooks (IDEMPOTENT)
-- ========================================
CREATE TABLE IF NOT EXISTS webhooks (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL, -- stripe, paypal, etc.
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status webhook_status DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    -- Champs d'audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Table des factures (IDEMPOTENT)
-- ========================================
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(255) UNIQUE NOT NULL,
    payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    user_id BIGINT,
    total_amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',
    status VARCHAR(20) DEFAULT 'draft',
    pdf_path VARCHAR(500),
    -- Champs d'audit complets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    issued_at TIMESTAMP WITH TIME ZONE,
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- ========================================
-- Table des méthodes de paiement sauvegardées (IDEMPOTENT)
-- ========================================
CREATE TABLE IF NOT EXISTS saved_payment_methods (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    method_type payment_method NOT NULL,
    provider VARCHAR(100) NOT NULL, -- stripe, paypal, etc.
    external_token VARCHAR(255) NOT NULL, -- Token sécurisé du provider
    last_four VARCHAR(4), -- 4 derniers chiffres pour carte
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    metadata JSONB,
    -- Champs d'audit complets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- ========================================
-- Index pour optimiser les performances (IDEMPOTENT)
-- ========================================
-- Index pour payments
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_ticket_id ON payments(ticket_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at) WHERE deleted_at IS NULL;

-- Index pour refunds
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at) WHERE deleted_at IS NULL;

-- Index pour webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_source ON webhooks(source);
CREATE INDEX IF NOT EXISTS idx_webhooks_event_type ON webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);

-- Index pour invoices
CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoices(invoice_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices(payment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at) WHERE deleted_at IS NULL;

-- Index pour saved_payment_methods
CREATE INDEX IF NOT EXISTS idx_saved_methods_user_id ON saved_payment_methods(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_methods_type ON saved_payment_methods(method_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_methods_provider ON saved_payment_methods(provider) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_methods_default ON saved_payment_methods(is_default) WHERE deleted_at IS NULL;

-- ========================================
-- Commentaires pour documentation
-- ========================================
COMMENT ON TABLE payments IS 'Paiements principaux avec références externes';
COMMENT ON TABLE refunds IS 'Remboursements liés aux paiements';
COMMENT ON TABLE webhooks IS 'Webhooks reçus des providers de paiement';
COMMENT ON TABLE invoices IS 'Factures générées pour les paiements';
COMMENT ON TABLE saved_payment_methods IS 'Méthodes de paiement sauvegardées des utilisateurs';
