-- ============================================
-- Create Subscriptions Table
-- Ultimate Sports AI v2.5.1
-- ============================================

-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL, -- 'Bronze VIP', 'Silver VIP', 'Gold VIP'
    tier_id VARCHAR(50) NOT NULL, -- 'bronze_monthly', 'silver_annual', etc.
    monthly_coins INTEGER NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    price DECIMAL(10,2) NOT NULL,
    subscription_id VARCHAR(255) UNIQUE NOT NULL,
    paypal_subscription_id VARCHAR(255),
    active BOOLEAN DEFAULT true,
    start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    next_billing_date TIMESTAMP NOT NULL,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure only one active subscription per user
    CONSTRAINT unique_active_subscription UNIQUE (user_id, active)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_subscription_id ON subscriptions(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier_id ON subscriptions(tier_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE subscriptions IS 'Stores VIP subscription data with billing information';
COMMENT ON COLUMN subscriptions.subscription_id IS 'Unique subscription identifier';
COMMENT ON COLUMN subscriptions.paypal_subscription_id IS 'PayPal subscription ID for recurring payments';
COMMENT ON COLUMN subscriptions.next_billing_date IS 'Date when next billing cycle occurs';
COMMENT ON COLUMN subscriptions.monthly_coins IS 'Amount of coins credited each billing cycle';

-- Create function to automatically deactivate expired subscriptions
CREATE OR REPLACE FUNCTION deactivate_expired_subscriptions()
RETURNS void AS $$
BEGIN
    UPDATE subscriptions
    SET active = false,
        updated_at = NOW()
    WHERE active = true
    AND next_billing_date < NOW()
    AND cancelled_at IS NULL;
    
    RAISE NOTICE 'Deactivated % expired subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE active = false AND next_billing_date < NOW());
END;
$$ LANGUAGE plpgsql;

-- Create function to credit monthly coins (called by cron job)
CREATE OR REPLACE FUNCTION credit_monthly_subscription_coins()
RETURNS TABLE(user_id INTEGER, coins_credited INTEGER) AS $$
BEGIN
    -- Find subscriptions that need coins credited
    RETURN QUERY
    WITH subscriptions_to_credit AS (
        SELECT s.user_id, s.monthly_coins, s.id as subscription_id
        FROM subscriptions s
        WHERE s.active = true
        AND s.next_billing_date <= NOW()
    )
    INSERT INTO transactions (user_id, type, amount, reason, method, subscription_id)
    SELECT 
        sc.user_id,
        'credit',
        sc.monthly_coins,
        'Monthly VIP Subscription Coins',
        'subscription',
        sc.subscription_id::VARCHAR
    FROM subscriptions_to_credit sc
    RETURNING transactions.user_id, transactions.amount;
    
    -- Update user balances
    UPDATE users u
    SET balance = balance + t.amount,
        updated_at = NOW()
    FROM (
        SELECT user_id, SUM(amount) as amount
        FROM transactions
        WHERE type = 'credit'
        AND method = 'subscription'
        AND created_at > NOW() - INTERVAL '1 minute'
        GROUP BY user_id
    ) t
    WHERE u.id = t.user_id;
    
    -- Update next billing dates
    UPDATE subscriptions
    SET next_billing_date = CASE
        WHEN billing_cycle = 'monthly' THEN next_billing_date + INTERVAL '30 days'
        WHEN billing_cycle = 'annual' THEN next_billing_date + INTERVAL '365 days'
    END,
    updated_at = NOW()
    WHERE active = true
    AND next_billing_date <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE ON subscriptions TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE subscriptions_id_seq TO your_app_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Subscriptions table created successfully';
    RAISE NOTICE 'ℹ️  Run credit_monthly_subscription_coins() daily via cron job';
END $$;
