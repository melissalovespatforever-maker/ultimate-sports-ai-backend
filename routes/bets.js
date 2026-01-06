// ============================================
// LIVE BET TRACKING ROUTES
// Bet creation, retrieval, grading, and history
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Ensure user is authenticated
 */
const verifyBetOwnership = async (req, res, next) => {
    try {
        const betId = req.params.betId;
        const userId = req.user.id;
        
        const result = await pool.query(
            'SELECT * FROM user_bets WHERE id = $1 AND user_id = $2',
            [betId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized: This bet does not belong to you'
            });
        }
        
        req.bet = result.rows[0];
        next();
    } catch (error) {
        console.error('Error verifying bet ownership:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// ============================================
// CREATE BET
// ============================================

/**
 * POST /api/bets
 * Create a new tracked bet
 * Body: { sport, match, pick, odds, stake, potentialWin, coach, confidence, reasoning, eventId }
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { sport, match, pick, odds, stake, potentialWin, coach, confidence, reasoning, eventId } = req.body;
        const userId = req.user.id;
        
        // Validate required fields
        if (!sport || !match || !pick || !odds || !stake) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Insert bet into database
        const result = await pool.query(
            `INSERT INTO user_bets 
             (user_id, sport, match, pick, odds, stake, potential_win, coach, confidence, reasoning, event_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW())
             RETURNING *`,
            [userId, sport, match, pick, odds, stake, potentialWin, coach, confidence, reasoning, eventId]
        );
        
        const bet = result.rows[0];
        console.log(`✅ Bet created: ${bet.id} for user ${userId}`);
        
        res.status(201).json({
            success: true,
            bet: bet,
            message: 'Bet created successfully'
        });
    } catch (error) {
        console.error('Error creating bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create bet',
            details: error.message
        });
    }
});

// ============================================
// GET BETS
// ============================================

/**
 * GET /api/bets
 * Get all bets for authenticated user
 * Query: ?status=pending|won|lost|all, ?sport=NBA|NFL|etc
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status = 'all', sport, limit = 100, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM user_bets WHERE user_id = $1';
        const params = [userId];
        
        // Filter by status
        if (status !== 'all') {
            query += ' AND status = $2';
            params.push(status);
        }
        
        // Filter by sport
        if (sport) {
            const paramIndex = params.length + 1;
            query += ` AND sport = $${paramIndex}`;
            params.push(sport.toUpperCase());
        }
        
        // Order by newest first and paginate
        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit);
        params.push(offset);
        
        const result = await pool.query(query, params);
        
        // Get statistics
        const statsResult = await pool.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
                COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost,
                SUM(CASE WHEN status = 'won' THEN CAST(potential_win as DECIMAL) - CAST(stake as DECIMAL) ELSE 0 END) as profit
             FROM user_bets 
             WHERE user_id = $1`,
            [userId]
        );
        
        const stats = statsResult.rows[0];
        
        res.json({
            success: true,
            bets: result.rows,
            stats: {
                total: parseInt(stats.total),
                pending: parseInt(stats.pending),
                won: parseInt(stats.won),
                lost: parseInt(stats.lost),
                profit: stats.profit ? parseFloat(stats.profit) : 0,
                winRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching bets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bets',
            details: error.message
        });
    }
});

/**
 * GET /api/bets/:betId
 * Get single bet details
 */
router.get('/:betId', requireAuth, verifyBetOwnership, async (req, res) => {
    try {
        res.json({
            success: true,
            bet: req.bet
        });
    } catch (error) {
        console.error('Error fetching bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bet'
        });
    }
});

// ============================================
// UPDATE BET STATUS (Manual override)
// ============================================

/**
 * PATCH /api/bets/:betId/status
 * Manually update bet status (for edge cases)
 * Body: { status: 'won' | 'lost' | 'void', reason? }
 */
router.patch('/:betId/status', requireAuth, verifyBetOwnership, async (req, res) => {
    try {
        const { status, reason } = req.body;
        const betId = req.params.betId;
        
        // Validate status
        if (!['won', 'lost', 'void', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be: won, lost, void, or pending'
            });
        }
        
        const result = await pool.query(
            `UPDATE user_bets 
             SET status = $1, manual_override = true, override_reason = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, reason || null, betId]
        );
        
        console.log(`✅ Bet ${betId} status updated to ${status}`);
        
        res.json({
            success: true,
            bet: result.rows[0],
            message: `Bet status updated to ${status}`
        });
    } catch (error) {
        console.error('Error updating bet status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update bet status'
        });
    }
});

// ============================================
// GRADE BET (Automatic grading)
// ============================================

/**
 * POST /api/bets/:betId/grade
 * Automatically grade a bet based on final score
 * Body: { finalTeam1Score, finalTeam2Score, winnerTeam? }
 */
router.post('/:betId/grade', requireAuth, verifyBetOwnership, async (req, res) => {
    try {
        const { finalTeam1Score, finalTeam2Score, winnerTeam } = req.body;
        const bet = req.bet;
        
        if (!finalTeam1Score || !finalTeam2Score) {
            return res.status(400).json({
                success: false,
                error: 'Missing final scores'
            });
        }
        
        // Grade the bet based on pick type
        let gradeResult = gradeBet(
            bet.pick,
            bet.match,
            finalTeam1Score,
            finalTeam2Score,
            bet.sport,
            winnerTeam
        );
        
        // Update bet with grade result
        const updateResult = await pool.query(
            `UPDATE user_bets 
             SET status = $1, final_score = $2, graded_at = NOW(), updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [gradeResult.status, JSON.stringify(gradeResult.scores), bet.id]
        );
        
        console.log(`✅ Bet ${bet.id} graded as ${gradeResult.status}`);
        
        res.json({
            success: true,
            bet: updateResult.rows[0],
            gradeResult: gradeResult,
            message: `Bet graded as ${gradeResult.status.toUpperCase()}`
        });
    } catch (error) {
        console.error('Error grading bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to grade bet',
            details: error.message
        });
    }
});

