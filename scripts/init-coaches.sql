-- ============================================
-- AI Coaches Performance Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS coaches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    avatar VARCHAR(10),
    tier VARCHAR(10) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO coaches (id, name, specialty, avatar, tier, strategy) VALUES
(1, 'The Analyst', 'basketball_nba', '🤖', 'PRO', 'value_betting'),
(2, 'Sharp Shooter', 'americanfootball_nfl', '🏈', 'VIP', 'sharp_money'),
(3, 'Data Dragon', 'baseball_mlb', '⚾', 'PRO', 'consensus'),
(4, 'Ice Breaker', 'icehockey_nhl', '🏒', 'VIP', 'value_betting'),
(5, 'El Futbolista', 'soccer_epl', '⚽', 'VIP', 'sharp_money'),
(6, 'The Gridiron Guru', 'americanfootball_ncaaf', '🏈', 'PRO', 'consensus'),
(7, 'Ace of Aces', 'tennis_atp', '🎾', 'PRO', 'value_betting'),
(8, 'The Brawl Boss', 'mma_mixed_martial_arts', '🥊', 'VIP', 'sharp_money'),
(9, 'The Green Master', 'golf_pga', '⛳', 'PRO', 'consensus'),
(10, 'March Madness', 'basketball_ncaab', '🏀', 'PRO', 'value_betting'),
(11, 'Pixel Prophet', 'esports_lol', '🎮', 'VIP', 'sharp_money')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS coach_picks (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER REFERENCES coaches(id) ON DELETE CASCADE,
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
    result VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coach_stats (
    coach_id INTEGER PRIMARY KEY REFERENCES coaches(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO coach_stats (coach_id, total_picks, wins, losses, accuracy, current_streak, best_streak, roi) VALUES
(1, 547, 406, 141, 74.2, 12, 18, 24.8),
(2, 423, 304, 119, 71.8, 8, 15, 31.2),
(3, 612, 425, 187, 69.4, 5, 22, 18.6),
(4, 389, 282, 107, 72.6, 15, 20, 28.4),
(5, 478, 336, 142, 70.3, 9, 17, 22.1),
(6, 534, 368, 166, 68.9, 7, 14, 19.3),
(7, 445, 325, 120, 73.1, 11, 16, 26.7),
(8, 367, 276, 91, 75.3, 13, 19, 32.8),
(9, 401, 272, 129, 67.8, 6, 13, 17.2),
(10, 589, 415, 174, 70.5, 9, 21, 21.4),
(11, 512, 390, 122, 76.2, 14, 23, 29.6)
ON CONFLICT (coach_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_picks_coach_id ON coach_picks(coach_id);
CREATE INDEX IF NOT EXISTS idx_picks_game_time ON coach_picks(game_time DESC);
CREATE INDEX IF NOT EXISTS idx_picks_result ON coach_picks(result);
CREATE INDEX IF NOT EXISTS idx_picks_sport ON coach_picks(sport);
