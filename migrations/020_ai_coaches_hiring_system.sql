/**
 * AI COACHES HIRING SYSTEM - DATABASE SCHEMA
 * Complete schema for coach hiring, picks, and performance tracking
 */

-- ================================
-- COACH HIRES TABLE
-- ================================

CREATE TABLE IF NOT EXISTS coach_hires (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id VARCHAR(100) NOT NULL,
    hired_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    period_days INTEGER NOT NULL CHECK (period_days IN (3, 7, 14, 30)),
    cost INTEGER NOT NULL CHECK (cost >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, coach_id, expires_at)
);

CREATE INDEX idx_coach_hires_user ON coach_hires(user_id);
CREATE INDEX idx_coach_hires_coach ON coach_hires(coach_id);
CREATE INDEX idx_coach_hires_expires ON coach_hires(expires_at);
CREATE INDEX idx_coach_hires_active ON coach_hires(user_id, expires_at) WHERE expires_at > NOW();

-- ================================
-- COACH PICKS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS coach_picks (
    id SERIAL PRIMARY KEY,
    coach_id VARCHAR(100) NOT NULL,
    game_id VARCHAR(100) NOT NULL,
    sport VARCHAR(50) NOT NULL,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255) NOT NULL,
    game_date TIMESTAMP NOT NULL,
    pick VARCHAR(255) NOT NULL,
    pick_type VARCHAR(20) NOT NULL CHECK (pick_type IN ('home', 'away', 'over', 'under')),
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    spread DECIMAL(5,1),
    reasoning JSONB,
    ai_model VARCHAR(100),
    result VARCHAR(20) CHECK (result IN ('won', 'lost', 'push', null)),
    actual_home_score INTEGER,
    actual_away_score INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(coach_id, game_id)
);

CREATE INDEX idx_coach_picks_coach ON coach_picks(coach_id);
CREATE INDEX idx_coach_picks_game_date ON coach_picks(game_date);
CREATE INDEX idx_coach_picks_sport ON coach_picks(sport);
CREATE INDEX idx_coach_picks_result ON coach_picks(result);
CREATE INDEX idx_coach_picks_upcoming ON coach_picks(game_date) WHERE game_date > NOW();

-- ================================
-- COACH PERFORMANCE VIEW
-- ================================

CREATE OR REPLACE VIEW coach_performance AS
SELECT 
    coach_id,
    COUNT(*) as total_picks,
    SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as correct_picks,
    SUM(CASE WHEN result = 'lost' THEN 1 ELSE 0 END) as incorrect_picks,
    SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as push_picks,
    ROUND(
        100.0 * SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) / 
        NULLIF(SUM(CASE WHEN result IN ('won', 'lost') THEN 1 ELSE 0 END), 0),
        1
    ) as win_rate,
    (
        SELECT COUNT(*) 
        FROM (
            SELECT result,
                   ROW_NUMBER() OVER (ORDER BY game_date DESC) as rn,
                   SUM(CASE WHEN result != 'won' THEN 1 ELSE 0 END) 
                       OVER (ORDER BY game_date DESC) as loss_group
            FROM coach_picks p2
            WHERE p2.coach_id = p1.coach_id
            AND p2.result IS NOT NULL
            AND p2.game_date <= NOW()
        ) streaks
        WHERE loss_group = 0 AND result = 'won'
    ) as current_streak,
    MAX(created_at) as last_pick_date,
    AVG(confidence) as avg_confidence
FROM coach_picks p1
WHERE result IS NOT NULL
GROUP BY coach_id;

-- ================================
-- COACH STATISTICS VIEW
-- ================================

CREATE OR REPLACE VIEW coach_statistics AS
SELECT 
    cp.coach_id,
    cp.sport,
    COUNT(*) as picks_count,
    SUM(CASE WHEN cp.result = 'won' THEN 1 ELSE 0 END) as wins,
    ROUND(
        100.0 * SUM(CASE WHEN cp.result = 'won' THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(*), 0),
        1
    ) as sport_win_rate,
    AVG(cp.confidence) as avg_confidence
FROM coach_picks cp
WHERE cp.result IS NOT NULL
GROUP BY cp.coach_id, cp.sport;

-- ================================
-- TRIGGER: Update timestamps
-- ================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coach_hires_updated_at
    BEFORE UPDATE ON coach_hires
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coach_picks_updated_at
    BEFORE UPDATE ON coach_picks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- TRIGGER: Calculate pick results automatically
-- ================================

