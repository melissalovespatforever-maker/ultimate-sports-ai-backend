-- ============================================
-- ACHIEVEMENT LEADERBOARDS - DATABASE SCHEMA
-- Supports real-time rankings and tracking
-- ============================================

-- ========== ACHIEVEMENTS TABLE ==========
-- Stores all available achievements in the platform
CREATE TABLE IF NOT EXISTS achievements (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    xp INT DEFAULT 0,
    category VARCHAR(50),
    rarity VARCHAR(50),
    target_value INT,
    progress_type VARCHAR(100),
    series VARCHAR(100),
    tier INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== USER ACHIEVEMENTS TABLE ==========
-- Tracks which achievements each user has unlocked
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INT NOT NULL,
    achievement_id VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    xp_earned INT DEFAULT 0,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

-- ========== PERFORMANCE INDEXES ==========
-- Optimize leaderboard queries

-- Index for recent unlocks feed (most recent first)
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_desc 
ON user_achievements(unlocked_at DESC);

-- Index for user-specific lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_user 
ON user_achievements(user_id);

-- Index for achievement-specific lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement 
ON user_achievements(achievement_id);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_achievements_category 
ON achievements(category);

-- Index for rarity filtering
CREATE INDEX IF NOT EXISTS idx_achievements_rarity 
ON achievements(rarity);

-- Composite index for category leaderboards
CREATE INDEX IF NOT EXISTS idx_achievements_category_xp 
ON achievements(category, xp);

-- ========== SEED ACHIEVEMENTS DATA ==========
-- Insert all 50+ achievements from the platform

INSERT INTO achievements (id, name, description, icon, xp, category, rarity, target_value, progress_type, series, tier) VALUES
-- Login Streaks
('first-login', 'Welcome Aboard', 'Complete your first login', '👋', 100, 'login', 'common', 1, 'totalLogins', 'login-streak', 0),
('streak-3', 'Getting Started', 'Login 3 days in a row', '🔥', 200, 'login', 'common', 3, 'loginStreak', 'login-streak', 1),
('streak-7', 'Week Warrior', 'Login 7 days in a row', '⚡', 500, 'login', 'uncommon', 7, 'loginStreak', 'login-streak', 2),
('streak-30', 'Monthly Master', 'Login 30 days in a row', '🌟', 2000, 'login', 'rare', 30, 'loginStreak', 'login-streak', 3),
('streak-100', 'Century Club', 'Login 100 days in a row', '👑', 10000, 'login', 'legendary', 100, 'loginStreak', 'login-streak', 4),

-- Rank Achievements
('rank-bronze', 'Bronze Rookie', 'Reach Bronze rank', '🥉', 100, 'rank', 'common', 1000, 'xp', 'rank-up', 1),
('rank-silver', 'Silver Scout', 'Reach Silver rank', '🥈', 300, 'rank', 'common', 5000, 'xp', 'rank-up', 2),
('rank-gold', 'Golden Pro', 'Reach Gold rank', '🥇', 800, 'rank', 'uncommon', 20000, 'xp', 'rank-up', 3),
('rank-platinum', 'Platinum Elite', 'Reach Platinum rank', '💎', 2000, 'rank', 'rare', 50000, 'xp', 'rank-up', 4),
('rank-diamond', 'Diamond Legend', 'Reach Diamond rank', '💠', 5000, 'rank', 'epic', 100000, 'xp', 'rank-up', 5),
('hall-of-fame', 'Hall of Fame', 'Reach Legendary tier status', '🏛️', 50000, 'rank', 'legendary', 1000000, 'xp', NULL, NULL),

-- Betting Achievements
('first-bet', 'First Wager', 'Place your first bet', '🎲', 100, 'betting', 'common', 1, 'totalBetsPlaced', 'betting-volume', 1),
('win-10', 'Hot Streak', 'Win 10 bets', '🔥', 500, 'betting', 'uncommon', 10, 'totalBetsWon', 'betting-wins', 1),
('win-50', 'Betting Master', 'Win 50 bets', '⭐', 2500, 'betting', 'rare', 50, 'totalBetsWon', 'betting-wins', 2),
('perfect-parlay', 'Parlay Perfect', 'Win a 5-leg parlay', '🎯', 1000, 'betting', 'rare', NULL, NULL, NULL, NULL),

-- Tournament Achievements
('tournament-entry', 'Tournament Debut', 'Enter your first tournament', '🏆', 200, 'tournament', 'common', 1, 'tournamentsEntered', 'tournament-participation', 1),
('tournament-win', 'Champion', 'Win a tournament', '👑', 1500, 'tournament', 'uncommon', 1, 'tournamentsWon', 'tournament-wins', 1),
('tournament-3wins', 'Triple Threat', 'Win 3 tournaments', '🔱', 5000, 'tournament', 'rare', 3, 'tournamentsWon', 'tournament-wins', 2),
('tournament-5wins', 'Tournament Master', 'Win 5 tournaments', '💍', 10000, 'tournament', 'epic', 5, 'tournamentsWon', 'tournament-wins', 3),
('perfect-season', 'Perfect Season', 'Win every battle for 30 days', '✨', 25000, 'tournament', 'legendary', 30, 'perfectDays', NULL, NULL),

-- Sport Specific Trophies
('nfl-champ', 'Gridiron Greatness', 'Win an NFL themed tournament', '🏈', 2000, 'tournament', 'rare', NULL, NULL, NULL, NULL),
('nba-champ', 'Dunk Master', 'Win an NBA themed tournament', '🏀', 2000, 'tournament', 'rare', NULL, NULL, NULL, NULL),
('mlb-champ', 'World Series Winner', 'Win an MLB themed tournament', '⚾', 2000, 'tournament', 'rare', NULL, NULL, NULL, NULL),
('soccer-champ', 'Golden Boot', 'Win a Soccer themed tournament', '⚽', 2000, 'tournament', 'rare', NULL, NULL, NULL, NULL),

-- Coins Achievements
('coins-1k', 'Starter Saver', 'Earn 1,000 total coins', '💰', 100, 'coins', 'common', 1000, 'totalCoinsEarned', 'wealth', 1),
('coins-10k', 'Coin Collector', 'Earn 10,000 total coins', '💸', 500, 'coins', 'uncommon', 10000, 'totalCoinsEarned', 'wealth', 2),
('coins-100k', 'Wealthy Winner', 'Earn 100,000 total coins', '🤑', 2000, 'coins', 'rare', 100000, 'totalCoinsEarned', 'wealth', 3),
('coins-1m', 'Millionaire', 'Earn 1,000,000 total coins', '💎', 10000, 'coins', 'legendary', 1000000, 'totalCoinsEarned', 'wealth', 4),

-- Social Achievements
('chat-first', 'Social Butterfly', 'Send your first chat message', '💬', 50, 'social', 'common', 1, 'chatMessagesSent', 'social-chat', 1),
('shop-first', 'First Purchase', 'Buy your first item from shop', '🛍️', 100, 'social', 'common', 1, 'itemsPurchased', 'shopping', 1),
('referral-master', 'Referral Master', 'Refer 10 friends', '🤝', 3000, 'social', 'rare', 10, 'referralsCompleted', NULL, NULL),

-- Minigame Achievements
('minigame-master', 'Game Master', 'Win at least 1 game in 5 different minigames', '🎮', 1000, 'minigames', 'uncommon', 5, 'uniqueMinigamesWon', NULL, NULL),
('minigame-veteran', 'Veteran Player', 'Win at least 1 game in all 11 minigames', '🏅', 5000, 'minigames', 'epic', 11, 'uniqueMinigamesWon', NULL, NULL),
('lucky-streak', 'Lucky Streak', 'Win 5 Coin Flips in a row', '🍀', 500, 'minigames', 'uncommon', NULL, NULL, NULL, NULL),
('plinko-jackpot', 'Plinko Jackpot', 'Hit the jackpot in Plinko', '💥', 750, 'minigames', 'rare', NULL, NULL, NULL, NULL),
('slots-triple', 'Triple Sevens', 'Get three 7s in Slots', '🎰', 1000, 'minigames', 'rare', NULL, NULL, NULL, NULL),
('basketball-sharpshooter', 'Sharpshooter', 'Score 100+ points in Basketball', '🎯', 600, 'minigames', 'uncommon', NULL, NULL, NULL, NULL),
('trivia-genius', 'Sports Genius', 'Answer 10 trivia questions correctly in a row', '🧠', 800, 'minigames', 'uncommon', NULL, NULL, NULL, NULL),
('sim-undefeated', 'Undefeated Season', 'Win 10 games in a row in Football Sim', '🏆', 1500, 'minigames', 'rare', NULL, NULL, NULL, NULL),

-- Collection Achievements
('collector-starter', 'Card Collector', 'Collect 10 unique player cards', '🃏', 200, 'collection', 'common', 10, 'uniqueCardsOwned', 'collection', 1),
('collector-pro', 'Elite Collector', 'Collect 50 unique player cards', '📚', 1000, 'collection', 'uncommon', 50, 'uniqueCardsOwned', 'collection', 2),
('collector-master', 'Master Collector', 'Collect 100 unique player cards', '📖', 5000, 'collection', 'rare', 100, 'uniqueCardsOwned', 'collection', 3),
('legend-owner', 'Legend Owner', 'Own 5 Legend players', '⭐', 2000, 'collection', 'rare', 5, 'legendsOwned', NULL, NULL),

-- Special Event Achievements
('early-adopter', 'Early Adopter', 'Join during beta period', '🚀', 1000, 'special', 'legendary', NULL, NULL, NULL, NULL),
('comeback-kid', 'Comeback Kid', 'Return after 30 days of inactivity', '🔄', 500, 'special', 'uncommon', NULL, NULL, NULL, NULL),
('night-owl', 'Night Owl', 'Play between 2 AM - 5 AM', '🦉', 100, 'special', 'common', NULL, NULL, NULL, NULL)

ON CONFLICT (id) DO NOTHING;

-- ========== VERIFICATION QUERIES ==========
-- Use these to verify the schema is working

-- Count total achievements
-- SELECT COUNT(*) FROM achievements;

-- Count achievements by category
-- SELECT category, COUNT(*) FROM achievements GROUP BY category;

-- Count achievements by rarity
-- SELECT rarity, COUNT(*) FROM achievements GROUP BY rarity;

-- Top 10 players by badges unlocked
-- SELECT 
--     u.username, 
--     COUNT(DISTINCT ua.achievement_id) as badges_unlocked,
--     SUM(ua.xp_earned) as total_xp
-- FROM users u
-- LEFT JOIN user_achievements ua ON u.id = ua.user_id
-- GROUP BY u.id, u.username
-- ORDER BY badges_unlocked DESC, total_xp DESC
-- LIMIT 10;

-- ========== CLEANUP (if needed) ==========
-- DROP TABLE IF EXISTS user_achievements CASCADE;
-- DROP TABLE IF EXISTS achievements CASCADE;

-- ============================================
-- Schema version: 1.0.0
-- Last updated: January 2025
-- Compatible with: PostgreSQL 12+
-- ============================================
