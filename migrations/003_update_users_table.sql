-- ============================================
-- Update Users Table for Payment System
-- Ultimate Sports AI v2.5.1
-- ============================================

-- Add balance column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'balance') THEN
        ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 10000;
        RAISE NOTICE '✅ Added balance column to users table (default: 10000)';
    ELSE
        RAISE NOTICE 'ℹ️  balance column already exists';
    END IF;
END $$;

-- Add subscription_tier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'subscription_tier') THEN
        ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
        RAISE NOTICE '✅ Added subscription_tier column to users table';
    ELSE
        RAISE NOTICE 'ℹ️  subscription_tier column already exists';
    END IF;
END $$;

-- Add last_balance_update column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'last_balance_update') THEN
        ALTER TABLE users ADD COLUMN last_balance_update TIMESTAMP DEFAULT NOW();
        RAISE NOTICE '✅ Added last_balance_update column to users table';
    ELSE
        RAISE NOTICE 'ℹ️  last_balance_update column already exists';
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Add constraints
ALTER TABLE users 
    ALTER COLUMN balance SET NOT NULL,
    ALTER COLUMN balance SET DEFAULT 10000;

ALTER TABLE users
    ALTER COLUMN subscription_tier SET NOT NULL,
    ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- Add check constraint for valid subscription tiers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_subscription_tier'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT valid_subscription_tier 
        CHECK (subscription_tier IN ('free', 'bronze', 'silver', 'gold'));
        RAISE NOTICE '✅ Added subscription tier validation';
    END IF;
END $$;

-- Add check constraint for non-negative balance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'non_negative_balance'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT non_negative_balance 
        CHECK (balance >= 0);
        RAISE NOTICE '✅ Added balance validation (non-negative)';
    END IF;
END $$;

-- Create function to update last_balance_update automatically
CREATE OR REPLACE FUNCTION update_last_balance_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance != OLD.balance THEN
        NEW.last_balance_update = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for balance updates
DROP TRIGGER IF EXISTS trigger_update_last_balance_update ON users;
CREATE TRIGGER trigger_update_last_balance_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
    EXECUTE FUNCTION update_last_balance_update();

-- Add comments to columns
COMMENT ON COLUMN users.balance IS 'User coin balance for betting and purchases';
COMMENT ON COLUMN users.subscription_tier IS 'VIP subscription level: free, bronze, silver, gold';
COMMENT ON COLUMN users.last_balance_update IS 'Timestamp of last balance modification';

-- Success message
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE balance = 10000;
    RAISE NOTICE '✅ Users table updated successfully';
    RAISE NOTICE 'ℹ️  % users have default balance of 10000', user_count;
END $$;
