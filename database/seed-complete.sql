-- ============================================
-- ULTIMATE SPORTS AI - COMPLETE SEED DATA
-- ============================================

-- ============================================
-- COACHES (11 Total)
-- ============================================

INSERT INTO coaches (name, specialty, avatar, tier, strategy, followers) VALUES
('The Analyst', 'basketball_nba', '🤖', 'FREE', 'value_betting', 15000),
('Sharp Shooter', 'americanfootball_nfl', '🏈', 'VIP', 'sharp_money', 12000),
('Data Dragon', 'baseball_mlb', '⚾', 'PRO', 'consensus', 10000),
('Ice Breaker', 'icehockey_nhl', '🏒', 'VIP', 'value_betting', 9000),
('El Futbolista', 'soccer_epl', '⚽', 'VIP', 'sharp_money', 8000),
('The Gridiron Guru', 'americanfootball_ncaaf', '🏈', 'PRO', 'consensus', 7500),
('Ace of Aces', 'tennis_atp', '🎾', 'PRO', 'value_betting', 6500),
('The Brawl Boss', 'mma_mixed_martial_arts', '🥊', 'VIP', 'sharp_money', 5500),
('The Green Master', 'golf_pga', '⛳', 'PRO', 'consensus', 4500),
('March Madness', 'basketball_ncaab', '🏀', 'PRO', 'value_betting', 6000),
('Pixel Prophet', 'esports_lol', '🎮', 'VIP', 'sharp_money', 4000)
ON CONFLICT DO NOTHING;

-- ============================================
-- COACH STATS
-- ============================================

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
ON CONFLICT DO NOTHING;

-- ============================================
-- TOURNAMENTS
-- ============================================

INSERT INTO tournaments (name, type, entry_fee, prize_pool, max_players, current_players, status, format, tier, start_time, duration) VALUES
('Weekend Warriors', 'Multi-Sport', 50, 1000, 100, 42, 'registering', 'bracket', 'intermediate', NOW() + INTERVAL '2 days', '2 days'),
('NBA Finals Challenge', 'Basketball', 100, 5000, 256, 128, 'registering', 'bracket', 'expert', NOW() + INTERVAL '7 hours', '7 days'),
('NFL Sunday Special', 'Football', 75, 2500, 200, 89, 'registering', 'bracket', 'intermediate', NOW() + INTERVAL '1 day', '1 day'),
('Baseball Grand Slam', 'Baseball', 25, 500, 50, 18, 'registering', 'bracket', 'beginner', NOW() + INTERVAL '7 days', '1 week'),
('Soccer Parlay Masters', 'Soccer', 150, 10000, 500, 256, 'registering', 'bracket', 'expert', NOW() + INTERVAL '5 days', '1 month'),
('Ultimate Champion', 'All Sports', 250, 25000, 1000, 512, 'registering', 'bracket', 'legendary', NOW() + INTERVAL '30 days', '3 months')
ON CONFLICT DO NOTHING;

-- ============================================
-- ACHIEVEMENTS
-- ============================================

INSERT INTO achievements (id, name, description, icon, category, xp_reward, rarity, required_value, stat_type) VALUES
('first_pick', 'First Pick', 'Make your first sports pick', '🎯', 'picks', 100, 'common', 1, 'total_picks'),
('first_win', 'First Victory', 'Win your first pick', '🏆', 'picks', 200, 'common', 1, 'wins'),
('hot_streak', 'Hot Streak', 'Win 3 picks in a row', '🔥', 'streaks', 300, 'rare', 3, 'current_streak'),
('unstoppable', 'Unstoppable', 'Win 5 picks in a row', '⚡', 'streaks', 500, 'epic', 5, 'current_streak'),
('legendary_streak', 'Legendary Streak', 'Win 10 picks in a row', '👑', 'streaks', 1000, 'legendary', 10, 'current_streak'),
('casual_bettor', 'Casual Bettor', 'Make 10 picks', '📊', 'picks', 300, 'common', 10, 'total_picks'),
('serious_player', 'Serious Player', 'Make 50 picks', '💪', 'picks', 500, 'rare', 50, 'total_picks'),
('veteran', 'Veteran', 'Make 100 picks', '🎖️', 'picks', 1000, 'epic', 100, 'total_picks'),
('master', 'Master Bettor', 'Make 500 picks', '⭐', 'picks', 2500, 'legendary', 500, 'total_picks'),
('sharp_bettor', 'Sharp Bettor', 'Achieve 60% win rate', '🧠', 'performance', 500, 'rare', 60, 'win_rate'),
('expert', 'Expert Handicapper', 'Achieve 70% win rate', '🎓', 'performance', 1000, 'epic', 70, 'win_rate'),
('daily_grind', 'Daily Grind', 'Login 7 days in a row', '📅', 'engagement', 300, 'common', 7, 'login_streak'),
('dedicated', 'Dedicated', 'Login 30 days in a row', '💯', 'engagement', 1000, 'rare', 30, 'login_streak'),
('coin_collector', 'Coin Collector', 'Earn 1000 coins', '💰', 'coins', 200, 'common', 1000, 'total_coins'),
('coin_master', 'Coin Master', 'Earn 10000 coins', '💸', 'coins', 500, 'rare', 10000, 'total_coins')
ON CONFLICT DO NOTHING;

