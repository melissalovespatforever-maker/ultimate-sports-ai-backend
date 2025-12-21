-- ============================================
-- ULTIMATE SPORTS AI - COMPLETE DATABASE SCHEMA
-- Full production schema with all tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(10) DEFAULT '👤',
    subscription_tier VARCHAR(10) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'vip')),
    
    -- PayPal Integration
    paypal_customer_id VARCHAR(100) UNIQUE,
    paypal_subscription_id VARCHAR(100),
    subscription_status VARCHAR(20) DEFAULT 'inactive',
    subscription_starts_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    subscription_trial_ends TIMESTAMP,
    
    -- Referral System
    referral_code VARCHAR(50) UNIQUE,
    referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    referred_at TIMESTAMP,
    
    -- Stats
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 1000,
    total_picks INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_rate DECIMAL(5,4) DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
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
    reset_token_expires TIMESTAMP,
    age_verified BOOLEAN DEFAULT FALSE,
    age_verification_date TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier);

-- ============================================
-- REFRESH TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- AI COACHES
-- ============================================

CREATE TABLE IF NOT EXISTS coaches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    specialty VARCHAR(100) NOT NULL,
    avatar VARCHAR(10),
    tier VARCHAR(10) NOT NULL CHECK (tier IN ('FREE', 'PRO', 'VIP')),
    strategy VARCHAR(50) NOT NULL,
    bio TEXT,
    followers INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- COACH PICKS
-- ============================================

CREATE TABLE IF NOT EXISTS coach_picks (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL,
    game_id VARCHAR(100) NOT NULL,
    sport VARCHAR(100) NOT NULL,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    pick_team VARCHAR(100) NOT NULL,
    pick_type VARCHAR(50) NOT NULL,
    odds INTEGER NOT NULL,
    confidence INTEGER NOT NULL,
    reasoning TEXT,
    game_time TIMESTAMP NOT NULL,
    result VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_picks_coach_id ON coach_picks(coach_id);
CREATE INDEX IF NOT EXISTS idx_picks_game_time ON coach_picks(game_time DESC);
CREATE INDEX IF NOT EXISTS idx_picks_result ON coach_picks(result);
CREATE INDEX IF NOT EXISTS idx_picks_sport ON coach_picks(sport);

-- ============================================
-- COACH STATS
-- ============================================

CREATE TABLE IF NOT EXISTS coach_stats (
    coach_id INTEGER PRIMARY KEY,
    total_picks INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    pushes INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2) DEFAULT 0.00,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    roi DECIMAL(8,2) DEFAULT 0.00,
    units_won DECIMAL(10,2) DEFAULT 0.00,
    last_pick_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
);

-- ============================================
-- TOURNAMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'Multi-Sport',
    entry_fee INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 100,
    current_players INTEGER DEFAULT 0,
    players JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'registering' CHECK (status IN ('registering', 'upcoming', 'active', 'completed')),
    format VARCHAR(20) DEFAULT 'bracket',
    tier VARCHAR(20) DEFAULT 'intermediate',
    start_time TIMESTAMP,
    duration VARCHAR(50) DEFAULT '1 day',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON tournaments(start_time);

