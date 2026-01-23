-- Payment Service Database Schema
-- Based on payment-diagram.md

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS event_planner_payments;
\c event_planner_payments;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create payment-related enums
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer', 'crypto');
CREATE TYPE commission_type AS ENUM ('template_sale', 'ticket_sale', 'service_fee');
CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'processed');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_id UUID,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    payment_method payment_method NOT NULL,
    transaction_id VARCHAR(255),
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Payment gateways table
CREATE TABLE payment_gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    supported_methods VARCHAR(255)[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Commissions table
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    rate DECIMAL(5,4) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type commission_type NOT NULL,
    description TEXT,
    recipient_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refunds table
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status refund_status DEFAULT 'pending',
    refund_transaction_id VARCHAR(255),
    gateway_refund_id VARCHAR(255),
    gateway_response JSONB,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Withdrawals table
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status withdrawal_status DEFAULT 'pending',
    method VARCHAR(50) NOT NULL,
    destination_details JSONB,
    processing_fee DECIMAL(10,2) DEFAULT 0.00,
    requested_by UUID NOT NULL,
    processed_by UUID,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type payment_method NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_method_id VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_four VARCHAR(4),
    expiry_month INTEGER,
    expiry_year INTEGER,
    brand VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment attempts table (for failed/retry tracking)
CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    gateway VARCHAR(50) NOT NULL,
    status payment_status NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    gateway_response JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'draft',
    customer_info JSONB,
    items JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    pdf_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook events table
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_event_id ON payments(event_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_gateway_transaction_id ON payments(gateway_transaction_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_processed_at ON payments(processed_at);

CREATE INDEX idx_payment_gateways_code ON payment_gateways(code);
CREATE INDEX idx_payment_gateways_active ON payment_gateways(is_active);

CREATE INDEX idx_commissions_payment_id ON commissions(payment_id);
CREATE INDEX idx_commissions_type ON commissions(type);
CREATE INDEX idx_commissions_recipient_id ON commissions(recipient_id);

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_active ON wallets(is_active);

CREATE INDEX idx_withdrawals_wallet_id ON withdrawals(wallet_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_requested_at ON withdrawals(requested_at);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_type ON payment_methods(type);
CREATE INDEX idx_payment_methods_provider ON payment_methods(provider);
CREATE INDEX idx_payment_methods_default ON payment_methods(is_default);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);

CREATE INDEX idx_payment_attempts_payment_id ON payment_attempts(payment_id);
CREATE INDEX idx_payment_attempts_gateway ON payment_attempts(gateway);
CREATE INDEX idx_payment_attempts_status ON payment_attempts(status);

CREATE INDEX idx_invoices_payment_id ON invoices(payment_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);

CREATE INDEX idx_webhook_events_gateway ON webhook_events(gateway);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_gateways_updated_at BEFORE UPDATE ON payment_gateways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default payment gateways
INSERT INTO payment_gateways (name, code, config, supported_methods) VALUES
('Stripe', 'stripe', '{"publishable_key": "", "secret_key": "", "webhook_secret": ""}', ARRAY['credit_card', 'debit_card']),
('PayPal', 'paypal', '{"client_id": "", "client_secret": "", "mode": "sandbox"}', ARRAY['paypal']),
('Bank Transfer', 'bank_transfer', '{"account_details": {}}', ARRAY['bank_transfer']);

-- Create view for payment statistics
CREATE VIEW payment_stats AS
SELECT 
    status,
    payment_method,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    DATE_TRUNC('day', created_at) as date
FROM payments 
GROUP BY status, payment_method, DATE_TRUNC('day', created_at)
ORDER BY date DESC, payment_method, status;

-- Create view for refund statistics
CREATE VIEW refund_stats AS
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    DATE_TRUNC('day', created_at) as date
FROM refunds 
GROUP BY status, DATE_TRUNC('day', created_at)
ORDER BY date DESC, status;

-- Create view for wallet balances
CREATE VIEW wallet_balances AS
SELECT 
    w.user_id,
    w.currency,
    w.balance,
    w.is_active,
    COALESCE(SUM(CASE WHEN wd.status = 'pending' THEN wd.amount ELSE 0 END), 0) as pending_withdrawals,
    w.balance - COALESCE(SUM(CASE WHEN wd.status = 'pending' THEN wd.amount ELSE 0 END), 0) as available_balance
FROM wallets w
LEFT JOIN withdrawals wd ON w.id = wd.wallet_id AND wd.status IN ('pending', 'processing')
GROUP BY w.id, w.user_id, w.currency, w.balance, w.is_active;

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    invoice_num TEXT;
    date_part TEXT;
    sequence_num INTEGER;
BEGIN
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || date_part || '-%';
    
    invoice_num := 'INV-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_set_number BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

-- Create function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_wallet_id UUID,
    p_amount DECIMAL,
    p_operation VARCHAR -- 'add' or 'subtract'
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_operation = 'add' THEN
        UPDATE wallets 
        SET balance = balance + p_amount, updated_at = CURRENT_TIMESTAMP
        WHERE id = p_wallet_id;
    ELSIF p_operation = 'subtract' THEN
        UPDATE wallets 
        SET balance = balance - p_amount, updated_at = CURRENT_TIMESTAMP
        WHERE id = p_wallet_id AND balance >= p_amount;
    ELSE
        RETURN FALSE;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
