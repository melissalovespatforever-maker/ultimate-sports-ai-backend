// ============================================
// PASSWORD RESET ROUTES
// Secure password reset via email tokens
// ============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/database');
const emailService = require('../services/email-service');
const { authenticateToken } = require('../middleware/auth');

// Configuration
const RESET_TOKEN_EXPIRY = 3600000; // 1 hour in milliseconds
const RESET_ATTEMPT_LIMIT = 5; // Max reset requests per hour
const RATE_LIMIT_WINDOW = 3600000; // 1 hour

// ============================================
// REQUEST PASSWORD RESET
// ============================================

/**
 * POST /api/password-reset/request
 * Request a password reset email
 * Body: { email }
 */
router.post('/request', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                error: 'Valid email is required'
            });
        }

        // Find user by email
        const userResult = await pool.query(
            'SELECT id, username, email FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        // Always return success for security (don't reveal if email exists)
        if (userResult.rows.length === 0) {
            console.log(`ℹ️ Password reset requested for non-existent email: ${email}`);
            return res.json({
                success: true,
                message: 'If an account exists with that email, you will receive a password reset link.'
            });
        }

        const user = userResult.rows[0];

        // Check rate limiting
        const recentAttempts = await pool.query(
            `SELECT COUNT(*) as count FROM password_reset_tokens 
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
            [user.id]
        );

        if (recentAttempts.rows[0].count >= RESET_ATTEMPT_LIMIT) {
            console.warn(`⚠️ Rate limit exceeded for user ${user.id}`);
            return res.status(429).json({
                success: false,
                error: 'Too many reset requests. Please try again later.'
            });
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY);

        // Store reset token in database
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, resetTokenHash, expiresAt]
        );

        // Build reset link
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

        // Send email
        const emailResult = await emailService.sendPasswordResetEmail(user, resetToken, resetLink);

        if (!emailResult.success) {
            console.error('⚠️ Email sending failed, but token created in database');
            // Still return success to not reveal email service issues
        }

        console.log(`✅ Password reset email queued for ${user.email}`);

        res.json({
            success: true,
            message: 'If an account exists with that email, you will receive a password reset link.'
        });

    } catch (error) {
        console.error('❌ Error requesting password reset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process password reset request'
        });
    }
});

// ============================================
// VERIFY RESET TOKEN
// ============================================

/**
 * POST /api/password-reset/verify
 * Verify reset token is valid
 * Body: { token, email }
 */
router.post('/verify', async (req, res) => {
    try {
        const { token, email } = req.body;

        if (!token || !email) {
            return res.status(400).json({
                success: false,
                error: 'Token and email are required'
            });
        }

        // Hash the token
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find user and valid token
        const result = await pool.query(
            `SELECT prt.id, u.id as user_id FROM password_reset_tokens prt
             JOIN users u ON prt.user_id = u.id
             WHERE u.email = $1 AND prt.token_hash = $2 AND prt.expires_at > NOW()`,
            [email.toLowerCase(), tokenHash]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ Invalid or expired reset token for ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        console.log(`✅ Reset token verified for ${email}`);

        res.json({
            success: true,
            message: 'Token is valid',
            email: email
        });

    } catch (error) {
        console.error('❌ Error verifying reset token:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify token'
        });
    }
});

// ============================================
// RESET PASSWORD
// ============================================

/**
 * POST /api/password-reset/confirm
 * Reset password with valid token
 * Body: { token, email, newPassword }
 */
router.post('/confirm', async (req, res) => {
    try {
        const { token, email, newPassword } = req.body;

        // Validate inputs
        if (!token || !email || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Token, email, and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters'
            });
        }

        // Hash the token
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const result = await pool.query(
            `SELECT prt.id, u.id as user_id FROM password_reset_tokens prt
             JOIN users u ON prt.user_id = u.id
             WHERE u.email = $1 AND prt.token_hash = $2 AND prt.expires_at > NOW()`,
            [email.toLowerCase(), tokenHash]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ Invalid or expired reset token for ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        const { id: tokenId, user_id: userId } = result.rows[0];

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password in database
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, userId]
        );

        // Delete used token
        await pool.query(
            'DELETE FROM password_reset_tokens WHERE id = $1',
            [tokenId]
        );

        // Delete all other reset tokens for this user (one-time use)
        await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = $1',
            [userId]
        );

        console.log(`✅ Password successfully reset for user ${userId}`);

        res.json({
            success: true,
            message: 'Password has been reset successfully',
            redirectUrl: '/login'
        });

    } catch (error) {
        console.error('❌ Error resetting password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
});

// ============================================
// CHANGE PASSWORD (Authenticated)
// ============================================

/**
 * POST /api/password-reset/change
 * Change password for authenticated user
 * Body: { currentPassword, newPassword }
 * Auth: Required
 */
router.post('/change', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Validate inputs
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current and new passwords are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 8 characters'
            });
        }

        // Get user's current password hash
        const userResult = await pool.query(
            'SELECT id, password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!passwordMatch) {
            console.warn(`⚠️ Invalid current password for user ${userId}`);
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newPasswordHash, userId]
        );

        console.log(`✅ Password changed for user ${userId}`);

        res.json({
            success: true,
            message: 'Password has been changed successfully'
        });

    } catch (error) {
        console.error('❌ Error changing password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

module.exports = router;
