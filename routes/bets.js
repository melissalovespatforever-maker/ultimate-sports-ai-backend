// ============================================
// LIVE BET TRACKING ROUTES
// Real-time bet management with auto-grading
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// CREATE BET
// ============================================

/**
 * POST /api/bets
 * Create a new bet
 * Body: { game_id, sport, home_team, away_team, pick_team, pick_type, odds, confidence, reasoning, game_time, coach_id }
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { game_id, sport, home_team, away_team, pick_team, pick_type, odds, confidence, reasoning, game_time, coach_id } = req.body;
        const user_id = req.user.id;

        // Validate required fields
        if (!game_id || !sport || !pick_team || !pick_type || !odds) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: game_id, sport, pick_team, pick_type, odds'
            });
        }

        // Validate bet amount (1-1000 units)
        const betAmount = Math.abs(odds) / 100;
        if (betAmount < 1 || betAmount > 1000) {
            return res.status(400).json({
                success: false,
                error: 'Bet amount must be between 1 and 1000 units'
            });
        }

        // Insert bet into database
        const result = await pool.query(
            `INSERT INTO live_bets 
            (user_id, game_id, sport, home_team, away_team, pick_team, pick_type, odds, confidence, reasoning, game_time, coach_id, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW())
            RETURNING *`,
            [user_id, game_id, sport, home_team, away_team, pick_team, pick_type, odds, confidence, reasoning, game_time, coach_id || null]
        );

        const bet = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'Bet created successfully',
            data: {
                id: bet.id,
                game_id: bet.game_id,
                pick_team: bet.pick_team,
                odds: bet.odds,
                status: bet.status,
                created_at: bet.created_at
            }
        });

    } catch (error) {
        console.error('❌ Error creating bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create bet: ' + error.message
        });
    }
});

// ============================================
// GET BETS LIST WITH STATS
// ============================================

/**
 * GET /api/bets
 * Get user's bets with filtering and statistics
 * Query: { status, sport, limit=50, offset=0 }
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.id;
        const { status, sport, limit = 50, offset = 0 } = req.query;

        // Build WHERE clause
        let whereClause = 'WHERE user_id = $1';
        let params = [user_id];
        let paramIndex = 2;

        if (status) {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (sport) {
            whereClause += ` AND sport = $${paramIndex}`;
            params.push(sport);
            paramIndex++;
        }

        // Get bets
        const betsResult = await pool.query(
            `SELECT * FROM live_bets 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        // Get statistics
        const statsResult = await pool.query(
            `SELECT 
                COUNT(*) as total_bets,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN status = 'push' THEN 1 ELSE 0 END) as pushes,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                ROUND(
                    CASE 
                        WHEN COUNT(*) > 0 
                        THEN (SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::float / COUNT(*)) * 100
                        ELSE 0
                    END, 2
                ) as win_percentage,
                ROUND(
                    CASE
                        WHEN SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) > 0
                        THEN SUM(CASE WHEN status = 'won' THEN (odds / 100.0) ELSE 0 END) - SUM(CASE WHEN status != 'won' AND status != 'push' THEN (ABS(odds) / 100.0) ELSE 0 END)
                        ELSE -SUM(CASE WHEN status != 'won' AND status != 'push' THEN (ABS(odds) / 100.0) ELSE 0 END)
                    END, 2
                ) as total_profit
            FROM live_bets 
            WHERE user_id = $1`,
            [user_id]
        );

        const stats = statsResult.rows[0];

        res.json({
            success: true,
            data: {
                bets: betsResult.rows,
                stats: {
                    total_bets: parseInt(stats.total_bets),
                    wins: parseInt(stats.wins) || 0,
                    losses: parseInt(stats.losses) || 0,
                    pushes: parseInt(stats.pushes) || 0,
                    pending: parseInt(stats.pending) || 0,
                    win_percentage: parseFloat(stats.win_percentage) || 0,
                    total_profit: parseFloat(stats.total_profit) || 0
                },
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: parseInt(stats.total_bets)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching bets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bets: ' + error.message
        });
    }
});

// ============================================
// GET SINGLE BET
// ============================================

/**
 * GET /api/bets/:id
 * Get a specific bet
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const result = await pool.query(
            'SELECT * FROM live_bets WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bet not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error fetching bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bet: ' + error.message
        });
    }
});

// ============================================
// AUTO-GRADE BET
// ============================================

/**
 * POST /api/bets/:id/grade
 * Automatically grade a bet based on game result
 * Body: { home_score, away_score, game_status }
 */