// ============================================
// DELETE BET
// ============================================

/**
 * DELETE /api/bets/:betId
 * Delete a pending bet
 */
router.delete('/:betId', requireAuth, verifyBetOwnership, async (req, res) => {
    try {
        const bet = req.bet;
        
        // Only allow deletion of pending bets
        if (bet.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Can only delete pending bets'
            });
        }
        
        await pool.query('DELETE FROM user_bets WHERE id = $1', [bet.id]);
        
        console.log(`🗑️ Bet ${bet.id} deleted`);
        
        res.json({
            success: true,
            message: 'Bet deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting bet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete bet'
        });
    }
});

// ============================================
// STATISTICS
// ============================================

/**
 * GET /api/bets/stats/summary
 * Get user's bet statistics summary
 */
router.get('/stats/summary', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            `SELECT 
                COUNT(*) as total_bets,
                COUNT(CASE WHEN status = 'won' THEN 1 END) as total_won,
                COUNT(CASE WHEN status = 'lost' THEN 1 END) as total_lost,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as total_pending,
                SUM(CASE WHEN status = 'won' THEN CAST(potential_win as DECIMAL) - CAST(stake as DECIMAL) ELSE 0 END) as profit,
                SUM(CASE WHEN status = 'lost' THEN -CAST(stake as DECIMAL) ELSE 0 END) as losses,
                AVG(CAST(confidence as INTEGER)) as avg_confidence
             FROM user_bets 
             WHERE user_id = $1`,
            [userId]
        );
        
        const data = result.rows[0];
        const totalBets = parseInt(data.total_bets);
        const totalWon = parseInt(data.total_won);
        
        res.json({
            success: true,
            stats: {
                totalBets,
                totalWon,
                totalLost: parseInt(data.total_lost),
                totalPending: parseInt(data.total_pending),
                profit: data.profit ? parseFloat(data.profit) : 0,
                losses: data.losses ? parseFloat(data.losses) : 0,
                winRate: totalBets > 0 ? Math.round((totalWon / totalBets) * 100) : 0,
                avgConfidence: data.avg_confidence ? Math.round(parseFloat(data.avg_confidence)) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// ============================================
// HELPER: GRADE BET
// ============================================

/**
 * Grade a bet based on final scores and pick type
 * Returns: { status: 'won'|'lost'|'void', scores: {...} }
 */
function gradeBet(pick, match, team1Score, team2Score, sport, winnerTeam) {
    const scores = {
        team1Score: team1Score,
        team2Score: team2Score,
        totalScore: team1Score + team2Score
    };
    
    // Parse team names from match
    const teams = match.split(' vs ').map(t => t.trim());
    const team1 = teams[0];
    const team2 = teams[1];
    
    // Moneyline picks (e.g., "Lakers", "Warriors ML")
    if (pick.includes('ML') || pick === team1 || pick === team2) {
        const pickedTeam = pick.replace(' ML', '').trim();
        const won = (team1Score > team2Score && pickedTeam === team1) || 
                   (team2Score > team1Score && pickedTeam === team2);
        return {
            status: won ? 'won' : 'lost',
            scores
        };
    }
    
    // Spread picks (e.g., "Lakers -3.5", "Warriors +5")
    const spreadMatch = pick.match(/([+-]?\d+\.?\d*)/);
    if (spreadMatch) {
        const spread = parseFloat(spreadMatch[1]);
        const pickedTeam = pick.split(' ')[0];
        
        const isTeam1 = pickedTeam === team1;
        const adjustedScore1 = team1Score + (isTeam1 ? -spread : spread);
        
        const won = adjustedScore1 > team2Score;
        return {
            status: won ? 'won' : 'lost',
            scores
        };
    }
    
    // Total picks (e.g., "Over 200", "Under 45.5")
    if (pick.includes('Over') || pick.includes('Under')) {
        const totalMatch = pick.match(/(\d+\.?\d*)/);
        if (totalMatch) {
            const targetTotal = parseFloat(totalMatch[1]);
            const actualTotal = team1Score + team2Score;
            
            const isOver = pick.includes('Over');
            const won = (isOver && actualTotal > targetTotal) || 
                       (!isOver && actualTotal < targetTotal);
            
            return {
                status: won ? 'won' : 'lost',
                scores
            };
        }
    }
    
    // Default: mark as void (couldn't parse)
    return {
        status: 'void',
        scores
    };
}

module.exports = router;
