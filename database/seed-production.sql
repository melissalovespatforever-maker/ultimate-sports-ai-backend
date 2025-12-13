-- ============================================
-- ULTIMATE SPORTS AI - PRODUCTION SEED DATA
-- Only essential data - NO test users
-- ============================================

-- ============================================
-- ACHIEVEMENTS (Essential Game Mechanics)
-- ============================================

INSERT INTO achievements (id, name, description, icon, category, xp_reward, rarity, required_value, stat_type) VALUES
-- First Steps
('first_pick', 'First Pick', 'Make your first sports pick', '🎯', 'picks', 100, 'common', 1, 'total_picks'),
('first_win', 'First Victory', 'Win your first pick', '🏆', 'picks', 200, 'common', 1, 'wins'),
('hot_streak', 'Hot Streak', 'Win 3 picks in a row', '🔥', 'streaks', 300, 'rare', 3, 'current_streak'),
('unstoppable', 'Unstoppable', 'Win 5 picks in a row', '⚡', 'streaks', 500, 'epic', 5, 'current_streak'),
('legendary_streak', 'Legendary Streak', 'Win 10 picks in a row', '👑', 'streaks', 1000, 'legendary', 10, 'current_streak'),

-- Volume
('casual_bettor', 'Casual Bettor', 'Make 10 picks', '📊', 'picks', 300, 'common', 10, 'total_picks'),
('serious_player', 'Serious Player', 'Make 50 picks', '💪', 'picks', 500, 'rare', 50, 'total_picks'),
('veteran', 'Veteran', 'Make 100 picks', '🎖️', 'picks', 1000, 'epic', 100, 'total_picks'),
('master', 'Master Bettor', 'Make 500 picks', '⭐', 'picks', 2500, 'legendary', 500, 'total_picks'),

-- Win Rate
('sharp_bettor', 'Sharp Bettor', 'Achieve 60% win rate (min 20 picks)', '🧠', 'performance', 500, 'rare', 60, 'win_rate'),
('expert', 'Expert Handicapper', 'Achieve 70% win rate (min 50 picks)', '🎓', 'performance', 1000, 'epic', 70, 'win_rate'),
('prodigy', 'Betting Prodigy', 'Achieve 80% win rate (min 100 picks)', '💎', 'performance', 2500, 'legendary', 80, 'win_rate'),

-- Social
('socialite', 'Socialite', 'Get 10 followers', '👥', 'social', 200, 'common', 10, 'followers'),
('influencer', 'Influencer', 'Get 100 followers', '📱', 'social', 500, 'rare', 100, 'followers'),
('celebrity', 'Celebrity', 'Get 1000 followers', '🌟', 'social', 1000, 'epic', 1000, 'followers'),

-- Engagement
('daily_grind', 'Daily Grind', 'Login 7 days in a row', '📅', 'engagement', 300, 'common', 7, 'login_streak'),
('dedicated', 'Dedicated', 'Login 30 days in a row', '💯', 'engagement', 1000, 'rare', 30, 'login_streak'),
('no_life', 'No Life', 'Login 100 days in a row', '🤖', 'engagement', 2500, 'legendary', 100, 'login_streak'),

-- Coins
('coin_collector', 'Coin Collector', 'Earn 1000 coins', '💰', 'coins', 200, 'common', 1000, 'total_coins_earned'),
('coin_master', 'Coin Master', 'Earn 10000 coins', '💸', 'coins', 500, 'rare', 10000, 'total_coins_earned'),
('millionaire', 'Millionaire', 'Earn 100000 coins', '🤑', 'coins', 2000, 'legendary', 100000, 'total_coins_earned');

-- ============================================
-- CHALLENGES (Weekly & Daily)
-- ============================================

