// ============================================
// TWO-FACTOR AUTHENTICATION ROUTES
// Setup, verify, and manage 2FA
// ============================================

const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ============================================
// SETUP 2FA - Generate secret and QR code
// ============================================
router.post('/setup', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const username = req.user.username;
        const email = req.user.email;

        // Check if 2FA is already enabled
        const userCheck = await query(
            'SELECT two_factor_enabled FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows[0]?.two_factor_enabled) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '2FA is already enabled. Disable it first to set up again.'
            });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `Ultimate Sports AI (${email})`,
            issuer: 'Ultimate Sports AI',
            length: 32
        });

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        // Store temporary secret (not enabled yet - requires verification)
        await query(
            'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
            [secret.base32, userId]
        );

        // Log setup initiation
        await query(
            `INSERT INTO two_factor_logs (user_id, action, ip_address, user_agent)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'setup_initiated', req.ip, req.headers['user-agent']]
        );

        res.json({
            message: '2FA setup initiated',
            secret: secret.base32,
            qrCode: qrCodeUrl,
            manualEntryKey: secret.base32,
            otpauthUrl: secret.otpauth_url
        });

    } catch (error) {
        console.error('❌ 2FA Setup Error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to set up 2FA'
        });
    }
});

// ============================================
// VERIFY & ENABLE 2FA - Confirm setup
// ============================================
router.post('/verify-setup', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        if (!token || token.length !== 6) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Valid 6-digit code required'
            });
        }

        // Get user's secret
        const userResult = await query(
            'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
            [userId]
        );

        const user = userResult.rows[0];

        if (!user || !user.two_factor_secret) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '2FA setup not initiated. Call /setup first.'
            });
        }

        if (user.two_factor_enabled) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '2FA is already enabled'
            });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow 2 time steps (±60 seconds)
        });

        if (!verified) {
            await query(
                `INSERT INTO two_factor_logs (user_id, action, success, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, 'verify_setup', false, req.ip, req.headers['user-agent']]
            );

            return res.status(401).json({
                error: 'Invalid Code',
                message: 'Invalid verification code. Please try again.'
            });
        }

        // Generate backup codes
        const backupCodes = [];
        const hashedBackupCodes = [];
        
        for (let i = 0; i < 8; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
            hashedBackupCodes.push(await bcrypt.hash(code, 10));
        }

        // Enable 2FA
        await query(
            `UPDATE users 
             SET two_factor_enabled = true,
                 two_factor_backup_codes = $1
             WHERE id = $2`,
            [hashedBackupCodes, userId]
        );

        // Log successful setup
        await query(
            `INSERT INTO two_factor_logs (user_id, action, ip_address, user_agent)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'enabled', req.ip, req.headers['user-agent']]
        );

        res.json({
            message: '2FA enabled successfully',
            backupCodes: backupCodes,
            warning: 'Save these backup codes securely. They can only be used once.'
        });

    } catch (error) {
        console.error('❌ 2FA Verification Error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to verify 2FA'
        });
    }
});

// ============================================
// VALIDATE 2FA TOKEN - During login
// ============================================
router.post('/validate', async (req, res) => {
    try {
        const { userId, token, isBackupCode } = req.body;

        if (!userId || !token) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'User ID and token required'
            });
        }

        // Get user's 2FA data
        const userResult = await query(
            'SELECT two_factor_secret, two_factor_backup_codes, two_factor_enabled FROM users WHERE id = $1',
            [userId]
        );

        const user = userResult.rows[0];

        if (!user || !user.two_factor_enabled) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '2FA not enabled for this user'
            });
        }

        let verified = false;

        // Check if it's a backup code
        if (isBackupCode) {
            const backupCodes = user.two_factor_backup_codes || [];
            
            for (let i = 0; i < backupCodes.length; i++) {
                const matches = await bcrypt.compare(token, backupCodes[i]);
                if (matches) {
                    verified = true;
                    
                    // Remove used backup code
                    backupCodes.splice(i, 1);
                    await query(
                        'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
                        [backupCodes, userId]
                    );

                    await query(
                        `INSERT INTO two_factor_logs (user_id, action, ip_address, user_agent)
                         VALUES ($1, $2, $3, $4)`,
                        [userId, 'backup_used', req.ip, req.headers['user-agent']]
                    );

                    break;
                }
            }

            if (!verified) {
                await query(
                    `INSERT INTO two_factor_logs (user_id, action, success, ip_address, user_agent)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [userId, 'backup_failed', false, req.ip, req.headers['user-agent']]
                );
            }

        } else {
            // Verify TOTP token
            verified = speakeasy.totp.verify({
                secret: user.two_factor_secret,
                encoding: 'base32',
                token: token,
                window: 2
            });

            const action = verified ? 'verified' : 'failed';
            await query(
                `INSERT INTO two_factor_logs (user_id, action, success, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, action, verified, req.ip, req.headers['user-agent']]
            );
        }

        if (!verified) {
            return res.status(401).json({
                error: 'Invalid Code',
                message: 'Invalid authentication code'
            });
        }

        res.json({
            message: '2FA verified successfully',
            verified: true
        });

    } catch (error) {
        console.error('❌ 2FA Validation Error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to validate 2FA'
        });
    }
});

// ============================================
// DISABLE 2FA - Turn off 2FA
// ============================================
router.post('/disable', authenticateToken, async (req, res) => {
    try {
        const { password, token } = req.body;
        const userId = req.user.id;

        // Verify password
        const userResult = await query(
            'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
            [userId]
        );

        const user = userResult.rows[0];

        if (!user || !user.two_factor_enabled) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '2FA is not enabled'
            });
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid password'
            });
        }

        // Verify 2FA token
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(401).json({
                error: 'Invalid Code',
                message: 'Invalid 2FA code'
            });
        }

        // Disable 2FA
        await query(
            `UPDATE users 
             SET two_factor_enabled = false,
                 two_factor_secret = NULL,
                 two_factor_backup_codes = NULL
             WHERE id = $1`,
            [userId]
        );

        // Log disable
        await query(
            `INSERT INTO two_factor_logs (user_id, action, ip_address, user_agent)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'disabled', req.ip, req.headers['user-agent']]
        );

        res.json({
            message: '2FA disabled successfully'
        });

    } catch (error) {
        console.error('❌ 2FA Disable Error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to disable 2FA'
        });
    }
});

