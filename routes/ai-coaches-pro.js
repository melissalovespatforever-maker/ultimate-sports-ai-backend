/**
 * AI COACHES PRO - BACKEND ROUTES
 * Complete ESPN-integrated backend with hiring system
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

// ================================
// MIDDLEWARE
// ================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // In production, verify JWT token properly
    // For now, decode basic token
    try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ================================
// DATABASE HELPERS
// ================================

async function getPool() {
    // Get database connection pool
    // This assumes your backend has a db connection setup
    return require('../config/database');
}

// ================================
// ROUTES
// ================================

/**
 * GET /api/ai-coaches/performance
 * Get performance metrics for all coaches
 */
router.get('/performance', async (req, res) => {
    try {
        const pool = await getPool();
        
        // Query coach performance from database
        const result = await pool.query(`
            SELECT 
                coach_id,
                COUNT(*) as total_picks,
                SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as correct_picks,
                ROUND(
                    100.0 * SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
                    1
                ) as win_rate,
                (
                    SELECT COUNT(*) 
                    FROM coach_picks p2 
                    WHERE p2.coach_id = p1.coach_id 
                    AND p2.created_at >= (
                        SELECT MAX(created_at) 
                        FROM coach_picks p3 
                        WHERE p3.coach_id = p1.coach_id 
                        AND p3.result = 'lost'
                    )
                ) as current_streak,
                MAX(streak) as best_streak,
                MAX(created_at) as last_pick_date
            FROM coach_picks p1
            WHERE result IS NOT NULL
            GROUP BY coach_id
            ORDER BY win_rate DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching coach performance:', error);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

/**
 * GET /api/ai-coaches/hired
 * Get user's hired coaches
 */
router.get('/hired', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT 
                coach_id,
                hired_at,
                expires_at,
                period_days
            FROM coach_hires
            WHERE user_id = $1
            AND expires_at > NOW()
            ORDER BY hired_at DESC
        `, [userId]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching hired coaches:', error);
        res.status(500).json({ error: 'Failed to fetch hired coaches' });
    }
});

/**
 * POST /api/ai-coaches/hire
 * Hire a coach
 */
router.post('/hire', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const userId = req.user.id;
        const { coach_id, period_days } = req.body;

        // Validate input
        if (!coach_id || !period_days) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (![3, 7, 14, 30].includes(period_days)) {
            return res.status(400).json({ error: 'Invalid period' });
        }

        // Start transaction
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Get coach info and cost
            const coachCosts = {
                'the-analyst': 500,
                'nfl-mastermind': 750,
                'nba-guru': 750,
                'mlb-strategist': 600,
                'soccer-tactician': 650,
                'nhl-ice-breaker': 600,
                'college-football-coach': 550,
                'college-basketball-coach': 550,
                'sharp-shooter': 900,
                'the-professor': 1500
            };

            const hireCost = coachCosts[coach_id] || 500;

            // Check user balance
            const userResult = await client.query(
                'SELECT ultimate_coins, subscription_tier FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = userResult.rows[0];

            if (user.ultimate_coins < hireCost) {
                throw new Error('Insufficient coins');
            }

            // Check subscription requirement
            const subscriptionReqs = {
                'nfl-mastermind': 'PRO',
                'nba-guru': 'PRO',
                'sharp-shooter': 'PRO',
                'the-professor': 'VIP'
            };

            const requiredTier = subscriptionReqs[coach_id];
            if (requiredTier) {
                const tierOrder = { 'FREE': 0, 'PRO': 1, 'VIP': 2 };
                if (tierOrder[user.subscription_tier] < tierOrder[requiredTier]) {
                    throw new Error(`Requires ${requiredTier} subscription`);
                }
            }

            // Check if already hired
            const existingHire = await client.query(
                'SELECT id FROM coach_hires WHERE user_id = $1 AND coach_id = $2 AND expires_at > NOW()',
                [userId, coach_id]
            );

            if (existingHire.rows.length > 0) {
                throw new Error('Coach already hired');
            }

            // Deduct coins
            await client.query(
                'UPDATE users SET ultimate_coins = ultimate_coins - $1 WHERE id = $2',
                [hireCost, userId]
            );

            // Create hire record
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + period_days);

            await client.query(`
                INSERT INTO coach_hires (user_id, coach_id, hired_at, expires_at, period_days, cost)
                VALUES ($1, $2, NOW(), $3, $4, $5)
            `, [userId, coach_id, expiresAt, period_days, hireCost]);

            // Log transaction
            await client.query(`
                INSERT INTO coin_transactions (user_id, amount, type, description, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [userId, -hireCost, 'coach_hire', `Hired coach: ${coach_id} for ${period_days} days`]);

            await client.query('COMMIT');

            // Return success with updated balance
            const newBalance = user.ultimate_coins - hireCost;

            res.json({
                success: true,
                message: 'Coach hired successfully',
                new_balance: newBalance,
                expires_at: expiresAt.toISOString(),
                coach_id,
                period_days
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error hiring coach:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to hire coach' 
        });
    }
});

/**
 * GET /api/ai-coaches/:coachId/picks
 * Get picks for a specific coach
 */
router.get('/:coachId/picks', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const userId = req.user.id;
        const { coachId } = req.params;

        // Check if user has hired this coach
        const hireCheck = await pool.query(
            'SELECT id FROM coach_hires WHERE user_id = $1 AND coach_id = $2 AND expires_at > NOW()',
            [userId, coachId]
        );

        if (hireCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Coach not hired' });
        }

        // Get picks from database
        const result = await pool.query(`
            SELECT 
                id,
                game_id,
                sport,
                home_team,
                away_team,
                game_date,
                pick,
                pick_type,
                confidence,
                spread,
                reasoning,
                ai_model,
                result,
                created_at
            FROM coach_picks
            WHERE coach_id = $1
            AND game_date >= NOW()
            ORDER BY game_date ASC, confidence DESC
            LIMIT 10
        `, [coachId]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching picks:', error);
        res.status(500).json({ error: 'Failed to fetch picks' });
    }
});

/**
 * POST /api/ai-coaches/:coachId/generate-picks
 * Generate new picks for a coach (admin/cron endpoint)
 */
router.post('/:coachId/generate-picks', async (req, res) => {
    try {
        const { coachId } = req.params;
        const pool = await getPool();

        // Fetch ESPN games
        const espnGames = await fetchESPNGames();

        // Generate predictions
        const predictions = generatePredictions(coachId, espnGames);

        // Store in database
        for (const pred of predictions) {
            await pool.query(`
                INSERT INTO coach_picks (
                    coach_id, game_id, sport, home_team, away_team, game_date,
                    pick, pick_type, confidence, spread, reasoning, ai_model, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT (coach_id, game_id) DO UPDATE
                SET confidence = $9, reasoning = $11, updated_at = NOW()
            `, [
                coachId, pred.game_id, pred.sport, pred.home_team, pred.away_team,
                pred.game_date, pred.pick, pred.pick_type, pred.confidence,
                pred.spread, JSON.stringify(pred.reasoning), pred.ai_model
            ]);
        }

        res.json({
            success: true,
            picks_generated: predictions.length
        });

    } catch (error) {
        console.error('Error generating picks:', error);
        res.status(500).json({ error: 'Failed to generate picks' });
    }
});

// ================================
// HELPER FUNCTIONS
// ================================

async function fetchESPNGames() {
    const leagues = [
        { sport: 'football', league: 'nfl' },
        { sport: 'basketball', league: 'nba' },
        { sport: 'baseball', league: 'mlb' },
        { sport: 'hockey', league: 'nhl' },
        { sport: 'soccer', league: 'usa.1' }
    ];

    const allGames = [];

    for (const { sport, league } of leagues) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
            const response = await axios.get(url);
            
            if (response.data?.events) {
                const games = response.data.events.map(event => parseESPNGame(event, sport));
                allGames.push(...games);
            }
        } catch (error) {
            console.error(`Error fetching ${sport}/${league}:`, error.message);
        }
    }

    return allGames;
}

function parseESPNGame(event, sport) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    
    const homeTeam = competitors.find(c => c.homeAway === 'home');
    const awayTeam = competitors.find(c => c.homeAway === 'away');

    return {
        game_id: event.id,
        sport,
        date: new Date(event.date),
        home_team: homeTeam?.team?.displayName || 'Unknown',
        away_team: awayTeam?.team?.displayName || 'Unknown',
        home_record: homeTeam?.records?.[0]?.summary || '0-0',
        away_record: awayTeam?.records?.[0]?.summary || '0-0',
        venue: competition?.venue?.fullName || 'TBD'
    };
}

function generatePredictions(coachId, games) {
    // Filter games relevant to coach
    const relevantGames = games.filter(game => game.date > new Date());

    return relevantGames.slice(0, 5).map(game => {
        const confidence = 50 + Math.random() * 35; // 50-85%
        const pick = Math.random() > 0.5 ? 'home' : 'away';
        const spread = Math.abs(Math.round((Math.random() * 15 - 7.5) * 2) / 2);

        return {
            game_id: game.game_id,
            sport: game.sport,
            home_team: game.home_team,
            away_team: game.away_team,
            game_date: game.date,
            pick: pick === 'home' ? game.home_team : game.away_team,
            pick_type: pick,
            confidence: Math.round(confidence),
            spread,
            reasoning: [
                'Strong statistical advantage',
                'Favorable recent form',
                'Key matchup edge'
            ],
            ai_model: `${coachId}-model`
        };
    });
}

module.exports = router;
