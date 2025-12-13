// ============================================
// AUTHENTICATION ROUTES
// Register, login, refresh token, logout
// ============================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// Generate JWT tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
    
    return { accessToken, refreshToken };
};

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        // Validate input
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }
        
        const { username, email, password } = value;
        
        // Check if user exists
        const existing = await query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Username or email already exists'
            });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);
        
        // Create user
        const result = await query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, subscription_tier, level, xp, coins, created_at`,
            [username, email, passwordHash]
        );
        
        const user = result.rows[0];
        
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        
        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscription: user.subscription_tier,
                level: user.level,
                xp: user.xp,
                coins: user.coins
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        // Validate input
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }
        
        const { email, password } = value;
        
        // Get user (include 2FA status)
        const result = await query(
            `SELECT id, username, email, password_hash, subscription_tier, level, xp, coins,
                    wins, losses, win_rate, current_streak, best_streak, two_factor_enabled
             FROM users WHERE email = $1 AND is_active = true`,
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid email or password'
            });
        }
        
        const user = result.rows[0];
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid email or password'
            });
        }
        
        // Check if 2FA is enabled
        if (user.two_factor_enabled) {
            // Return partial response - require 2FA verification
            return res.json({
                message: '2FA required',
                requiresTwoFactor: true,
                userId: user.id,
                email: user.email
            });
        }
        
        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        
        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );
        
        // Remove password hash from response
        delete user.password_hash;
        
        res.json({
            message: 'Login successful',
            user,
            accessToken,
            refreshToken
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login-2fa - Complete login after 2FA verification
router.post('/login-2fa', async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'User ID required'
            });
        }

        // Get user data
        const result = await query(
            `SELECT id, username, email, subscription_tier, level, xp, coins,
                    wins, losses, win_rate, current_streak, best_streak
             FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);

        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        res.json({
            message: 'Login successful',
            user,
            accessToken,
            refreshToken
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Refresh token required'
            });
        }
        
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Check if token exists and is not revoked
        const tokenResult = await query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND revoked = false AND expires_at > NOW()',
            [refreshToken, decoded.userId]
        );
        
        if (tokenResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired refresh token'
            });
        }
        
        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
        
        // Revoke old refresh token and store new one
        await transaction(async (client) => {
            await client.query(
                'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
                [refreshToken]
            );
            
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await client.query(
                'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                [decoded.userId, newRefreshToken, expiresAt]
            );
        });
        
        res.json({
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired refresh token'
            });
        }
        next(error);
    }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            // Revoke refresh token
            await query(
                'UPDATE refresh_tokens SET revoked = true WHERE token = $1 AND user_id = $2',
                [refreshToken, req.user.id]
            );
        }
        
        res.json({ message: 'Logout successful' });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, username, email, avatar, subscription_tier, level, xp, coins,
                    wins, losses, win_rate, current_streak, best_streak, login_streak,
                    created_at, last_login
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }
        
        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