// ============================================
// GET 2FA STATUS
// ============================================
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(
            `SELECT 
                two_factor_enabled,
                array_length(two_factor_backup_codes, 1) as backup_codes_remaining
             FROM users 
             WHERE id = $1`,
            [userId]
        );

        const user = result.rows[0];

        res.json({
            enabled: user?.two_factor_enabled || false,
            backupCodesRemaining: user?.backup_codes_remaining || 0
        });

    } catch (error) {
        console.error('❌ 2FA Status Error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to get 2FA status'
        });
    }
});

// ============================================
// REGENERATE BACKUP CODES
// ============================================
router.post('/regenerate-backup-codes', authenticateToken, async (req, res) => {
    try {
        const { password, token } = req.body;
        const userId = req.user.id;

        // Verify password and 2FA
        const userResult = await query(
            'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
            [userId]
        );

        const user = userResult.rows[0];

        if (!user || !user.two_factor_enabled) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '2FA is not enabled'
            });
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid password'
            });
        }

        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(401).json({
                error: 'Invalid Code',
                message: 'Invalid 2FA code'
            });
        }

        // Generate new backup codes
        const backupCodes = [];
        const hashedBackupCodes = [];
        
        for (let i = 0; i < 8; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
            hashedBackupCodes.push(await bcrypt.hash(code, 10));
        }

        await query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [hashedBackupCodes, userId]
        );

        await query(
            `INSERT INTO two_factor_logs (user_id, action, ip_address, user_agent)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'backup_codes_regenerated', req.ip, req.headers['user-agent']]
        );

        res.json({
            message: 'Backup codes regenerated successfully',
            backupCodes: backupCodes,
            warning: 'Save these backup codes securely. Old codes are no longer valid.'
        });

    } catch (error) {
        console.error('❌ Backup Code Regeneration Error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to regenerate backup codes'
        });
    }
});

module.exports = router;