-- ============================================
-- CHALLENGES
-- ============================================

INSERT INTO challenges (id, name, description, type, goal_value, coins_reward, xp_reward, start_date, end_date) VALUES
('daily_3picks', 'Daily Triple', 'Make 3 picks today', 'daily', 3, 50, 100, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day'),
('daily_parlay', 'Parlay Master', 'Win a 3-leg parlay', 'daily', 3, 100, 200, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day'),
('weekly_5wins', 'Win 5 This Week', 'Get 5 wins this week', 'weekly', 5, 250, 500, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days'),
('weekly_perfect', 'Perfect Week', 'Win all picks in a day', 'weekly', 7, 500, 1000, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- SHOP INVENTORY
-- ============================================

INSERT INTO shop_inventory (item_id, item_name, category, price, tier, description, icon, stock) VALUES
('coin-2x', '2x Coin Booster', 'boosters', 500, 'FREE', 'Double your coin earnings for 24 hours', '💰', -1),
('xp-2x', '2x XP Booster', 'boosters', 400, 'FREE', 'Double your XP gains for 24 hours', '📈', -1),
('mega-pack', 'Mega Booster Pack', 'boosters', 800, 'PRO', '2x Coins + 2x XP for 24 hours', '🎁', -1),
('luck-charm', 'Lucky Charm', 'boosters', 1200, 'VIP', '3x rewards for 12 hours', '🍀', -1),
('jordan-1', 'Air Jordan 1 Avatar', 'avatars', 1500, 'PRO', 'Classic sneaker style', '👟', -1),
('trophy-gold', 'Gold Trophy Avatar', 'avatars', 2000, 'PRO', 'Winner status', '🏆', -1),
('crown-royal', 'Royal Crown Avatar', 'avatars', 2500, 'VIP', 'King of predictions', '👑', -1),
('diamond-hands', 'Diamond Hands Avatar', 'avatars', 3000, 'VIP', 'Elite trader badge', '💎', -1),
('championship-ring', 'Championship Ring', 'exclusive', 25000, 'VIP', 'Ultimate bragging rights', '💍', -1),
('private-jet', 'Private Jet Status', 'exclusive', 50000, 'VIP', 'Luxury tier access', '✈️', -1)
ON CONFLICT DO NOTHING;

-- ============================================
-- DAILY DEAL STOCK
-- ============================================

INSERT INTO daily_deal_stock (deal_id, stock_remaining, max_stock, last_reset_date) VALUES
('coin-2x-deal', 50, 50, CURRENT_DATE),
('xp-2x-deal', 50, 50, CURRENT_DATE),
('mega-pack-deal', 30, 30, CURRENT_DATE),
('luck-charm-deal', 20, 20, CURRENT_DATE),
('jordan-1-deal', 15, 15, CURRENT_DATE),
('trophy-gold-deal', 15, 15, CURRENT_DATE),
('crown-royal-deal', 10, 10, CURRENT_DATE),
('diamond-hands-deal', 10, 10, CURRENT_DATE),
('championship-ring-deal', 5, 5, CURRENT_DATE),
('private-jet-deal', 3, 3, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- ============================================
-- BADGES
-- ============================================

INSERT INTO badges (name, description, icon, rarity) VALUES
('Rising Star', 'Earned your first 100 XP', '⭐', 'common'),
('Money Maker', 'Won your first 1000 coins', '💸', 'common'),
('Streak Champion', 'Won 10 picks in a row', '🔥', 'rare'),
('Elite Bettor', 'Achieved 75% win rate', '👑', 'epic'),
('VIP Member', 'Subscribed to VIP', '💎', 'legendary'),
('Coach Collector', 'Unlocked all 11 coaches', '🎓', 'epic'),
('Tournament Master', 'Won 5 tournaments', '🏆', 'epic'),
('Social Butterfly', 'Got 100 followers', '📱', 'rare'),
('Daily Grinder', 'Logged in 100 days', '📅', 'rare'),
('Referral King', 'Referred 10 friends', '👥', 'epic')
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS LOG
-- ============================================

SELECT 'Database seed complete!' AS status,
       (SELECT COUNT(*) FROM coaches) as coaches,
       (SELECT COUNT(*) FROM coach_stats) as coach_stats,
       (SELECT COUNT(*) FROM tournaments) as tournaments,
       (SELECT COUNT(*) FROM achievements) as achievements,
       (SELECT COUNT(*) FROM challenges) as challenges,
       (SELECT COUNT(*) FROM shop_inventory) as shop_items,
       (SELECT COUNT(*) FROM badges) as badges;