-- ============================================
-- LEADERBOARDS
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    rank INTEGER,
    points INTEGER DEFAULT 0,
    tournament_id INTEGER,
    period VARCHAR(20) DEFAULT 'global',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboards_user ON leaderboards(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_period ON leaderboards(period);
CREATE INDEX IF NOT EXISTS idx_leaderboards_rank ON leaderboards(rank);

-- ============================================
-- ACHIEVEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    category VARCHAR(50),
    xp_reward INTEGER DEFAULT 0,
    rarity VARCHAR(20),
    required_value INTEGER,
    stat_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USER ACHIEVEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    achievement_id VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ============================================
-- CHALLENGES
-- ============================================

CREATE TABLE IF NOT EXISTS challenges (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    type VARCHAR(20) CHECK (type IN ('daily', 'weekly', 'monthly')),
    goal_type VARCHAR(50),
    goal_value INTEGER,
    coins_reward INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SHOP ITEMS & INVENTORY
-- ============================================

CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    category VARCHAR(50),
    image_url VARCHAR(255),
    type VARCHAR(20),
    icon VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_inventory (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    tier VARCHAR(20) DEFAULT 'FREE',
    description TEXT,
    icon VARCHAR(10),
    stock INTEGER DEFAULT -1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_shop_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price_paid INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    purchased_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_shop_purchases_user ON user_shop_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shop_purchases_item ON user_shop_purchases(item_id);

-- ============================================
-- DAILY DEALS & BOOSTERS
-- ============================================

CREATE TABLE IF NOT EXISTS daily_deal_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    deal_id VARCHAR(50) NOT NULL,
    deal_name VARCHAR(100) NOT NULL,
    normal_price INTEGER NOT NULL,
    deal_price INTEGER NOT NULL,
    discount_percent INTEGER NOT NULL,
    savings INTEGER NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_deal_purchases_user ON daily_deal_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_deal_purchases_date ON daily_deal_purchases(purchase_date DESC);

CREATE TABLE IF NOT EXISTS daily_deal_stock (
    deal_id VARCHAR(50) PRIMARY KEY,
    stock_remaining INTEGER NOT NULL,
    max_stock INTEGER NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_boosters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    booster_type VARCHAR(50) NOT NULL,
    multiplier DECIMAL(3,2) DEFAULT 2.00,
    duration_hours INTEGER DEFAULT 24,
    activated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, booster_type)
);

CREATE INDEX IF NOT EXISTS idx_active_boosters_user ON active_boosters(user_id);
CREATE INDEX IF NOT EXISTS idx_active_boosters_expires ON active_boosters(expires_at);

-- ============================================
-- BETS & WAGERING
-- ============================================

CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tournament_id INTEGER,
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_tournament ON bets(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);

-- ============================================
-- LIVE BETTING TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS live_bet_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bet_id INTEGER,
    event_id VARCHAR(100),
    event_name VARCHAR(255),
    current_odds DECIMAL(8,2),
    current_value DECIMAL(10,2),
    unrealized_profit DECIMAL(10,2),
    profit_loss_percent DECIMAL(8,2),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_bet_tracking_user ON live_bet_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_live_bet_tracking_bet ON live_bet_tracking(bet_id);

-- ============================================
-- REFERRAL SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL,
    referred_user_id INTEGER NOT NULL,
    referral_code VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    commission_amount INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(referrer_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_name VARCHAR(100),
    price INTEGER,
    billing_cycle VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    auto_renew BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    paid_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

-- ============================================
-- TWO-FACTOR AUTH
-- ============================================

CREATE TABLE IF NOT EXISTS two_factor_auth (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    secret_key VARCHAR(255) NOT NULL,
    backup_codes TEXT[],
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- PUSH NOTIFICATIONS & EMAIL
-- ============================================

CREATE TABLE IF NOT EXISTS push_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email_type VARCHAR(50),
    recipient_email VARCHAR(255),
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);

-- ============================================
-- SOCIAL & INTERACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS user_followers (
    id SERIAL PRIMARY KEY,
    follower_user_id INTEGER NOT NULL,
    following_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_user_id, following_user_id)
);

CREATE TABLE IF NOT EXISTS user_friends (
    id SERIAL PRIMARY KEY,
    user_id_1 INTEGER NOT NULL,
    user_id_2 INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id_1, user_id_2)
);

-- ============================================
-- BADGES & STATS
-- ============================================

CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(10),
    rarity VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    badge_id INTEGER NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id),
    UNIQUE(user_id, badge_id)
);

-- ============================================
-- ANALYTICS & TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS user_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    metric_type VARCHAR(50),
    metric_value INTEGER,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_analytics_user ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_type ON user_analytics(metric_type);

-- ============================================
-- AGE VERIFICATION
-- ============================================

CREATE TABLE IF NOT EXISTS age_verification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(50),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- OAUTH PROVIDERS
-- ============================================

CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token VARCHAR(500),
    refresh_token VARCHAR(500),
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_providers_user ON oauth_providers(user_id);
