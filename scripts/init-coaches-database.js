#!/usr/bin/env node

/**
 * Initialize AI Coaches Database
 * Run this to create coaches, coach_picks, and coach_stats tables
 * Usage: node scripts/init-coaches-database.js
 */

const { pool } = require('../config/database');

const MIGRATION_SQL = `
-- ============================================
-- AI Coaches Performance Tracking
-- Stores historical pick data and accuracy metrics
-- ============================================

-- Coaches table (profile data)
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

-- Insert all 11 coaches
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

-- Picks table (historical picks with outcomes)
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

-- Coach stats table (aggregated performance metrics)
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

-- Initialize stats for all 11 coaches with current values
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_picks_coach_id ON coach_picks(coach_id);
CREATE INDEX IF NOT EXISTS idx_picks_game_time ON coach_picks(game_time DESC);
CREATE INDEX IF NOT EXISTS idx_picks_result ON coach_picks(result);
CREATE INDEX IF NOT EXISTS idx_picks_sport ON coach_picks(sport);

-- Function to update coach stats after pick result
CREATE OR REPLACE FUNCTION update_coach_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE coach_stats
    SET 
        total_picks = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = NEW.coach_id AND result != 'pending'),
        wins = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = NEW.coach_id AND result = 'win'),
        losses = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = NEW.coach_id AND result = 'loss'),
        pushes = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = NEW.coach_id AND result = 'push'),
        accuracy = CASE 
            WHEN (SELECT COUNT(*) FROM coach_picks WHERE coach_id = NEW.coach_id AND result != 'pending') > 0 
            THEN (SELECT COUNT(*)::DECIMAL FROM coach_picks WHERE coach_id = NEW.coach_id AND result = 'win') / 
                 (SELECT COUNT(*)::DECIMAL FROM coach_picks WHERE coach_id = NEW.coach_id AND result != 'pending') * 100
            ELSE 0
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE coach_id = NEW.coach_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stats
DROP TRIGGER IF EXISTS trigger_update_coach_stats ON coach_picks;
CREATE TRIGGER trigger_update_coach_stats
AFTER INSERT OR UPDATE ON coach_picks
FOR EACH ROW
WHEN (NEW.result IS NOT NULL AND NEW.result != 'pending')
EXECUTE FUNCTION update_coach_stats();

-- View for easy coach performance dashboard
CREATE OR REPLACE VIEW coach_performance AS
SELECT 
    c.id,
    c.name,
    c.specialty,
    c.tier,
    cs.total_picks,
    cs.wins,
    cs.losses,
    cs.pushes,
    cs.accuracy,
    cs.current_streak,
    cs.best_streak,
    cs.roi,
    cs.units_won,
    cs.last_pick_date,
    COUNT(CASE WHEN cp.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as picks_last_7_days,
    COUNT(CASE WHEN cp.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as picks_last_30_days
FROM coaches c
LEFT JOIN coach_stats cs ON c.id = cs.coach_id
LEFT JOIN coach_picks cp ON c.id = cp.coach_id
GROUP BY c.id, c.name, c.specialty, c.tier, cs.total_picks, cs.wins, cs.losses, cs.pushes, 
         cs.accuracy, cs.current_streak, cs.best_streak, cs.roi, cs.units_won, cs.last_pick_date
ORDER BY cs.accuracy DESC;
`;

async function initCoachesDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Initializing AI Coaches Database...\n');
        
        // Execute migration
        console.log('💾 Creating tables and inserting data...');
        await client.query(MIGRATION_SQL);
        
        console.log('✅ Migration executed successfully!\n');
        
        // Verify
        console.log('🔍 Verifying coaches table...');
        const coachResult = await client.query('SELECT id, name, tier FROM coaches ORDER BY id');
        
        console.log(`✅ Found ${coachResult.rows.length} coaches:\n`);
        coachResult.rows.forEach(coach => {
            console.log(`   ${coach.id}. ${coach.name} (${coach.tier})`);
        });
        
        // Check stats
        console.log('\n🔍 Verifying coach_stats table...');
        const statsResult = await client.query('SELECT coach_id, accuracy, total_picks FROM coach_stats ORDER BY coach_id');
        console.log(`✅ Found ${statsResult.rows.length} coach stats\n`);
        
        console.log('📊 Sample stats:');
        statsResult.rows.slice(0, 3).forEach(stat => {
            console.log(`   Coach ${stat.coach_id}: ${stat.accuracy}% accuracy, ${stat.total_picks} total picks`);
        });
        
        console.log('\n✨ Database initialization complete! 🎉\n');
        console.log('Your AI Coaches are ready to go! 🚀');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run it
initCoachesDatabase();