CREATE OR REPLACE FUNCTION calculate_pick_result()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_home_score IS NOT NULL AND NEW.actual_away_score IS NOT NULL THEN
        -- Determine winner
        IF NEW.pick_type = 'home' THEN
            IF NEW.actual_home_score > NEW.actual_away_score THEN
                NEW.result = 'won';
            ELSIF NEW.actual_home_score < NEW.actual_away_score THEN
                NEW.result = 'lost';
            ELSE
                NEW.result = 'push';
            END IF;
        ELSIF NEW.pick_type = 'away' THEN
            IF NEW.actual_away_score > NEW.actual_home_score THEN
                NEW.result = 'won';
            ELSIF NEW.actual_away_score < NEW.actual_home_score THEN
                NEW.result = 'lost';
            ELSE
                NEW.result = 'push';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_pick_result
    BEFORE INSERT OR UPDATE ON coach_picks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_pick_result();

-- ================================
-- SEED DATA: Initial coaches performance
-- ================================

-- Insert sample picks for testing (you can remove this in production)
INSERT INTO coach_picks (
    coach_id, game_id, sport, home_team, away_team, game_date,
    pick, pick_type, confidence, spread, reasoning, ai_model, result
) VALUES
    ('the-analyst', 'test-game-1', 'basketball', 'Lakers', 'Celtics', NOW() + INTERVAL '1 day',
     'Lakers', 'home', 78, 3.5, '["Strong home advantage", "Key player returning"]', 'advanced-statistics', null),
    ('the-analyst', 'test-game-2', 'basketball', 'Warriors', 'Nets', NOW() - INTERVAL '1 day',
     'Warriors', 'home', 82, 5.0, '["Dominant recent form", "Matchup advantage"]', 'advanced-statistics', 'won'),
    ('nfl-mastermind', 'test-game-3', 'football', 'Chiefs', 'Bills', NOW() + INTERVAL '2 days',
     'Chiefs', 'home', 85, 2.5, '["Home field advantage", "QB advantage"]', 'nfl-specialist', null),
    ('nba-guru', 'test-game-4', 'basketball', 'Heat', 'Bucks', NOW() - INTERVAL '2 days',
     'Heat', 'away', 75, -1.5, '["Hot streak", "Revenge game"]', 'nba-specialist', 'won'),
    ('sharp-shooter', 'test-game-5', 'football', 'Cowboys', 'Eagles', NOW() + INTERVAL '3 days',
     'Eagles', 'away', 88, -3.0, '["Sharp money movement", "Line value"]', 'sharp-betting', null)
ON CONFLICT (coach_id, game_id) DO NOTHING;

-- ================================
-- UTILITY FUNCTIONS
-- ================================

-- Function to check if user has access to coach
CREATE OR REPLACE FUNCTION user_has_coach_access(
    p_user_id INTEGER,
    p_coach_id VARCHAR(100)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM coach_hires
        WHERE user_id = p_user_id
        AND coach_id = p_coach_id
        AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get coach hire days remaining
CREATE OR REPLACE FUNCTION get_hire_days_remaining(
    p_user_id INTEGER,
    p_coach_id VARCHAR(100)
) RETURNS INTEGER AS $$
DECLARE
    days_left INTEGER;
BEGIN
    SELECT CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400)
    INTO days_left
    FROM coach_hires
    WHERE user_id = p_user_id
    AND coach_id = p_coach_id
    AND expires_at > NOW()
    ORDER BY expires_at DESC
    LIMIT 1;
    
    RETURN COALESCE(days_left, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired hires (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_hires()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM coach_hires
    WHERE expires_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- COMMENTS
-- ================================

COMMENT ON TABLE coach_hires IS 'Tracks which coaches users have hired and for how long';
COMMENT ON TABLE coach_picks IS 'Stores AI-generated picks from coaches with results';
COMMENT ON VIEW coach_performance IS 'Aggregated performance statistics for each coach';
COMMENT ON VIEW coach_statistics IS 'Sport-specific statistics for each coach';
COMMENT ON FUNCTION user_has_coach_access IS 'Check if user has active access to a coach';
COMMENT ON FUNCTION get_hire_days_remaining IS 'Get remaining days for coach hire';
COMMENT ON FUNCTION cleanup_expired_hires IS 'Remove old expired hire records';

-- ================================
-- GRANTS (adjust for your setup)
-- ================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON coach_hires TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON coach_picks TO your_app_user;
-- GRANT SELECT ON coach_performance TO your_app_user;
-- GRANT SELECT ON coach_statistics TO your_app_user;

-- ================================
-- COMPLETE
-- ================================

SELECT 'AI Coaches Hiring System Schema Created Successfully!' as status;
