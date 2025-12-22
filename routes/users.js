// ============================================
// USER ROUTES
// Profile, stats, preferences
// ============================================

const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// GET /api/users/profile - REQUIRES AUTH
router.get('/profile', authenticateToken, async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const result = await query(
            `SELECT id, username, email, avatar, subscription_tier, level, xp, coins,
                    wins, losses, win_rate, current_streak, best_streak, login_streak,
                    longest_login_streak, created_at, last_login
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User profile not found'
            });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        next(error);
    }
});

// PUT /api/users/profile - REQUIRES AUTH
router.put('/profile', authenticateToken, async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const schema = Joi.object({
            username: Joi.string().alphanum().min(3).max(30),
            avatar: Joi.string().max(10)
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (value.username) {
            updates.push(`username = $${paramCount++}`);
            values.push(value.username);
        }
        if (value.avatar) {
            updates.push(`avatar = $${paramCount++}`);
            values.push(value.avatar);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'No updates provided'
            });
        }
        
        values.push(req.user.id);
        
        const result = await query(
            `UPDATE users SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING id, username, email, avatar`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        next(error);
    }
});

// GET /api/users/stats - REQUIRES AUTH
router.get('/stats', authenticateToken, async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const result = await query(
            `SELECT wins, losses, win_rate, current_streak, best_streak, total_picks,
                    level, xp, coins, login_streak, longest_login_streak
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User stats not found'
            });
        }

        res.json({ stats: result.rows[0] });
    } catch (error) {
        console.error('Error fetching stats:', error);
        next(error);
    }
});

// GET /api/users/leaderboard - PUBLIC
router.get('/leaderboard', async (req, res, next) => {
    try {
        const { period = 'all' } = req.query;
        
        // For now, all-time leaderboard
        // TODO: Add time-based filtering
        const result = await query(
            `SELECT id, username, avatar, subscription_tier, wins, losses, win_rate,
                    best_streak, level, xp
             FROM users
             WHERE is_active = true
             ORDER BY win_rate DESC, wins DESC
             LIMIT 100`
        );
        
        res.json({ leaderboard: result.rows });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        next(error);
    }
});

module.exports = router;
