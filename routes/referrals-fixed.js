// ============================================
// REFERRAL ROUTES
// Handle referral program and rewards
// ============================================

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const crypto = require('crypto');

// ============================================
// REFERRAL CODE GENERATION
// ============================================

function generateReferralCode(userId) {
    const hash = crypto.createHash('md5').update(userId.toString()).digest('hex');
    return hash.substring(0, 8).toUpperCase();
}

// ============================================
// GET USER'S REFERRAL CODE
// ============================================

router.get('/my-code', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if user already has a referral code
        let result = await pool.query(
            'SELECT referral_code FROM users WHERE id = $1',
            [userId]
        );

        let referralCode = result.rows[0]?.referral_code;

        // Generate code if doesn't exist
        if (!referralCode) {
            referralCode = generateReferralCode(userId);
            await pool.query(
                'UPDATE users SET referral_code = $1 WHERE id = $2',
                [referralCode, userId]
            );
        }

        res.json({
            success: true,
            code: referralCode
        });

    } catch (error) {
        console.error('Error getting referral code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get referral code'
        });
    }
});

// ============================================
// APPLY REFERRAL CODE
// ============================================

router.post('/apply-code', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Referral code required'
            });
        }

        // Find referrer by code
        const referrerResult = await pool.query(
            'SELECT id, username, referral_code FROM users WHERE referral_code = $1',
            [code.toUpperCase()]
        );

        if (referrerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Invalid referral code'
            });
        }

        const referrer = referrerResult.rows[0];

        res.json({
            success: true,
            message: 'Referral code applied successfully'
        });

    } catch (error) {
        console.error('Error applying referral code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to apply referral code'
        });
    }
});

// ============================================
// GET REFERRAL STATISTICS
// ============================================

router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        res.json({
            success: true,
            stats: {
                pending: 0,
                active: 0,
                completed: 0,
                total: 0
            }
        });

    } catch (error) {
        console.error('Error getting referral stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get referral statistics'
        });
    }
});

module.exports = router;
