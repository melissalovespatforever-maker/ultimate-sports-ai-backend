-- ============================================
-- ULTIMATE SPORTS AI - SEED DATA
-- Initial data for development and production
-- ============================================

-- ============================================
-- AI COACHES
-- ============================================

INSERT INTO ai_coaches (name, sport, bio, expertise_level, win_rate, followers, is_active) 
VALUES 
('Coach Brady', 'Football', 'Super Bowl winning coach', 'expert', 72.5, 15000, TRUE),
('Coach Jordan', 'Basketball', 'NBA legend analyst', 'expert', 68.3, 12000, TRUE),
('Coach Belichick', 'Football', 'Championship strategist', 'master', 75.2, 18000, TRUE),
('Coach LeBron Analyst', 'Basketball', 'Modern game expert', 'advanced', 65.8, 9000, TRUE),
('Coach Mahomes Breakdown', 'Football', 'QB specialist', 'advanced', 63.4, 7500, TRUE),
('Coach Baseball Stats', 'Baseball', 'Sabermetrics expert', 'expert', 71.2, 6000, TRUE),
('Coach NHL Insider', 'Hockey', 'Hockey analytics pro', 'advanced', 62.1, 5500, TRUE),
('Coach Soccer Pro', 'Soccer', 'European leagues specialist', 'expert', 69.8, 8000, TRUE),
('Coach MMA Expert', 'MMA', 'Fighting technique analyst', 'advanced', 61.5, 4500, TRUE),
('Coach Tennis Master', 'Tennis', 'Grand Slam predictor', 'expert', 70.3, 6500, TRUE),
('Coach Golf Analyst', 'Golf', 'Tournament strategy guide', 'advanced', 64.7, 4000, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- TOURNAMENTS
-- ============================================

INSERT INTO tournaments (name, type, entry_fee, prize_pool, max_players, status, start_time, duration, tier)
VALUES
('Weekend Warriors', 'Multi-Sport', 50, 1000, 100, 'registering', NOW() + INTERVAL '2 days', '2 days', 'intermediate'),
('NBA Finals Challenge', 'Basketball', 100, 5000, 256, 'registering', NOW() + INTERVAL '7 hours', '7 days', 'expert'),
('NFL Sunday Special', 'Football', 75, 2500, 200, 'registering', NOW() + INTERVAL '1 day', '1 day', 'intermediate'),
('Baseball Grand Slam', 'Baseball', 25, 500, 50, 'registering', NOW() + INTERVAL '7 days', '1 week', 'beginner'),
('Soccer Parlay Masters', 'Soccer', 150, 10000, 500, 'registering', NOW() + INTERVAL '5 days', '1 month', 'expert'),
('Ultimate Champion', 'All Sports', 250, 25000, 1000, 'registering', NOW() + INTERVAL '30 days', '3 months', 'legendary')
ON CONFLICT DO NOTHING;

-- ============================================
-- ACHIEVEMENTS
-- ============================================

INSERT INTO achievements (id, name, description, icon, category, xp_reward, rarity)
VALUES
('first_pick', 'First Pick', 'Make your first sports pick', '🎯', 'picks', 100, 'common'),
('first_win', 'First Victory', 'Win your first pick', '🏆', 'picks', 200, 'common'),
('hot_streak', 'Hot Streak', 'Win 3 picks in a row', '🔥', 'streaks', 300, 'rare'),
('unstoppable', 'Unstoppable', 'Win 5 picks in a row', '⚡', 'streaks', 500, 'epic'),
('legendary_streak', 'Legendary Streak', 'Win 10 picks in a row', '👑', 'streaks', 1000, 'legendary'),
('casual_bettor', 'Casual Bettor', 'Make 10 picks', '📊', 'picks', 300, 'common'),
('serious_player', 'Serious Player', 'Make 50 picks', '💪', 'picks', 500, 'rare'),
('veteran', 'Veteran', 'Make 100 picks', '🎖️', 'picks', 1000, 'epic'),
('master', 'Master Bettor', 'Make 500 picks', '⭐', 'picks', 2500, 'legendary'),
('sharp_bettor', 'Sharp Bettor', 'Achieve 60% win rate', '🧠', 'performance', 500, 'rare'),
('expert', 'Expert Handicapper', 'Achieve 70% win rate', '🎓', 'performance', 1000, 'epic'),
('daily_grind', 'Daily Grind', 'Login 7 days in a row', '📅', 'engagement', 300, 'common'),
('dedicated', 'Dedicated', 'Login 30 days in a row', '💯', 'engagement', 1000, 'rare'),
('coin_collector', 'Coin Collector', 'Earn 1000 coins', '💰', 'coins', 200, 'common'),
('coin_master', 'Coin Master', 'Earn 10000 coins', '💸', 'coins', 500, 'rare')
ON CONFLICT DO NOTHING;

-- ============================================
-- CHALLENGES
-- ============================================

INSERT INTO challenges (id, name, description, type, goal_value, coins_reward)
VALUES
('daily_3picks', 'Daily Triple', 'Make 3 picks today', 'daily', 3, 50),
('daily_parlay', 'Parlay Master', 'Win a 3-leg parlay', 'daily', 3, 100),
('weekly_5wins', 'Win 5 This Week', 'Get 5 wins this week', 'weekly', 5, 250),
('weekly_perfect', 'Perfect Week', 'Win all picks in a day', 'weekly', 7, 500)
ON CONFLICT DO NOTHING;

-- ============================================
-- SHOP ITEMS
-- ============================================

INSERT INTO shop_items (name, description, price, category, type)
VALUES
('Bonus Coins 100', '+100 bonus coins', 0, 'coins', 'bundle'),
('Bonus Coins 500', '+500 bonus coins', 0, 'coins', 'bundle'),
('Lucky Badge', 'Rare cosmetic badge', 250, 'cosmetics', 'badge'),
('VIP Status', '30 days of VIP benefits', 1000, 'membership', 'subscription'),
('AI Coach Unlock', 'Unlock premium AI coach', 500, 'coaches', 'unlock'),
('Mystery Box', 'Random reward item', 100, 'special', 'mystery')
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS LOG
-- ============================================

SELECT 'Database initialization complete!' AS status,
       (SELECT COUNT(*) FROM tournaments) as tournaments,
       (SELECT COUNT(*) FROM ai_coaches) as coaches,
       (SELECT COUNT(*) FROM achievements) as achievements,
       (SELECT COUNT(*) FROM challenges) as challenges,
       (SELECT COUNT(*) FROM shop_items) as shop_items;
