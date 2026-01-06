// ============================================
// ACHIEVEMENT LEADERBOARDS - BACKEND API
// Real-time badge completion rankings
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// ========== GET OVERALL LEADERBOARD ==========
router.get('/overall', async (req, res) => {
    try {
        const { timeFilter = 'all-time', limit = 50, offset = 0 } = req.query;
        
        // Build time filter condition
        let timeCondition = '';
        if (timeFilter === 'today') {
            timeCondition = "AND DATE(a.unlocked_at) = CURRENT_DATE";
        } else if (timeFilter === 'week') {
            timeCondition = "AND a.unlocked_at >= NOW() - INTERVAL '7 days'";
        } else if (timeFilter === 'month') {
            timeCondition = "AND a.unlocked_at >= NOW() - INTERVAL '30 days'";
        }

        const query = `
            WITH user_achievements AS (
                SELECT 
                    u.id,
                    u.username,
                    COUNT(DISTINCT a.achievement_id) as badges_unlocked,
                    COALESCE(SUM(a.xp_earned), 0) as total_xp
                FROM users u
                LEFT JOIN user_achievements a ON u.id = a.user_id
                WHERE a.unlocked_at IS NOT NULL ${timeCondition}
                GROUP BY u.id, u.username
            ),
            total_badges AS (
                SELECT COUNT(*) as count FROM achievements
            )
            SELECT 
                ua.id,
                ua.username,
                ua.badges_unlocked,
                tb.count as total_badges,
                ua.total_xp,
                ROUND((ua.badges_unlocked::NUMERIC / NULLIF(tb.count, 0)) * 100, 1) as completion_rate,
                ROW_NUMBER() OVER (ORDER BY ua.badges_unlocked DESC, ua.total_xp DESC) as rank
            FROM user_achievements ua, total_badges tb
            WHERE ua.badges_unlocked > 0
            ORDER BY rank
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            leaderboard: result.rows,
            meta: {
                timeFilter,
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: result.rows.length
            }
        });
    } catch (error) {
        console.error('Error fetching overall leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard',
            message: error.message
        });
    }
});

// ========== GET CATEGORY LEADERBOARD ==========
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const query = `
            WITH category_achievements AS (
                SELECT 
                    u.id,
                    u.username,
                    COUNT(DISTINCT a.achievement_id) as category_badges,
                    COALESCE(SUM(a.xp_earned), 0) as category_score
                FROM users u
                LEFT JOIN user_achievements a ON u.id = a.user_id
                LEFT JOIN achievements ach ON a.achievement_id = ach.id
                WHERE ach.category = $1 AND a.unlocked_at IS NOT NULL
                GROUP BY u.id, u.username
            )
            SELECT 
                id,
                username,
                category_badges,
                category_score,
                ROW_NUMBER() OVER (ORDER BY category_badges DESC, category_score DESC) as rank
            FROM category_achievements
            WHERE category_badges > 0
            ORDER BY rank
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [category, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            category,
            leaderboard: result.rows,
            meta: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: result.rows.length
            }
        });
    } catch (error) {
        console.error('Error fetching category leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch category leaderboard',
            message: error.message
        });
    }
});

