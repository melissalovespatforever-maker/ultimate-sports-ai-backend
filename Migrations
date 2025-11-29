-- ============================================
-- MIGRATION: Add Age Verification Fields
-- Version: 004
-- ============================================

-- Add age verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verification_method VARCHAR(50);

-- Add account deactivation columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP;

-- Create index for age verification queries
CREATE INDEX IF NOT EXISTS idx_users_age_verified ON users(age_verified);
CREATE INDEX IF NOT EXISTS idx_users_age_verified_date ON users(age_verified_date);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create audit log table for age verification
CREATE TABLE IF NOT EXISTS age_verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_method VARCHAR(50) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_age_verification_audit_user_id ON age_verification_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_age_verification_audit_verified_at ON age_verification_audit(verified_at);

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Age Verification Migration Applied Successfully';
    RAISE NOTICE '📊 Added columns: age_verified, age_verified_date, age_verification_method';
    RAISE NOTICE '📊 Added columns: is_active, deactivation_reason, deactivated_at';
    RAISE NOTICE '📋 Created table: age_verification_audit';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Age verification system is ready for deployment';
END $$;
