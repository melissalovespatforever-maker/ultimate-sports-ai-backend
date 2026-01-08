-- ============================================
-- Payment System Integration Migration
-- Version: 2.5.1
-- Date: February 2025
-- ============================================

-- This migration adds PayPal payment processing support
-- and VIP subscription management to the database

BEGIN;

-- ============================================
-- 1. Enhance Transactions Table
-- ============================================

-- Add PayPal-specific columns if they don't exist
DO $$ 
BEGIN
    -- Add paypal_transaction_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'paypal_transaction_id'
    ) THEN
        ALTER TABLE transactions 
        ADD COLUMN paypal_transaction_id VARCHAR(255) UNIQUE;
        
        -- Create index for faster lookups
        CREATE INDEX idx_transactions_paypal_id 
        ON transactions(paypal_transaction_id);
        
        RAISE NOTICE 'Added paypal_transaction_id column';
    END IF;

    -- Add subscription_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE transactions 
        ADD COLUMN subscription_id VARCHAR(255);
        
        RAISE NOTICE 'Added subscription_id column';
    END IF;

    -- Add method column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'method'
    ) THEN
        ALTER TABLE transactions 
        ADD COLUMN method VARCHAR(50);
        
        RAISE NOTICE 'Added method column';
    END IF;

    -- Add reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE transactions 
        ADD COLUMN reason TEXT;
        
        RAISE NOTICE 'Added reason column';
    END IF;

    -- Add metadata column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE transactions 
        ADD COLUMN metadata JSONB;
        
        RAISE NOTICE 'Added metadata column';
    END IF;
END $$;

-- ============================================
-- 2. Create Subscriptions Table
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tier VARCHAR(50) NOT NULL,
    tier_id VARCHAR(50) NOT NULL,
    monthly_coins INTEGER NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL, -- 'monthly' or 'annual'
    price DECIMAL(10, 2),
    subscription_id VARCHAR(255) UNIQUE NOT NULL,
    paypal_subscription_id VARCHAR(255),
    active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT NOW(),
    next_billing_date TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active 
ON subscriptions(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id 
ON subscriptions(subscription_id);

-- ============================================
-- 3. Update Users Table for Balance
-- ============================================

DO $$ 
BEGIN
    -- Add balance column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'balance'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN balance INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added balance column to users';
    END IF;

    -- Add vip_tier column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'vip_tier'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN vip_tier VARCHAR(20) DEFAULT 'free';
        
        RAISE NOTICE 'Added vip_tier column to users';
    END IF;
END $$;

-- ============================================
-- 4. Create Function for Monthly Coin Credits
-- ============================================

-- This function credits monthly coins to active subscribers
-- Run daily via cron job or scheduled task
CREATE OR REPLACE FUNCTION credit_monthly_subscription_coins()
RETURNS TABLE(
    user_id INTEGER,
    coins_credited INTEGER,
    tier VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH credited_subscriptions AS (
        UPDATE subscriptions
        SET next_billing_date = next_billing_date + INTERVAL '1 month',
            updated_at = NOW()
        WHERE active = true 
        AND next_billing_date <= NOW()
        RETURNING 
            subscriptions.user_id, 
            monthly_coins, 
            tier
    ),
    balance_updates AS (
        UPDATE users
        SET balance = users.balance + cs.monthly_coins,
            updated_at = NOW()
        FROM credited_subscriptions cs
        WHERE users.id = cs.user_id
        RETURNING users.id, cs.monthly_coins, cs.tier
    ),
    transaction_logs AS (
        INSERT INTO transactions (
            user_id,
            type,
            amount,
            reason,
            method,
            status,
            created_at
        )
        SELECT 
            bu.id,
            'credit',
            bu.monthly_coins,
            'Monthly VIP Subscription Coins: ' || bu.tier,
            'subscription',
            'completed',
            NOW()
        FROM balance_updates bu
        RETURNING user_id
    )
    SELECT 
        bu.id AS user_id,
        bu.monthly_coins AS coins_credited,
        bu.tier
    FROM balance_updates bu;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Create Admin View for Payment Analytics
-- ============================================

CREATE OR REPLACE VIEW payment_analytics AS
SELECT 
    DATE_TRUNC('day', t.created_at) AS date,
    COUNT(*) AS total_transactions,
    COUNT(DISTINCT t.user_id) AS unique_buyers,
    SUM(t.amount) AS total_coins_sold,
    COUNT(*) FILTER (WHERE t.method = 'paypal') AS paypal_purchases,
    COUNT(*) FILTER (WHERE t.method = 'subscription') AS subscription_credits,
    AVG(t.amount) AS avg_transaction_size
FROM transactions t
WHERE t.status = 'completed'
AND t.method IN ('paypal', 'subscription')
GROUP BY DATE_TRUNC('day', t.created_at)
ORDER BY date DESC;

-- ============================================
-- 6. Create Subscription Status View
-- ============================================

CREATE OR REPLACE VIEW subscription_status AS
SELECT 
    u.id AS user_id,
    u.username,
    u.email,
    s.tier,
    s.billing_cycle,
    s.monthly_coins,
    s.price,
    s.active,
    s.start_date,
    s.next_billing_date,
    s.cancelled_at,
    u.balance AS current_balance,
    COUNT(t.id) AS total_coin_credits,
    SUM(t.amount) AS total_coins_received
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id AND s.active = true
LEFT JOIN transactions t ON t.user_id = u.id AND t.method = 'subscription'
GROUP BY 
    u.id, u.username, u.email, 
    s.tier, s.billing_cycle, s.monthly_coins, s.price,
    s.active, s.start_date, s.next_billing_date, s.cancelled_at;

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- Check that all columns were added
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('transactions', 'subscriptions', 'users')
AND column_name IN (
    'paypal_transaction_id', 
    'subscription_id', 
    'method', 
    'reason', 
    'metadata',
    'balance',
    'vip_tier',
    'tier',
    'billing_cycle'
)
ORDER BY table_name, column_name;

-- Show table counts
SELECT 
    'transactions' AS table_name, 
    COUNT(*) AS row_count 
FROM transactions
UNION ALL
SELECT 
    'subscriptions', 
    COUNT(*) 
FROM subscriptions
UNION ALL
SELECT 
    'users with balance', 
    COUNT(*) 
FROM users 
WHERE balance > 0;

-- ============================================
-- Success Message
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Payment System Integration Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables updated:';
    RAISE NOTICE '  - transactions (enhanced with PayPal columns)';
    RAISE NOTICE '  - subscriptions (created)';
    RAISE NOTICE '  - users (balance and vip_tier columns added)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - credit_monthly_subscription_coins()';
    RAISE NOTICE '';
    RAISE NOTICE 'Views created:';
    RAISE NOTICE '  - payment_analytics';
    RAISE NOTICE '  - subscription_status';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Restart your backend server to load /api/payments routes';
END $$;