INSERT INTO challenges (id, name, description, icon, type, goal_type, goal_value, coins_reward, xp_reward, start_date, end_date) VALUES
-- Daily Challenges
('daily_3picks', 'Daily Triple', 'Make 3 picks today', '🎯', 'daily', 'picks_today', 3, 50, 100, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day'),
('daily_1win', 'Daily Winner', 'Win 1 pick today', '🏆', 'daily', 'wins_today', 1, 75, 150, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day'),
('daily_login', 'Daily Login', 'Login today', '📱', 'daily', 'login', 1, 25, 50, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day'),

-- Weekly Challenges
('weekly_10picks', 'Weekly Grinder', 'Make 10 picks this week', '📊', 'weekly', 'picks_week', 10, 200, 400, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days'),
('weekly_5wins', 'Weekly Champion', 'Win 5 picks this week', '🏅', 'weekly', 'wins_week', 5, 300, 600, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days'),
('weekly_streak', 'Weekly Streaker', 'Get a 3-win streak this week', '🔥', 'weekly', 'streak_week', 3, 250, 500, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days');

-- ============================================
-- SHOP ITEMS (In-Game Economy)
-- ============================================

INSERT INTO shop_items (id, name, description, icon, category, coin_price, item_type, boost_type, boost_multiplier, duration_hours, is_available, stock) VALUES
-- XP Boosts
('xp_boost_1h', 'XP Boost (1h)', 'Earn 2x XP for 1 hour', '⚡', 'boosts', 100, 'boost', 'xp', 2.0, 1, TRUE, NULL),
('xp_boost_24h', 'XP Boost (24h)', 'Earn 2x XP for 24 hours', '⭐', 'boosts', 500, 'boost', 'xp', 2.0, 24, TRUE, NULL),
('xp_boost_mega', 'Mega XP Boost (1h)', 'Earn 5x XP for 1 hour', '💫', 'boosts', 250, 'boost', 'xp', 5.0, 1, TRUE, NULL),

-- Coin Boosts
('coin_boost_1h', 'Coin Boost (1h)', 'Earn 2x coins for 1 hour', '💰', 'boosts', 150, 'boost', 'coins', 2.0, 1, TRUE, NULL),
('coin_boost_24h', 'Coin Boost (24h)', 'Earn 2x coins for 24 hours', '💸', 'boosts', 750, 'boost', 'coins', 2.0, 24, TRUE, NULL),

-- Streak Protection
('streak_freeze', 'Streak Freeze', 'Protect your streak for 1 day', '🛡️', 'protection', 200, 'feature', 'streak_protection', 1.0, 24, TRUE, NULL),
('streak_revive', 'Streak Revive', 'Revive a lost streak (use within 24h)', '💚', 'protection', 500, 'feature', 'streak_revive', 1.0, 0, TRUE, NULL),

-- Premium Features
('ai_insights', 'AI Insights (7 days)', 'Unlock AI predictions for 7 days', '🤖', 'features', 1000, 'feature', 'ai_access', 1.0, 168, TRUE, NULL),
('expert_tips', 'Expert Tips (7 days)', 'Get expert analysis for 7 days', '🎓', 'features', 750, 'feature', 'expert_access', 1.0, 168, TRUE, NULL),

-- Cosmetics
('avatar_pack_1', 'Sports Icon Pack', '20 exclusive sports avatars', '🏆', 'cosmetics', 300, 'cosmetic', NULL, NULL, NULL, TRUE, NULL),
('avatar_pack_2', 'Premium Pack', '50 premium avatars', '💎', 'cosmetics', 1000, 'cosmetic', NULL, NULL, NULL, TRUE, NULL),
('badge_frame_gold', 'Gold Badge Frame', 'Golden profile frame', '👑', 'cosmetics', 500, 'cosmetic', NULL, NULL, NULL, TRUE, NULL),
('badge_frame_diamond', 'Diamond Badge Frame', 'Diamond profile frame', '💎', 'cosmetics', 1500, 'cosmetic', NULL, NULL, NULL, TRUE, NULL);

-- ============================================
-- PRODUCTION COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ PRODUCTION database seeded successfully!';
    RAISE NOTICE '📊 Created: % achievements', (SELECT COUNT(*) FROM achievements);
    RAISE NOTICE '🎯 Created: % challenges', (SELECT COUNT(*) FROM challenges);
    RAISE NOTICE '🏪 Created: % shop items', (SELECT COUNT(*) FROM shop_items);
    RAISE NOTICE '👥 Users: 0 (real users only via OAuth/Registration)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 PRODUCTION MODE ACTIVE';
    RAISE NOTICE '✅ No test/demo users created';
    RAISE NOTICE '✅ Users will register via Google/Apple OAuth';
    RAISE NOTICE '';
END $$;
