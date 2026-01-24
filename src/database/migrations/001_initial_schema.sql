-- ============================================
-- PAYMENT SERVICE - Initial Schema
-- ============================================

-- Créer la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS event_planner_payments;

-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    provider_transaction_id VARCHAR(255),
    provider_response JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Table des paiements par carte
CREATE TABLE IF NOT EXISTS card_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    card_last_four VARCHAR(4) NOT NULL,
    card_brand VARCHAR(50) NOT NULL,
    card_holder_name VARCHAR(255) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des paiements PayPal
CREATE TABLE IF NOT EXISTS paypal_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    paypal_order_id VARCHAR(255) NOT NULL,
    paypal_payment_id VARCHAR(255),
    paypal_payer_id VARCHAR(255),
    paypal_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des remboursements
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    provider_refund_id VARCHAR(255),
    provider_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_card_payments_transaction_id ON card_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_transaction_id ON paypal_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_transaction_id ON refunds(transaction_id);

-- Table de migration pour suivre les versions
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inscrire cette migration
INSERT INTO migration_history (filename) VALUES ('001_initial_schema.sql')
ON CONFLICT (filename) DO NOTHING;
