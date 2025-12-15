// ============================================
// ADMIN ROUTES - Coach Picks Management
// Protected endpoints for admin dashboard
// ============================================

const express = require('express');
const router = express.Router();

// Mock auth middleware (replace with real JWT validation)
const adminAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    // In production, validate JWT token
    if (!token && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Apply auth to all admin routes
router.use(adminAuth);

/**
 * POST /api/admin/picks
 * Create a new pick for a coach
 */
router.post('/picks', async (req, res) => {
    try {
        const {
            coach_id,
            sport,
            home_team,
            away_team,
            pick_team,
            pick_type,
            odds,
            confidence,
            game_time,
            reasoning
        } = req.body;

        // Validate required fields
        if (!coach_id || !sport || !home_team || !away_team || !pick_team) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        // Generate game_id
        const game_id = `${sport}_${Date.now()}`;

        // In production, insert into database
        const query = `
            INSERT INTO coach_picks (
                coach_id, game_id, sport, home_team, away_team, 
                pick_team, pick_type, odds, confidence, reasoning, 
                game_time, result
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
            RETURNING *;
        `;

        // For now, return mock response
        res.json({
            success: true,
            message: 'Pick created successfully',
            pick: {
                id: Math.floor(Math.random() * 10000),
                coach_id,
                game_id,
                sport,
                home_team,
                away_team,
                pick_team,
                pick_type,
                odds,
                confidence,
                game_time,
                reasoning,
                result: 'pending',
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error creating pick:', error);
        res.status(500).json({
            error: 'Failed to create pick',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/picks
 * Get all picks (with optional filtering)
 */
router.get('/picks', async (req, res) => {
    try {
        const { coach_id, status, sport } = req.query;

        // Build query dynamically
        let query = 'SELECT * FROM coach_picks WHERE 1=1';
        const params = [];

        if (coach_id) {
            params.push(coach_id);
            query += ` AND coach_id = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND result = $${params.length}`;
        }

        if (sport) {
            params.push(sport);
            query += ` AND sport = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        // In production, execute query
        res.json({
            success: true,
            picks: []
        });
    } catch (error) {
        console.error('❌ Error fetching picks:', error);
        res.status(500).json({
            error: 'Failed to fetch picks'
        });
    }
});

/**
 * PUT /api/admin/picks/:id/result
 * Record the result of a pick (win/loss/push)
 */
router.put('/picks/:id/result', async (req, res) => {
    try {
        const pickId = req.params.id;
        const { result } = req.body;

        // Validate result
        const validResults = ['win', 'loss', 'push', 'pending'];
        if (!validResults.includes(result)) {
            return res.status(400).json({
                error: 'Invalid result. Must be: win, loss, push, or pending'
            });
        }

        // Update pick result in database
        const query = `
            UPDATE coach_picks 
            SET result = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *;
        `;

        // In production, execute query and update coach_stats via trigger

        res.json({
            success: true,
            message: 'Pick result recorded',
            result: {
                id: pickId,
                result,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error recording result:', error);
        res.status(500).json({
            error: 'Failed to record result'
        });
    }
});

/**
 * DELETE /api/admin/picks/:id
 * Delete a pick (only if pending)
 */
router.delete('/picks/:id', async (req, res) => {
    try {
        const pickId = req.params.id;

        // In production, check if pick is pending before deleting
        const query = `
            DELETE FROM coach_picks 
            WHERE id = $1 AND result = 'pending'
            RETURNING *;
        `;

        res.json({
            success: true,
            message: 'Pick deleted'
        });
    } catch (error) {
        console.error('❌ Error deleting pick:', error);
        res.status(500).json({
            error: 'Failed to delete pick'
        });
    }
});

/**
 * GET /api/admin/stats/coaches
 * Get detailed stats for all coaches
 */
router.get('/stats/coaches', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id,
                c.name,
                c.specialty,
                c.avatar,
                c.tier,
                cs.total_picks,
                cs.wins,
                cs.losses,
                cs.pushes,
                cs.accuracy,
                cs.win_streak,
                cs.roi,
                cs.last_updated
            FROM coaches c
            LEFT JOIN coach_stats cs ON c.id = cs.coach_id
            ORDER BY cs.accuracy DESC;
        `;

        // In production, execute query
        res.json({
            success: true,
            stats: []
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics'
        });
    }
});

/**
 * GET /api/admin/stats/picks
 * Get pick statistics for a date range
 */
router.get('/stats/picks', async (req, res) => {
    try {
        const { startDate, endDate, sport } = req.query;

        // Build date range query
        let dateFilter = '';
        if (startDate && endDate) {
            dateFilter = `WHERE cp.created_at BETWEEN '${startDate}' AND '${endDate}'`;
        }

        const query = `
            SELECT 
                DATE(cp.created_at) as date,
                COUNT(*) as total_picks,
                SUM(CASE WHEN cp.result = 'win' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN cp.result = 'loss' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN cp.result = 'push' THEN 1 ELSE 0 END) as pushes,
                ROUND(100.0 * SUM(CASE WHEN cp.result = 'win' THEN 1 ELSE 0 END) / COUNT(*), 2) as daily_accuracy
            FROM coach_picks cp
            ${dateFilter}
            GROUP BY DATE(cp.created_at)
            ORDER BY DATE(cp.created_at) DESC;
        `;

        res.json({
            success: true,
            picks_stats: []
        });
    } catch (error) {
        console.error('❌ Error fetching pick stats:', error);
        res.status(500).json({
            error: 'Failed to fetch pick statistics'
        });
    }
});

/**
 * POST /api/admin/stats/reset
 * Reset stats for a specific coach (admin only)
 */
router.post('/stats/reset', async (req, res) => {
    try {
        const { coach_id } = req.body;

        // Verify admin has permission to reset
        // In production, check admin role/permissions

        const query = `
            UPDATE coach_stats 
            SET total_picks = 0, wins = 0, losses = 0, pushes = 0, 
                accuracy = 0, win_streak = 0, roi = 0
            WHERE coach_id = $1
            RETURNING *;
        `;

        res.json({
            success: true,
            message: 'Stats reset for coach'
        });
    } catch (error) {
        console.error('❌ Error resetting stats:', error);
        res.status(500).json({
            error: 'Failed to reset statistics'
        });
    }
});

/**
 * GET /api/admin/health
 * Health check for admin panel
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'admin-api'
    });
});

module.exports = router;
