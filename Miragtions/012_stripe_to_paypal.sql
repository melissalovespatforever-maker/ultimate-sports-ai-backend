-- ============================================
-- MIGRATION: Stripe to PayPal
-- Convert Stripe columns to PayPal columns
-- ============================================

-- Rename stripe columns to paypal in users table
DO $$ 
BEGIN
    -- Check if stripe_customer_id exists and rename to paypal_customer_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE users RENAME COLUMN stripe_customer_id TO paypal_customer_id;
    END IF;

    -- Check if stripe_subscription_id exists and rename to paypal_subscription_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE users RENAME COLUMN stripe_subscription_id TO paypal_subscription_id;
    END IF;
END $$;

-- Update payments table if it has stripe references
DO $$ 
BEGIN
    -- Add paypal_subscription_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'paypal_subscription_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN paypal_subscription_id VARCHAR(100);
    END IF;

    -- Add paypal_transaction_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'paypal_transaction_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN paypal_transaction_id VARCHAR(100);
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_paypal_subscription ON users(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_transaction ON payments(paypal_transaction_id);

-- Log migration
INSERT INTO audit_logs (user_id, action, details, created_at)
VALUES (NULL, 'migration_012_stripe_to_paypal', '{"description": "Migrated Stripe columns to PayPal"}', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

COMMIT;
