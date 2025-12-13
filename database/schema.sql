-- ============================================
-- ULTIMATE SPORTS AI - DATABASE SCHEMA
-- PostgreSQL Schema Definition
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(10) DEFAULT '👤',
    subscription_tier VARCHAR(10) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'vip')),
    
    -- PayPal Integration
    paypal_customer_id VARCHAR(100) UNIQUE,
    paypal_subscription_id VARCHAR(100),
    subscription_status VARCHAR(20) DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'canceling', 'canceled', 'past_due', 'trialing')),
    subscription_starts_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    subscription_trial_ends TIMESTAMP,
    
    -- Referral System
    referral_code VARCHAR(50) UNIQUE,
    referred_by UUID REFERENCES users(id),
    referred_at TIMESTAMP,
    
    -- Stats
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    total_picks INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_rate DECIMAL(5,4) DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    
    -- Streak data
    login_streak INTEGER DEFAULT 0,
    last_login_date DATE,
    longest_login_streak INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_subscription ON users(subscription_tier);

-- ============================================
-- REFRESH TOKENS
-- ============================================

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- COMPETITIONS & MATCHMAKING (Phase 18)
-- ============================================

CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(10) NOT NULL CHECK (type IN ('1v1', '2v2', 'tournament')),
    title VARCHAR(255) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'best_of_5' CHECK (format IN ('best_of_3', 'best_of_5', 'best_of_7')),
    sport VARCHAR(20) NOT NULL DEFAULT 'all',
    wager_amount INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'in_progress', 'completed', 'expired')),
    
    -- Participants
    challenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenger_username VARCHAR(50) NOT NULL,
    challenger_avatar VARCHAR(255),
    challenger_score INTEGER DEFAULT 0,
    
    opponent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    opponent_username VARCHAR(50),
    opponent_avatar VARCHAR(255),
    opponent_score INTEGER DEFAULT 0,
    
    -- Match tracking
    match_count INTEGER DEFAULT 0,
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    matched_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_challenger ON competitions(challenger_id);
CREATE INDEX idx_competitions_opponent ON competitions(opponent_id);
CREATE INDEX idx_competitions_created ON competitions(created_at DESC);

-- Competition matches
CREATE TABLE competition_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    winner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_competition_matches_competition ON competition_matches(competition_id);

-- User competition stats
CREATE TABLE user_competition_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER DEFAULT 1500,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_matches INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    streak_type VARCHAR(10) DEFAULT 'none' CHECK (streak_type IN ('wins', 'losses', 'none')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_competition_stats_rating ON user_competition_stats(rating DESC);

-- ============================================
-- PICKS & BETS
-- ============================================

CREATE TABLE picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Pick details
    pick_type VARCHAR(20) NOT NULL CHECK (pick_type IN ('single', 'parlay', 'teaser')),
    sport VARCHAR(20) NOT NULL,
    total_odds DECIMAL(10,2),
    wager DECIMAL(10,2),
    potential_payout DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'cancelled')),
    result_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP,
    shared_publicly BOOLEAN DEFAULT FALSE
);

CREATE TABLE pick_legs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
    
    -- Game info
    game_id VARCHAR(100),
    sport VARCHAR(20),
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    game_time TIMESTAMP,
    
    -- Bet details
    bet_type VARCHAR(20) CHECK (bet_type IN ('moneyline', 'spread', 'total', 'prop')),
    selection VARCHAR(50),
    odds DECIMAL(10,2),
    line DECIMAL(10,2),
    
    -- Result
    result VARCHAR(20) CHECK (result IN ('pending', 'won', 'lost', 'push')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_picks_user ON picks(user_id);
CREATE INDEX idx_picks_status ON picks(status);
CREATE INDEX idx_pick_legs_pick ON pick_legs(pick_id);

-- ============================================
-- ACHIEVEMENTS
-- ============================================

CREATE TABLE achievements (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50),
    xp_reward INTEGER DEFAULT 0,
    rarity VARCHAR(20) CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    
    -- Unlock criteria
    required_value INTEGER,
    stat_type VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL REFERENCES achievements(id),
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- ============================================
-- CHALLENGES
-- ============================================

CREATE TABLE challenges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    type VARCHAR(20) CHECK (type IN ('daily', 'weekly')),
    
    -- Requirements
    goal_type VARCHAR(50),
    goal_value INTEGER,
    
    -- Rewards
    coins_reward INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    
    -- Active period
    start_date DATE,
    end_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id VARCHAR(50) NOT NULL REFERENCES challenges(id),
    
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    reward_claimed BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, challenge_id)
);

CREATE INDEX idx_user_challenges_user ON user_challenges(user_id);
CREATE INDEX idx_user_challenges_challenge ON user_challenges(challenge_id);

-- ============================================
-- SHOP & ITEMS
-- ============================================

CREATE TABLE shop_items (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50),
    
    -- Pricing
    coin_price INTEGER NOT NULL,
    
    -- Item properties
    item_type VARCHAR(50) CHECK (item_type IN ('boost', 'cosmetic', 'feature')),
    boost_type VARCHAR(50),
    boost_multiplier DECIMAL(3,2),
    duration_hours INTEGER,
    
    -- Availability
    is_available BOOLEAN DEFAULT TRUE,
    stock INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL REFERENCES shop_items(id),
    
    quantity INTEGER DEFAULT 1,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMP
);

CREATE INDEX idx_user_inventory_user ON user_inventory(user_id);

-- ============================================
-- COIN TRANSACTIONS
-- ============================================

