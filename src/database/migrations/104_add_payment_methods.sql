CREATE TABLE IF NOT EXISTS payment_methods (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider_code VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    external_customer_id VARCHAR(255),
    external_method_id VARCHAR(255),
    token_reference VARCHAR(255),
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    exp_month SMALLINT,
    exp_year SMALLINT,
    cardholder_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_phone VARCHAR(50),
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(50),
    billing_country VARCHAR(2),
    mobile_number VARCHAR(50),
    wallet_reference VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id
    ON payment_methods(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_provider_code
    ON payment_methods(provider_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_one_default_per_user
    ON payment_methods(user_id)
    WHERE is_default = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_external_method
    ON payment_methods(provider_code, external_method_id)
    WHERE external_method_id IS NOT NULL AND deleted_at IS NULL;
