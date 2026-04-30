ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS available_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_balance DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE wallets
   SET available_balance = balance,
       reserved_balance = 0
 WHERE available_balance = 0
   AND reserved_balance = 0
   AND balance <> 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_balance_non_negative'
  ) THEN
    ALTER TABLE wallets
      ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_available_balance_non_negative'
  ) THEN
    ALTER TABLE wallets
      ADD CONSTRAINT wallets_available_balance_non_negative CHECK (available_balance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_reserved_balance_non_negative'
  ) THEN
    ALTER TABLE wallets
      ADD CONSTRAINT wallets_reserved_balance_non_negative CHECK (reserved_balance >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('credit', 'debit', 'reserve', 'release')),
  entry_type VARCHAR(64) NOT NULL,
  reference_type VARCHAR(64),
  reference_id VARCHAR(255),
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  available_before DECIMAL(12,2) NOT NULL,
  available_after DECIMAL(12,2) NOT NULL,
  reserved_before DECIMAL(12,2) NOT NULL,
  reserved_after DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_created_at
  ON wallet_transactions(wallet_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_reference_uniqueness
  ON wallet_transactions(wallet_id, entry_type, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
