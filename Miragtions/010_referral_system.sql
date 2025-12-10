-- ============================================
-- REFERRAL SYSTEM MIGRATION
-- Complete referral tracking with rewards
-- ============================================

-- Add referral fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_at TIMESTAMP;

-- Create referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_used VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, expired
    coins_earned INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    first_pick_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referee_id) -- Each user can only be referred once
);

-- Create referral events table (for analytics)
CREATE TABLE IF NOT EXISTS referral_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'signup', 'first_pick', 'subscription', etc.
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create coin transactions table if not exists (for referral rewards)
CREATE TABLE IF NOT EXISTS coin_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'referral', 'purchase', 'reward', etc.
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_events_user ON referral_events(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- Create function to update referral updated_at
CREATE OR REPLACE FUNCTION update_referral_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for referrals
DROP TRIGGER IF EXISTS update_referral_timestamp ON referrals;
CREATE TRIGGER update_referral_timestamp
    BEFORE UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_timestamp();

-- Seed some sample milestones (optional)
CREATE TABLE IF NOT EXISTS referral_milestones (
    id SERIAL PRIMARY KEY,
    referral_count INTEGER NOT NULL UNIQUE,
    reward_coins INTEGER NOT NULL,
    reward_description TEXT,
    badge_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO referral_milestones (referral_count, reward_coins, reward_description, badge_name) VALUES
(5, 1000, 'First 5 successful referrals', 'Recruiter'),
(10, 2500, 'Reached 10 referrals', 'Talent Scout'),
(25, 5000, 'Reached 25 referrals', 'Community Builder'),
(50, 10000, 'Reached 50 referrals', 'Influencer'),
(100, 25000, 'Reached 100 referrals', 'Legend')
ON CONFLICT (referral_count) DO NOTHING;

COMMENT ON TABLE referrals IS 'Tracks all referral relationships and rewards';
COMMENT ON TABLE referral_events IS 'Logs all referral-related events for analytics';
COMMENT ON TABLE referral_milestones IS 'Defines milestone rewards for referrers';
