// ============================================
// LEADERBOARD ROUTES
// Multiple leaderboard types and rankings
// ============================================

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// ============================================
// HELPER FUNCTIONS
// ============================================

async function updateLeaderboard(leaderboardType, period = 'all_time') {
    try {
        const periodStart = period === 'weekly' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;
        const periodEnd = new Date().toISOString().split('T')[0];

        let query_sql = '';
        let params = [];

        switch (leaderboardType) {
            case 'referrals':
                query_sql = `
                    SELECT 
                        r.referrer_id as user_id,
                        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'completed') as value
                    FROM referrals r
                    WHERE 1=1
                `;
                if (periodStart) {
                    query_sql += ` AND r.completed_at >= $1::date AND r.completed_at < $2::date + INTERVAL '1 day'`;
                    params = [periodStart, periodEnd];
                }
                query_sql += ` GROUP BY r.referrer_id ORDER BY value DESC`;
                break;

            case 'coins':
                query_sql = `
                    SELECT 
                        r.referrer_id as user_id,
                        SUM(r.coins_earned) as value
                    FROM referrals r
                    WHERE r.status = 'completed'
                `;
                if (periodStart) {
                    query_sql += ` AND r.completed_at >= $1::date AND r.completed_at < $2::date + INTERVAL '1 day'`;
                    params = [periodStart, periodEnd];
                }
                query_sql += ` GROUP BY r.referrer_id ORDER BY value DESC`;
                break;

            case 'wins':
                query_sql = `
                    SELECT 
                        u.id as user_id,
                        COUNT(*) FILTER (WHERE p.status = 'won') as value
                    FROM users u
                    LEFT JOIN picks p ON u.id = p.user_id
                    WHERE 1=1
                `;
                if (periodStart) {
                    query_sql += ` AND p.created_at >= $1::date AND p.created_at < $2::date + INTERVAL '1 day'`;
                    params = [periodStart, periodEnd];
                }
                query_sql += ` GROUP BY u.id ORDER BY value DESC`;
                break;

            case 'streak':
                query_sql = `
                    SELECT 
                        id as user_id,
                        best_streak as value
                    FROM users
                    ORDER BY best_streak DESC`;
                break;

            case 'weekly':
                query_sql = `
                    SELECT 
                        p.user_id,
                        COUNT(*) FILTER (WHERE p.status = 'won') as value
                    FROM picks p
                    WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'
                    GROUP BY p.user_id
                    ORDER BY value DESC`;
                break;

            default:
                return;
        }

        const result = await query(query_sql, params);

        // Insert into leaderboard_entries with ranks
        for (let i = 0; i < result.rows.length; i++) {
            const entry = result.rows[i];
            const rank = i + 1;

            const existingResult = await query(
                `SELECT id, rank as previous_rank FROM leaderboard_entries 
                 WHERE user_id = $1 AND leaderboard_type = $2 AND period_start = $3`,
                [entry.user_id, leaderboardType, periodStart || '2000-01-01']
            );

            const previousRank = existingResult.rows.length > 0 ? existingResult.rows[0].previous_rank : null;

            if (existingResult.rows.length > 0) {
                await query(
                    `UPDATE leaderboard_entries 
                     SET rank = $1, value = $2, previous_rank = $3, updated_at = NOW()
                     WHERE user_id = $4 AND leaderboard_type = $5 AND period_start = $6`,
                    [rank, entry.value, previousRank, entry.user_id, leaderboardType, periodStart || '2000-01-01']
                );
            } else {
                await query(
                    `INSERT INTO leaderboard_entries 
                     (user_id, leaderboard_type, rank, value, period_start, period_end)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [entry.user_id, leaderboardType, rank, entry.value, periodStart || '2000-01-01', periodEnd]
                );
            }
        }

    } catch (error) {
        console.error(`Error updating ${leaderboardType} leaderboard:`, error);
    }
}

// ============================================
// GET LEADERBOARD
// ============================================

router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { limit = 50, period = 'all_time', userId } = req.query;

        const validTypes = ['referrals', 'coins', 'wins', 'streak', 'weekly'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid leaderboard type'
            });
        }

        // Update leaderboard first
        await updateLeaderboard(type, period);

        // Get entries
        const periodStart = period === 'weekly' ? 
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
            '2000-01-01';

        const result = await query(
            `SELECT 
                le.rank,
                le.value,
                le.previous_rank,
                u.id,
                u.username,
                u.avatar,
                u.level,
                u.subscription_tier,
                COUNT(DISTINCT ub.badge_id) as badge_count
             FROM leaderboard_entries le
             JOIN users u ON le.user_id = u.id
             LEFT JOIN user_referral_badges ub ON u.id = ub.user_id
             WHERE le.leaderboard_type = $1 
                AND le.period_start = $2
             GROUP BY le.id, u.id
             ORDER BY le.rank ASC
             LIMIT $3`,
            [type, periodStart, limit]
        );

        // Get user's rank if requested
        let userRank = null;
        if (userId) {
            const userResult = await query(
                `SELECT le.rank, le.value 
                 FROM leaderboard_entries le
                 WHERE le.user_id = $1 
                    AND le.leaderboard_type = $2
                    AND le.period_start = $3`,
                [userId, type, periodStart]
            );
            userRank = userResult.rows[0] || null;
        }

        res.json({
            success: true,
            type: type,
            period: period,
            leaderboard: result.rows,
            userRank: userRank
        });

    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get leaderboard'
        });
    }
});

// ============================================
// GET USER RANK
// ============================================

router.get('/:type/user-rank/:userId', authenticateToken, async (req, res) => {
    try {
        const { type, userId } = req.params;

        const result = await query(
            `SELECT 
                le.rank,
                le.value,
                le.previous_rank,
                u.username,
                u.avatar
             FROM leaderboard_entries le
             JOIN users u ON le.user_id = u.id
             WHERE le.user_id = $1 AND le.leaderboard_type = $2
             ORDER BY le.updated_at DESC
             LIMIT 1`,
            [userId, type]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                rank: null,
                message: 'Not ranked'
            });
        }

        res.json({
            success: true,
            rank: result.rows[0]
        });

    } catch (error) {
        console.error('Error getting user rank:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user rank'
        });
    }
});

// ============================================
// GET NEARBY RANKS (For context around user)
// ============================================

router.get('/:type/nearby/:userId', authenticateToken, async (req, res) => {
    try {
        const { type, userId } = req.params;
        const { range = 2 } = req.query;

        // Get user's rank
        const userRankResult = await query(
            `SELECT rank FROM leaderboard_entries 
             WHERE user_id = $1 AND leaderboard_type = $2
             ORDER BY updated_at DESC LIMIT 1`,
            [userId, type]
        );

        if (userRankResult.rows.length === 0) {
            return res.json({
                success: true,
                nearby: [],
                userRank: null
            });
        }

        const userRank = userRankResult.rows[0].rank;
        const startRank = Math.max(1, userRank - range);
        const endRank = userRank + range;

        const result = await query(
            `SELECT 
                le.rank,
                le.value,
                u.id,
                u.username,
                u.avatar,
                u.level,
                CASE WHEN u.id = $3 THEN true ELSE false END as is_current_user
             FROM leaderboard_entries le
             JOIN users u ON le.user_id = u.id
             WHERE le.leaderboard_type = $1 
                AND le.rank >= $2 AND le.rank <= $4
             ORDER BY le.rank ASC`,
            [type, startRank, userId, endRank]
        );

        res.json({
            success: true,
            nearby: result.rows,
            userRank: userRank
        });

    } catch (error) {
        console.error('Error getting nearby ranks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get nearby ranks'
        });
    }
});

// ============================================
// COMPARE USERS
// ============================================

router.post('/compare', authenticateToken, async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'User IDs array required'
            });
        }

        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');

        const result = await query(
            `SELECT 
                u.id,
                u.username,
                u.avatar,
                u.level,
                (SELECT COUNT(*) FROM referrals WHERE referrer_id = u.id AND status = 'completed') as referral_count,
                (SELECT SUM(coins_earned) FROM referrals WHERE referrer_id = u.id AND status = 'completed') as coins_earned,
                (SELECT COUNT(*) FILTER (WHERE status = 'won') FROM picks WHERE user_id = u.id) as wins,
                u.best_streak,
                (SELECT COUNT(*) FROM user_referral_badges WHERE user_id = u.id) as badge_count
             FROM users u
             WHERE u.id IN (${placeholders})`,
            userIds
        );

        res.json({
            success: true,
            comparison: result.rows
        });

    } catch (error) {
        console.error('Error comparing users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to compare users'
        });
    }
});

// ============================================
// REFRESH LEADERBOARDS
// ============================================

router.post('/refresh/:type', async (req, res) => {
    try {
        const { type } = req.params;

        const validTypes = ['referrals', 'coins', 'wins', 'streak', 'weekly'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid leaderboard type'
            });
        }

        await updateLeaderboard(type, 'all_time');
        if (type !== 'streak') {
            await updateLeaderboard(type, 'weekly');
        }

        res.json({
            success: true,
            message: `${type} leaderboard refreshed`
        });

    } catch (error) {
        console.error('Error refreshing leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh leaderboard'
        });
    }
});

module.exports = router;
module.exports.updateLeaderboard = updateLeaderboard;
