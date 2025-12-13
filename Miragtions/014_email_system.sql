-- ============================================
-- EMAIL SYSTEM & PASSWORD RESET
-- Transactional emails and reset tokens
-- ============================================

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);

-- Email log table (track all sent emails)
CREATE TABLE IF NOT EXISTS email_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email_address VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL, -- 'password_reset', 'receipt', 'welcome', 'bet_settled', 'digest'
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
    resend_message_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB, -- Additional data for tracking
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_email_type ON email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);

-- User email preferences
CREATE TABLE IF NOT EXISTS email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Email types
    password_reset BOOLEAN DEFAULT TRUE,
    payment_receipts BOOLEAN DEFAULT TRUE,
    bet_notifications BOOLEAN DEFAULT TRUE,
    daily_digest BOOLEAN DEFAULT FALSE,
    weekly_summary BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    
    -- Digest settings
    digest_frequency VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly', 'never'
    digest_time VARCHAR(5) DEFAULT '08:00', -- HH:MM format
    
    last_digest_sent TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_prefs_user_id ON email_preferences(user_id);

-- Insert default preferences for all users
INSERT INTO email_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM email_preferences WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Payment receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    plan VARCHAR(50) NOT NULL, -- 'FREE', 'PRO', 'VIP'
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_period VARCHAR(50) NOT NULL, -- 'monthly', 'annual'
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    next_billing_date DATE,
    
    -- Receipt details
    payment_method VARCHAR(50), -- 'paypal', 'card', etc
    receipt_number VARCHAR(100),
    
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_id ON payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_transaction_id ON payment_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_email_sent ON payment_receipts(email_sent);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_created_at ON payment_receipts(created_at DESC);

-- Bet settled notifications
CREATE TABLE IF NOT EXISTS bet_email_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bet_id INTEGER REFERENCES user_bets(id) ON DELETE SET NULL,
    email_address VARCHAR(255) NOT NULL,
    bet_data JSONB NOT NULL, -- Store bet details
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    resend_message_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bet_email_user_id ON bet_email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_email_bet_id ON bet_email_notifications(bet_id);
CREATE INDEX IF NOT EXISTS idx_bet_email_sent ON bet_email_notifications(email_sent);

-- Email unsubscribe table (for bounce/complaint handling)
CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(50), -- 'bounce', 'complaint', 'user_requested'
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_unsub_address ON email_unsubscribes(email_address);

-- Add email configuration column to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- Create view for email statistics
CREATE OR REPLACE VIEW email_stats AS
SELECT 
    DATE(sent_at) as date,
    email_type,
    COUNT(*) as total_sent,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
    ROUND(100.0 * COUNT(CASE WHEN status = 'sent' THEN 1 END) / COUNT(*), 2) as success_rate
FROM email_log
GROUP BY DATE(sent_at), email_type
ORDER BY DATE(sent_at) DESC, email_type;

GRANT SELECT ON email_stats TO PUBLIC;
