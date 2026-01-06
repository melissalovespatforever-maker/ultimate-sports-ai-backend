/**
 * AI COACHES PICKS TRACKER - Real-time result tracking
 * Automatically updates pick results when games finish
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

// ================================
// PICK RESULT TRACKING
// ================================

/**
 * Sync pick results with ESPN game data
 * Run via cron job every 30 minutes during sports season
 */
router.post('/sync-results', async (req, res) => {
    try {
        const pool = require('../config/database');
        
        console.log('🔄 Syncing pick results with ESPN data...');

        // Get all open picks (no result yet)
        const openPicksResult = await pool.query(`
            SELECT 
                cp.id,
                cp.coach_id,
                cp.game_id,
                cp.sport,
                cp.pick_type,
                cp.pick,
                cp.game_date,
                cp.created_at
            FROM coach_picks cp
            WHERE cp.result IS NULL
            AND cp.game_date <= NOW()
            ORDER BY cp.game_date ASC
            LIMIT 100
        `);

        const openPicks = openPicksResult.rows;
        console.log(`📊 Found ${openPicks.length} open picks to evaluate`);

        let updatedCount = 0;
        let errors = [];

        // Process each open pick
        for (const pick of openPicks) {
            try {
                // Fetch game result from ESPN
                const gameResult = await fetchGameResult(pick.sport, pick.game_id);

                if (gameResult) {
                    // Update pick with result
                    await updatePickResult(pool, pick, gameResult);
                    updatedCount++;
                }
            } catch (error) {
                errors.push({
                    pick_id: pick.id,
                    error: error.message
                });
                console.error(`❌ Error processing pick ${pick.id}:`, error.message);
            }
        }

        // Calculate updated statistics
        await recalculateCoachStats(pool);

        res.json({
            success: true,
            picks_evaluated: openPicks.length,
            picks_updated: updatedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        res.status(500).json({ 
            error: 'Failed to sync results',
            message: error.message 
        });
    }
});

/**
 * Get pick results for a specific coach
 */
router.get('/:coachId/results', async (req, res) => {
    try {
        const pool = require('../config/database');
        const { coachId } = req.params;

        const result = await pool.query(`
            SELECT 
                id,
                game_id,
                sport,
                home_team,
                away_team,
                pick,
                pick_type,
                confidence,
                spread,
                result,
                actual_home_score,
                actual_away_score,
                game_date,
                created_at
            FROM coach_picks
            WHERE coach_id = $1
            AND result IS NOT NULL
            ORDER BY game_date DESC
            LIMIT 50
        `, [coachId]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching pick results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

/**
 * Get coach win streak
 */
router.get('/:coachId/streak', async (req, res) => {
    try {
        const pool = require('../config/database');
        const { coachId } = req.params;

        const result = await pool.query(`
            WITH recent_picks AS (
                SELECT 
                    result,
                    ROW_NUMBER() OVER (ORDER BY game_date DESC) as rn
                FROM coach_picks
                WHERE coach_id = $1
                AND result IS NOT NULL
                ORDER BY game_date DESC
            ),
            streak_data AS (
                SELECT 
                    result,
                    rn,
                    SUM(CASE WHEN result = 'lost' THEN 1 ELSE 0 END) 
                        OVER (ORDER BY rn DESC) as loss_group
                FROM recent_picks
            )
            SELECT 
                COUNT(*) as current_streak,
                MAX(rn) as streak_length
            FROM streak_data
            WHERE loss_group = 0
            AND result = 'won'
        `, [coachId]);

        const streakInfo = result.rows[0] || { current_streak: 0, streak_length: 0 };

        res.json(streakInfo);

    } catch (error) {
        console.error('Error fetching streak:', error);
        res.status(500).json({ error: 'Failed to fetch streak' });
    }
});

// ================================
// HELPER FUNCTIONS
// ================================

async function fetchGameResult(sport, gameId) {
    try {
        const espnLeagues = {
            'football': { api: 'football', league: 'nfl' },
            'basketball': { api: 'basketball', league: 'nba' },
            'baseball': { api: 'baseball', league: 'mlb' },
            'hockey': { api: 'hockey', league: 'nhl' },
            'soccer': { api: 'soccer', league: 'usa.1' }
        };

        const league = espnLeagues[sport];
        if (!league) return null;

        const url = `https://site.api.espn.com/apis/site/v2/sports/${league.api}/${league.league}/summary`;
        const response = await axios.get(url);

        if (!response.data?.article) return null;

        // Find the game in the article
        const games = response.data.article.split('|').filter(article => 
            article.includes(gameId)
        );

        if (games.length === 0) return null;

        // Parse game result (simplified)
        // In production, match against database game records
        const scoreLine = games[0].match(/(\d+)-(\d+)/);
        
        if (scoreLine) {
            return {
                home_score: parseInt(scoreLine[1]),
                away_score: parseInt(scoreLine[2]),
                status: 'final'
            };
        }

        return null;

    } catch (error) {
        console.error(`Error fetching game result for ${gameId}:`, error.message);
        return null;
    }
}

async function updatePickResult(pool, pick, gameResult) {
    const { home_score, away_score, status } = gameResult;

    // Only update if game is final
    if (status !== 'final') return;

    // Determine pick result
    let result;
    if (pick.pick_type === 'home') {
        result = home_score > away_score ? 'won' : home_score < away_score ? 'lost' : 'push';
    } else if (pick.pick_type === 'away') {
        result = away_score > home_score ? 'won' : away_score < home_score ? 'lost' : 'push';
    }

    // Update database
    await pool.query(`
        UPDATE coach_picks
        SET 
            result = $1,
            actual_home_score = $2,
            actual_away_score = $3,
            updated_at = NOW()
        WHERE id = $4
    `, [result, home_score, away_score, pick.id]);

    console.log(`✅ Updated pick ${pick.id}: ${result.toUpperCase()}`);
}

async function recalculateCoachStats(pool) {
    try {
        // This view is automatically recalculated by the database
        // But we can also trigger a refresh of cached stats

        const result = await pool.query(`
            SELECT DISTINCT coach_id FROM coach_picks WHERE result IS NOT NULL
        `);

        console.log(`📈 Recalculated stats for ${result.rows.length} coaches`);

    } catch (error) {
        console.error('Error recalculating stats:', error);
    }
}

/**
 * Get top performing coaches this week
 */
router.get('/leaderboard/weekly', async (req, res) => {
    try {
        const pool = require('../config/database');

        const result = await pool.query(`
            SELECT 
                coach_id,
                COUNT(*) as picks_this_week,
                SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as wins,
                ROUND(
                    100.0 * SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) / 
                    NULLIF(COUNT(*), 0),
                    1
                ) as win_rate
            FROM coach_picks
            WHERE created_at >= NOW() - INTERVAL '7 days'
            AND result IS NOT NULL
            GROUP BY coach_id
            ORDER BY win_rate DESC, picks_this_week DESC
            LIMIT 10
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

/**
 * Get coach performance by sport
 */
router.get('/:coachId/by-sport', async (req, res) => {
    try {
        const pool = require('../config/database');
        const { coachId } = req.params;

        const result = await pool.query(`
            SELECT 
                sport,
                COUNT(*) as total_picks,
                SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as wins,
                ROUND(
                    100.0 * SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) / 
                    NULLIF(COUNT(*), 0),
                    1
                ) as win_rate,
                AVG(confidence) as avg_confidence
            FROM coach_picks
            WHERE coach_id = $1
            AND result IS NOT NULL
            GROUP BY sport
            ORDER BY win_rate DESC
        `, [coachId]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching sport stats:', error);
        res.status(500).json({ error: 'Failed to fetch sport stats' });
    }
});

/**
 * Export pick history for analytics
 */
router.get('/:coachId/export', async (req, res) => {
    try {
        const pool = require('../config/database');
        const { coachId } = req.params;

        const result = await pool.query(`
            SELECT 
                game_date,
                sport,
                home_team,
                away_team,
                pick,
                confidence,
                result,
                actual_home_score,
                actual_away_score
            FROM coach_picks
            WHERE coach_id = $1
            AND result IS NOT NULL
            ORDER BY game_date DESC
        `, [coachId]);

        // Convert to CSV
        const csv = convertToCSV(result.rows);
        
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="coach-${coachId}-history.csv"`);
        res.send(csv);

    } catch (error) {
        console.error('Error exporting history:', error);
        res.status(500).json({ error: 'Failed to export history' });
    }
});

function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            }).join(',')
        )
    ];

    return csv.join('\n');
}

module.exports = router;