CREATE TABLE coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('earn', 'spend')),
    source VARCHAR(50),
    description TEXT,
    
    balance_after INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON coin_transactions(transaction_type);

-- ============================================
-- SOCIAL FEATURES
-- ============================================

CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    activity_type VARCHAR(50),
    content JSONB,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
    
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);

CREATE TABLE activity_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(activity_id, user_id)
);

CREATE TABLE activity_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BETTING POOLS
-- ============================================

CREATE TABLE betting_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    game_id VARCHAR(100),
    entry_coins INTEGER NOT NULL,
    max_participants INTEGER,
    
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'locked', 'completed', 'cancelled')),
    
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pool_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_id UUID NOT NULL REFERENCES betting_pools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    pick JSONB,
    result VARCHAR(20),
    payout INTEGER,
    
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(pool_id, user_id)
);

-- ============================================
-- REFERRAL BADGES & ACHIEVEMENTS
-- ============================================

CREATE TABLE referral_badges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('milestone', 'tier', 'special')),
    unlock_type VARCHAR(50) NOT NULL CHECK (unlock_type IN ('referral_count', 'coins_earned', 'subscription_conversion')),
    unlock_value INTEGER,
    
    -- Badge properties
    color VARCHAR(20),
    rarity VARCHAR(20) CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    points INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_referral_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) NOT NULL REFERENCES referral_badges(id),
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    featured BOOLEAN DEFAULT FALSE,
    
    UNIQUE(user_id, badge_id),
    UNIQUE(user_id, featured) WHERE featured = true
);

CREATE INDEX idx_user_referral_badges_user ON user_referral_badges(user_id);
CREATE INDEX idx_user_referral_badges_badge ON user_referral_badges(badge_id);
CREATE INDEX idx_user_referral_badges_featured ON user_referral_badges(featured);

-- ============================================
-- REFERRALS (Enhanced)
-- ============================================

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_used VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired')),
    coins_earned INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    first_pick_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referee_id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_code ON referrals(code_used);

-- Referral events tracking
CREATE TABLE referral_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_referral_events_user ON referral_events(user_id);
CREATE INDEX idx_referral_events_type ON referral_events(event_type);

-- ============================================
-- LEADERBOARDS
-- ============================================

CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leaderboard_type VARCHAR(50) NOT NULL CHECK (leaderboard_type IN ('referrals', 'coins', 'wins', 'streak', 'weekly')),
    
    rank INTEGER NOT NULL,
    value INTEGER NOT NULL,
    previous_rank INTEGER,
    
    period_start DATE,
    period_end DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, leaderboard_type, period_start)
);

CREATE INDEX idx_leaderboard_type ON leaderboard_entries(leaderboard_type);
CREATE INDEX idx_leaderboard_rank ON leaderboard_entries(leaderboard_type, rank);
CREATE INDEX idx_leaderboard_period ON leaderboard_entries(period_start, period_end);

-- ============================================
-- COIN TRANSACTIONS
-- ============================================

CREATE TABLE coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('earn', 'spend', 'refund', 'bonus', 'referral', 'achievement', 'challenge', 'daily')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON coin_transactions(type);
CREATE INDEX idx_coin_transactions_created ON coin_transactions(created_at DESC);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(200) NOT NULL,
    body TEXT,
    icon VARCHAR(50),
    category VARCHAR(50),
    priority VARCHAR(20),
    
    read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- ============================================
-- ANALYTICS & TRACKING
-- ============================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    session_token VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_type VARCHAR(50),
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate win rate on pick update
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('won', 'lost') AND OLD.status = 'pending' THEN
        UPDATE users SET
            wins = CASE WHEN NEW.status = 'won' THEN wins + 1 ELSE wins END,
            losses = CASE WHEN NEW.status = 'lost' THEN losses + 1 ELSE losses END,
            total_picks = total_picks + 1,
            win_rate = CASE 
                WHEN total_picks + 1 > 0 THEN 
                    (CASE WHEN NEW.status = 'won' THEN wins + 1 ELSE wins END)::DECIMAL / (total_picks + 1)
                ELSE 0 
            END,
            current_streak = CASE 
                WHEN NEW.status = 'won' THEN current_streak + 1
                ELSE 0
            END,
            best_streak = CASE
                WHEN NEW.status = 'won' AND current_streak + 1 > best_streak THEN current_streak + 1
                ELSE best_streak
            END
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stats_on_pick_result AFTER UPDATE ON picks
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default achievements (will be populated by seed script)
-- Insert default challenges (will be populated by seed script)
-- Insert shop items (will be populated by seed script)

-- ============================================
-- REFERRALS & REWARDS
-- ============================================

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_used VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired')),
    coins_earned INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    first_pick_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referee_id) -- Each user can only be referred once
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_code ON referrals(code_used);

-- Referral events tracking
CREATE TABLE referral_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_referral_events_user ON referral_events(user_id);
CREATE INDEX idx_referral_events_type ON referral_events(event_type);

-- Coin transactions for tracking all coin movements
CREATE TABLE coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('earn', 'spend', 'refund', 'bonus', 'referral', 'achievement', 'challenge', 'daily')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON coin_transactions(type);
CREATE INDEX idx_coin_transactions_created ON coin_transactions(created_at DESC);

-- Create indexes for performance
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_picks_created_at ON picks(created_at DESC);
CREATE INDEX idx_activity_feed_composite ON activity_feed(user_id, created_at DESC);

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
