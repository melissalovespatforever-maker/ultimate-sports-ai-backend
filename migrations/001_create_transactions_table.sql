-- ============================================
-- Create Transactions Table
-- Ultimate Sports AI v2.5.1
-- ============================================

-- Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit', 'win', 'loss', 'purchase')),
    amount INTEGER NOT NULL,
    reason TEXT,
    method VARCHAR(50), -- 'paypal', 'bet', 'purchase', 'reward', etc.
    paypal_transaction_id VARCHAR(255) UNIQUE,
    subscription_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_paypal_transaction_id ON transactions(paypal_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_method ON transactions(method);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE transactions IS 'Stores all user transactions including purchases, bets, wins, and losses';
COMMENT ON COLUMN transactions.paypal_transaction_id IS 'Unique PayPal transaction ID to prevent duplicate charges';
COMMENT ON COLUMN transactions.metadata IS 'Additional transaction data stored as JSON (bundleName, game info, etc.)';

-- Grant permissions (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE ON transactions TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE transactions_id_seq TO your_app_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Transactions table created successfully';
END $$;
