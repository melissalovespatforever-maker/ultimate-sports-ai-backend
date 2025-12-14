-- ============================================
-- DAILY DEALS SYSTEM - Database Migration
-- Tracks deal purchases, stock levels, and user purchase history
-- ============================================

-- Daily Deal Purchases Table
CREATE TABLE IF NOT EXISTS daily_deal_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    deal_id VARCHAR(50) NOT NULL,
    deal_name VARCHAR(100) NOT NULL,
    normal_price INTEGER NOT NULL,
    deal_price INTEGER NOT NULL,
    discount_percent INTEGER NOT NULL,
    savings INTEGER NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shop Item Inventory (for permanent avatars & boosters)
CREATE TABLE IF NOT EXISTS shop_inventory (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    tier VARCHAR(20) DEFAULT 'FREE',
    description TEXT,
    icon VARCHAR(10),
    stock INTEGER DEFAULT -1, -- -1 = unlimited
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Shop Purchases (for permanent items like avatars)
CREATE TABLE IF NOT EXISTS user_shop_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price_paid INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    purchased_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, item_id) -- Prevent duplicate purchases of same item
);

-- Active Boosters Table (time-limited effects)
CREATE TABLE IF NOT EXISTS active_boosters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    booster_type VARCHAR(50) NOT NULL, -- 'coin-2x', 'xp-2x', 'mega-pack', 'luck-charm'
    multiplier DECIMAL(3,2) DEFAULT 2.00,
    duration_hours INTEGER DEFAULT 24,
    activated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, booster_type) -- One booster of each type active at a time
);

-- Daily Deal Stock Tracking (resets daily)
CREATE TABLE IF NOT EXISTS daily_deal_stock (
    deal_id VARCHAR(50) PRIMARY KEY,
    stock_remaining INTEGER NOT NULL,
    max_stock INTEGER NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_deal_purchases_user ON daily_deal_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_deal_purchases_date ON daily_deal_purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_deal_purchases_deal ON daily_deal_purchases(deal_id);

CREATE INDEX IF NOT EXISTS idx_user_shop_purchases_user ON user_shop_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shop_purchases_item ON user_shop_purchases(item_id);

CREATE INDEX IF NOT EXISTS idx_active_boosters_user ON active_boosters(user_id);
CREATE INDEX IF NOT EXISTS idx_active_boosters_expires ON active_boosters(expires_at);

-- Seed shop inventory with default items
INSERT INTO shop_inventory (item_id, item_name, category, price, tier, description, icon) VALUES
('coin-2x', '2x Coin Booster', 'boosters', 500, 'FREE', 'Double your coin earnings for 24 hours', '💰'),
('xp-2x', '2x XP Booster', 'boosters', 400, 'FREE', 'Double your XP gains for 24 hours', '📈'),
('mega-pack', 'Mega Booster Pack', 'boosters', 800, 'PRO', '2x Coins + 2x XP for 24 hours', '🎁'),
('luck-charm', 'Lucky Charm', 'boosters', 1200, 'VIP', '3x rewards for 12 hours', '🍀'),

('jordan-1', 'Air Jordan 1 Avatar', 'avatars', 1500, 'PRO', 'Classic sneaker style', '👟'),
('trophy-gold', 'Gold Trophy Avatar', 'avatars', 2000, 'PRO', 'Winner status', '🏆'),
('crown-royal', 'Royal Crown Avatar', 'avatars', 2500, 'VIP', 'King of predictions', '👑'),
('diamond-hands', 'Diamond Hands Avatar', 'avatars', 3000, 'VIP', 'Elite trader badge', '💎'),

('championship-ring', 'Championship Ring', 'exclusive', 25000, 'VIP', 'Ultimate bragging rights', '💍'),
('private-jet', 'Private Jet Status', 'exclusive', 50000, 'VIP', 'Luxury tier access', '✈️')

ON CONFLICT (item_id) DO NOTHING;

-- Seed initial deal stock (these will be managed by the daily reset)
INSERT INTO daily_deal_stock (deal_id, stock_remaining, max_stock) VALUES
('coin-2x-deal', 50, 50),
('xp-2x-deal', 50, 50),
('mega-pack-deal', 30, 30),
('luck-charm-deal', 20, 20),
('jordan-1-deal', 15, 15),
('trophy-gold-deal', 15, 15),
('crown-royal-deal', 10, 10),
('diamond-hands-deal', 10, 10),
('championship-ring-deal', 5, 5),
('private-jet-deal', 3, 3)

ON CONFLICT (deal_id) DO UPDATE SET
    last_reset_date = CURRENT_DATE,
    stock_remaining = EXCLUDED.max_stock,
    updated_at = NOW();

-- Function to reset daily deal stock at midnight
CREATE OR REPLACE FUNCTION reset_daily_deal_stock()
RETURNS void AS $$
BEGIN
    UPDATE daily_deal_stock
    SET stock_remaining = max_stock,
        last_reset_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to check and clean expired boosters
CREATE OR REPLACE FUNCTION cleanup_expired_boosters()
RETURNS void AS $$
BEGIN
    DELETE FROM active_boosters
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE daily_deal_purchases IS 'Tracks all daily deal purchases with pricing and discount info';
COMMENT ON TABLE shop_inventory IS 'Master catalog of all purchasable shop items';
COMMENT ON TABLE user_shop_purchases IS 'Permanent items owned by users (avatars, etc)';
COMMENT ON TABLE active_boosters IS 'Time-limited booster effects currently active for users';
COMMENT ON TABLE daily_deal_stock IS 'Current stock levels for limited daily deals';
