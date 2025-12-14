-- ============================================
-- TWO-FACTOR AUTHENTICATION MIGRATION
-- Adds 2FA support with TOTP
-- ============================================

-- Add 2FA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[]; -- Array of encrypted backup codes

-- Create index for faster 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_two_factor ON users(two_factor_enabled);

-- Create 2FA audit log table
CREATE TABLE IF NOT EXISTS two_factor_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'enabled', 'disabled', 'verified', 'failed', 'backup_used'
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_2fa_logs_user ON two_factor_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_2fa_logs_created ON two_factor_logs(created_at);

-- Add comment
COMMENT ON TABLE two_factor_logs IS 'Audit trail for 2FA actions';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether user has 2FA enabled';
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of hashed backup codes for account recovery';