router.post('/:id/grade', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { home_score, away_score, game_status } = req.body;
        const user_id = req.user.id;

        // Get the bet
        const betResult = await pool.query(
            'SELECT * FROM live_bets WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (betResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bet not found'
            });
        }

        const bet = betResult.rows[0];

        // Only grade if game is finished
        if (game_status !== 'finished' && game_status !== 'final') {
            return res.status(400).json({
                success: false,
                error: 'Game must be finished to grade bet'
            });
        }

        // Determine winner
        let result = 'push';
        
        if (bet.pick_type === 'moneyline') {
            if ((bet.pick_team === bet.home_team && home_score > away_score) ||
                (bet.pick_team === bet.away_team && away_score > home_score)) {
                result = 'won';
            } else if (home_score !== away_score) {
                result = 'lost';
            }
        } else if (bet.pick_type === 'spread') {
            const spread = Math.abs(bet.odds) / 100;
            if (bet.pick_team === bet.home_team) {
                if (home_score - away_score > spread) {
                    result = 'won';
                } else if (home_score - away_score < spread) {
                    result = 'lost';
                }
            } else {
                if (away_score - home_score > spread) {
                    result = 'won';
                } else if (away_score - home_score < spread) {
                    result = 'lost';
                }
            }
        } else if (bet.pick_type === 'total') {
            const total = Math.abs(bet.odds) / 100;
            if ((bet.pick_team === 'over' && home_score + away_score > total) ||
                (bet.pick_team === 'under' && home_score + away_score < total)) {
                result = 'won';
            } else if (home_score + away_score !== total) {
                result = 'lost';
            }
        }

        // Update bet status
        const updateResult = await pool.query(
            `UPDATE live_bets 
            SET status = $1, home_score = $2, away_score = $3, graded_at = NOW()
            WHERE id = $4
            RETURNING *`,
            [result, home_score, away_score, id]
        );

        const gradedBet = updateResult.rows[0];

        res.json({
            success: true,
            message: `Bet ${result.toUpperCase()}!`,
            data: {
                id: gradedBet.id,
                status: gradedBet.status,
                home_score: gradedBet.home_score,
                away_score: gradedBet.away_score,
                graded_at: gradedBet.graded_at
            }
        });

    } catch (error) {
        console.error('❌ Error grading bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to grade bet: ' + error.message
        });
    }
});

// ============================================
// UPDATE BET STATUS (MANUAL OVERRIDE)
// ============================================

/**
 * PATCH /api/bets/:id/status
 * Manually update bet status (admin/user override)
 * Body: { status }
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user_id = req.user.id;

        if (!['pending', 'won', 'lost', 'push', 'voided'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be: pending, won, lost, push, or voided'
            });
        }

        const result = await pool.query(
            'UPDATE live_bets SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [status, id, user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bet not found'
            });
        }

        res.json({
            success: true,
            message: `Bet status updated to ${status}`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error updating bet status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update bet status: ' + error.message
        });
    }
});

// ============================================
// DELETE BET
// ============================================

/**
 * DELETE /api/bets/:id
 * Delete a pending bet
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        // Check if bet exists and is pending
        const checkResult = await pool.query(
            'SELECT * FROM live_bets WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bet not found'
            });
        }

        const bet = checkResult.rows[0];

        if (bet.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Can only delete pending bets'
            });
        }

        // Delete bet
        await pool.query('DELETE FROM live_bets WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Bet deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete bet: ' + error.message
        });
    }
});

// ============================================
// GET BET STATISTICS
// ============================================

/**
 * GET /api/bets/stats/summary
 * Get comprehensive betting statistics for user
 */
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.id;

        const result = await pool.query(
            `SELECT 
                COUNT(*) as total_bets,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN status = 'push' THEN 1 ELSE 0 END) as pushes,
                ROUND(
                    CASE 
                        WHEN COUNT(*) > 0 
                        THEN (SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::float / COUNT(*)) * 100
                        ELSE 0
                    END, 2
                ) as win_percentage,
                ROUND(
                    CASE
                        WHEN SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) > 0
                        THEN SUM(CASE WHEN status = 'won' THEN (odds / 100.0) ELSE 0 END) - SUM(CASE WHEN status != 'won' AND status != 'push' THEN (ABS(odds) / 100.0) ELSE 0 END)
                        ELSE -SUM(CASE WHEN status != 'won' AND status != 'push' THEN (ABS(odds) / 100.0) ELSE 0 END)
                    END, 2
                ) as total_profit,
                MAX(created_at) as last_bet_date,
                COUNT(DISTINCT sport) as sports_covered
            FROM live_bets 
            WHERE user_id = $1 AND status != 'pending'`,
            [user_id]
        );

        const stats = result.rows[0];

        res.json({
            success: true,
            data: {
                total_bets: parseInt(stats.total_bets),
                wins: parseInt(stats.wins) || 0,
                losses: parseInt(stats.losses) || 0,
                pushes: parseInt(stats.pushes) || 0,
                win_percentage: parseFloat(stats.win_percentage) || 0,
                total_profit: parseFloat(stats.total_profit) || 0,
                last_bet_date: stats.last_bet_date,
                sports_covered: parseInt(stats.sports_covered) || 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics: ' + error.message
        });
    }
});

module.exports = router;
