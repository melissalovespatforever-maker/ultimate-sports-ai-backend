-- ============================================
-- LIVE BET TRACKING SYSTEM
-- Automatic win/loss grading with live monitoring
-- ============================================

-- Create user_bets table
CREATE TABLE IF NOT EXISTS user_bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport VARCHAR(50) NOT NULL, -- NBA, NFL, MLB, NHL, SOCCER
    match VARCHAR(255) NOT NULL, -- "Lakers vs Warriors"
    pick VARCHAR(255) NOT NULL, -- "Lakers -3.5", "Over 200", etc
    odds VARCHAR(50), -- "-110", "+150", etc
    stake VARCHAR(50) NOT NULL, -- "$50", "$100"
    potential_win VARCHAR(50), -- "$95.45"
    coach VARCHAR(100), -- AI coach name
    confidence VARCHAR(10), -- "87%"
    reasoning TEXT, -- AI coach's reasoning
    event_id VARCHAR(100), -- External event ID for linking
    status VARCHAR(50) DEFAULT 'pending', -- pending, won, lost, void
    final_score JSONB, -- { team1Score: 105, team2Score: 98, totalScore: 203 }
    manual_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    graded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_bets_user_id ON user_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bets_status ON user_bets(status);
CREATE INDEX IF NOT EXISTS idx_user_bets_sport ON user_bets(sport);
CREATE INDEX IF NOT EXISTS idx_user_bets_created_at ON user_bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bets_event_id ON user_bets(event_id);

-- Create bet_tracking table for monitoring
CREATE TABLE IF NOT EXISTS bet_tracking_log (
    id SERIAL PRIMARY KEY,
    bet_id INTEGER NOT NULL REFERENCES user_bets(id) ON DELETE CASCADE,
    action VARCHAR(100), -- 'created', 'checked', 'graded', 'manually_updated'
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bet_tracking_bet_id ON bet_tracking_log(bet_id);
CREATE INDEX IF NOT EXISTS idx_bet_tracking_created_at ON bet_tracking_log(created_at DESC);

-- Create bet_stats view for quick statistics
CREATE OR REPLACE VIEW user_bet_stats AS
SELECT 
    user_id,
    COUNT(*) as total_bets,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bets,
    COUNT(CASE WHEN status = 'won' THEN 1 END) as winning_bets,
    COUNT(CASE WHEN status = 'lost' THEN 1 END) as losing_bets,
    COUNT(CASE WHEN status = 'void' THEN 1 END) as void_bets,
    SUM(CASE WHEN status = 'won' THEN CAST(potential_win as DECIMAL) - CAST(stake as DECIMAL) ELSE 0 END) as total_profit,
    SUM(CASE WHEN status = 'won' THEN CAST(potential_win as DECIMAL) - CAST(stake as DECIMAL) ELSE 0 END) - 
    SUM(CASE WHEN status = 'lost' THEN CAST(stake as DECIMAL) ELSE 0 END) as net_profit,
    ROUND(100.0 * COUNT(CASE WHEN status = 'won' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as win_rate_percent,
    ROUND(AVG(CAST(SPLIT_PART(confidence, '%', 1) as DECIMAL)), 2) as avg_confidence
FROM user_bets
GROUP BY user_id;

GRANT SELECT ON user_bet_stats TO PUBLIC;

-- Create notifications for bet results
CREATE TABLE IF NOT EXISTS bet_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bet_id INTEGER NOT NULL REFERENCES user_bets(id) ON DELETE CASCADE,
    notification_type VARCHAR(50), -- 'bet_won', 'bet_lost', 'bet_graded'
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bet_notifications_user_id ON bet_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_notifications_is_read ON bet_notifications(is_read);
