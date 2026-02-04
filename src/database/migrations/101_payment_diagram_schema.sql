-- ========================================
-- PAYMENT SERVICE - Initial Schema (Aligned to payment-diagram.md)
-- ========================================
-- Source of truth: shared/event-planner-documents/payment-diagram.md

-- Types (idempotent)
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_type AS ENUM ('template_sale', 'ticket_sale');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- Table: payment_gateways
-- ========================================
CREATE TABLE IF NOT EXISTS payment_gateways (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true NOT NULL,
    config JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- ========================================
-- Table: payments
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    gateway_id BIGINT NOT NULL REFERENCES payment_gateways(id),
    purchase_id BIGINT UNIQUE,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(255),
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Table: commissions
-- ========================================
CREATE TABLE IF NOT EXISTS commissions (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
    rate DECIMAL(6,4) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type commission_type NOT NULL
);

-- ========================================
-- Table: refunds
-- ========================================
CREATE TABLE IF NOT EXISTS refunds (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    status refund_status NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- Table: wallets
-- ========================================
CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,
    designer_id BIGINT NOT NULL UNIQUE,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL
);

-- ========================================
-- Table: withdrawals
-- ========================================
CREATE TABLE IF NOT EXISTS withdrawals (
    id BIGSERIAL PRIMARY KEY,
    wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    status withdrawal_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON payments(gateway_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_purchase_id ON payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payment_id ON commissions(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_wallets_designer_id ON wallets(designer_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet_id ON withdrawals(wallet_id);