// ========== GET RECENT UNLOCKS FEED ==========
router.get('/recent', async (req, res) => {
    try {
        const { limit = 30 } = req.query;

        const query = `
            SELECT 
                u.username,
                a.achievement_id,
                ach.name as achievement_name,
                ach.icon,
                ach.xp,
                a.unlocked_at as timestamp
            FROM user_achievements a
            JOIN users u ON a.user_id = u.id
            JOIN achievements ach ON a.achievement_id = ach.id
            WHERE a.unlocked_at IS NOT NULL
            ORDER BY a.unlocked_at DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [parseInt(limit)]);

        res.json({
            success: true,
            recentUnlocks: result.rows
        });
    } catch (error) {
        console.error('Error fetching recent unlocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent unlocks',
            message: error.message
        });
    }
});

// ========== GET RARE ACHIEVEMENTS ==========
router.get('/rare', async (req, res) => {
    try {
        const query = `
            WITH achievement_stats AS (
                SELECT 
                    a.id,
                    a.name,
                    a.description,
                    a.icon,
                    a.xp,
                    COUNT(ua.user_id) as unlock_count,
                    (SELECT COUNT(*) FROM users) as total_users
                FROM achievements a
                LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.unlocked_at IS NOT NULL
                WHERE a.rarity = 'legendary' OR a.xp >= 5000
                GROUP BY a.id, a.name, a.description, a.icon, a.xp
            )
            SELECT 
                id,
                name,
                description,
                icon,
                xp,
                unlock_count,
                ROUND((unlock_count::NUMERIC / NULLIF(total_users, 0)) * 100, 2) as rarity_percentage
            FROM achievement_stats
            ORDER BY rarity_percentage ASC, xp DESC
            LIMIT 20
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            rareAchievements: result.rows
        });
    } catch (error) {
        console.error('Error fetching rare achievements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rare achievements',
            message: error.message
        });
    }
});

// ========== GET USER RANK ==========
router.get('/user-rank/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const query = `
            WITH user_rankings AS (
                SELECT 
                    u.id,
                    u.username,
                    COUNT(DISTINCT a.achievement_id) as badges_unlocked,
                    COALESCE(SUM(a.xp_earned), 0) as total_xp,
                    ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT a.achievement_id) DESC, COALESCE(SUM(a.xp_earned), 0) DESC) as rank
                FROM users u
                LEFT JOIN user_achievements a ON u.id = a.user_id
                WHERE a.unlocked_at IS NOT NULL
                GROUP BY u.id, u.username
            )
            SELECT rank, badges_unlocked, total_xp
            FROM user_rankings
            WHERE id = $1
        `;

        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                rank: null,
                message: 'User not found in rankings'
            });
        }

        res.json({
            success: true,
            ...result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching user rank:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user rank',
            message: error.message
        });
    }
});

// ========== GET LEADERBOARD STATS ==========
router.get('/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT u.id) as total_players,
                COUNT(DISTINCT a.achievement_id) as total_badges_defined,
                COUNT(DISTINCT ua.achievement_id) as total_badges_unlocked,
                AVG(user_badges.badge_count)::INT as avg_badges_per_user
            FROM users u
            LEFT JOIN achievements a ON true
            LEFT JOIN user_achievements ua ON ua.unlocked_at IS NOT NULL
            LEFT JOIN (
                SELECT user_id, COUNT(DISTINCT achievement_id) as badge_count
                FROM user_achievements
                WHERE unlocked_at IS NOT NULL
                GROUP BY user_id
            ) user_badges ON true
        `;

        const result = await pool.query(statsQuery);

        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching leaderboard stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats',
            message: error.message
        });
    }
});

// ========== BROADCAST ACHIEVEMENT UNLOCK (Called when achievement is unlocked) ==========
router.post('/broadcast-unlock', async (req, res) => {
    try {
        const { userId, achievementId } = req.body;

        // Get achievement and user details
        const query = `
            SELECT 
                u.username,
                a.name as achievement_name,
                a.icon,
                a.xp
            FROM users u
            JOIN achievements a ON a.id = $2
            WHERE u.id = $1
        `;

        const result = await pool.query(query, [userId, achievementId]);

        if (result.rows.length > 0) {
            const unlockData = {
                ...result.rows[0],
                timestamp: Date.now()
            };

            // Broadcast via WebSocket if available
            if (req.app.get('io')) {
                req.app.get('io').emit('achievement:unlock', unlockData);
            }

            res.json({
                success: true,
                message: 'Achievement unlock broadcasted',
                data: unlockData
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'User or achievement not found'
            });
        }
    } catch (error) {
        console.error('Error broadcasting achievement unlock:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to broadcast unlock',
            message: error.message
        });
    }
});

module.exports = router;
