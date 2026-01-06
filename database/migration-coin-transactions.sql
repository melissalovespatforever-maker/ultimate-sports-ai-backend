-- ============================================
-- COIN TRANSACTIONS TABLE MIGRATION
-- Critical missing table for transaction tracking
-- ============================================

CREATE TABLE IF NOT EXISTS coin_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit', 'win', 'loss', 'bet', 'purchase', 'reward')),
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON coin_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON coin_transactions(type);

-- ============================================
-- USER INVENTORY TABLE
-- Store purchased items, boosters, avatars, etc.
-- ============================================

CREATE TABLE IF NOT EXISTS user_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('booster', 'avatar', 'cosmetic', 'consumable', 'protection')),
    quantity INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_type ON user_inventory(item_type);
CREATE INDEX IF NOT EXISTS idx_user_inventory_expires ON user_inventory(expires_at);

-- ============================================
-- PICKS TABLE
-- Store user picks for analytics and tracking
-- ============================================

CREATE TABLE IF NOT EXISTS picks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    game_id VARCHAR(100) NOT NULL,
    sport VARCHAR(50) NOT NULL,
    pick_type VARCHAR(50) NOT NULL,
    picked_team VARCHAR(100),
    odds DECIMAL(8,2),
    stake INTEGER,
    potential_win INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'cancelled')),
    result_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_picks_user ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(status);
CREATE INDEX IF NOT EXISTS idx_picks_sport ON picks(sport);
CREATE INDEX IF NOT EXISTS idx_picks_created ON picks(created_at DESC);

-- ============================================
-- BETTING POOL PARTICIPANTS
-- For pool-based wagering
-- ============================================

CREATE TABLE IF NOT EXISTS pool_participants (
    id SERIAL PRIMARY KEY,
    pool_id VARCHAR(100) NOT NULL,
    user_id INTEGER NOT NULL,
    entry_amount INTEGER NOT NULL,
    pick VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    payout_amount INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pool_participants_pool ON pool_participants(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_participants_user ON pool_participants(user_id);

-- ============================================
-- PICK LEGS (for parlays)
-- Individual legs of multi-leg bets
-- ============================================

CREATE TABLE IF NOT EXISTS pick_legs (
    id SERIAL PRIMARY KEY,
    pick_id INTEGER NOT NULL,
    game_id VARCHAR(100) NOT NULL,
    sport VARCHAR(50) NOT NULL,
    pick_type VARCHAR(50) NOT NULL,
    picked_team VARCHAR(100),
    odds DECIMAL(8,2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pick_id) REFERENCES picks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pick_legs_pick ON pick_legs(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_legs_game ON pick_legs(game_id);
