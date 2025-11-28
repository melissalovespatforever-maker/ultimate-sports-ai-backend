// ============================================
// REFERRAL ROUTES
// Handle referral program and rewards
// ============================================

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const crypto = require('crypto');

// ============================================
// REFERRAL CODE GENERATION
// ============================================

function generateReferralCode(userId) {
    // Create unique, short, memorable code
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
        let result = await query(
            'SELECT referral_code FROM users WHERE id = $1',
            [userId]
        );

        let referralCode = result.rows[0]?.referral_code;

        // Generate code if doesn't exist
        if (!referralCode) {
            referralCode = generateReferralCode(userId);
            await query(
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
// GENERATE NEW REFERRAL CODE
// ============================================

router.post('/generate-code', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const newCode = generateReferralCode(userId + Date.now());

        await query(
            'UPDATE users SET referral_code = $1 WHERE id = $2',
            [newCode, userId]
        );

        res.json({
            success: true,
            code: newCode
        });

    } catch (error) {
        console.error('Error generating referral code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate referral code'
        });
    }
});

// ============================================
// APPLY REFERRAL CODE (When new user signs up)
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

        // Check if user already used a referral code
        const checkResult = await query(
            'SELECT referred_by FROM users WHERE id = $1',
            [userId]
        );

        if (checkResult.rows[0]?.referred_by) {
            return res.status(400).json({
                success: false,
                error: 'You have already used a referral code'
            });
        }

        // Find referrer by code
        const referrerResult = await query(
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

        // Can't refer yourself
        if (referrer.id === userId) {
            return res.status(400).json({
                success: false,
                error: 'You cannot use your own referral code'
            });
        }

        // Apply referral
        await query(
            'UPDATE users SET referred_by = $1, referred_at = NOW() WHERE id = $2',
            [referrer.id, userId]
        );

        // Create referral record
        await query(
            `INSERT INTO referrals (referrer_id, referee_id, code_used, status)
             VALUES ($1, $2, $3, 'pending')`,
            [referrer.id, userId, code]
        );

        // Award signup bonus to referee (new user)
        const signupCoins = 300;
        const signupXP = 100;

        await query(
            'UPDATE users SET coins = coins + $1, xp = xp + $2 WHERE id = $3',
            [signupCoins, signupXP, userId]
        );

        // Record transaction
        await query(
            `INSERT INTO coin_transactions (user_id, amount, type, description, metadata)
             VALUES ($1, $2, 'referral', 'Signup bonus from referral', $3)`,
            [userId, signupCoins, JSON.stringify({ type: 'signup_bonus', referrer: referrer.username })]
        );

        // Grant 7-day PRO trial
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);

        await query(
            `UPDATE users 
             SET subscription_tier = 'pro',
                 subscription_status = 'trialing',
                 subscription_trial_ends = $1
             WHERE id = $2 AND subscription_tier = 'free'`,
            [trialEnd, userId]
        );

        res.json({
            success: true,
            message: 'Referral code applied successfully',
            rewards: {
                coins: signupCoins,
                xp: signupXP,
                trial: {
                    tier: 'pro',
                    days: 7,
                    endsAt: trialEnd
                }
            }
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
// COMPLETE REFERRAL (When referee completes action)
// ============================================

router.post('/complete-referral', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { eventType } = req.body; // 'first_pick', 'subscription'

        // Get referral record
        const referralResult = await query(
            `SELECT r.*, u.username as referrer_username
             FROM referrals r
             JOIN users u ON u.id = r.referrer_id
             WHERE r.referee_id = $1 AND r.status = 'pending'`,
            [userId]
        );

        if (referralResult.rows.length === 0) {
            return res.json({ success: true, message: 'No pending referral' });
        }

        const referral = referralResult.rows[0];

        let referrerReward = 0;
        let refereeReward = 0;

        // Determine rewards based on event type
        if (eventType === 'first_pick') {
            referrerReward = 200;
            refereeReward = 100;
            
            // Update referral status
            await query(
                `UPDATE referrals 
                 SET status = 'active', first_pick_at = NOW()
                 WHERE id = $1`,
                [referral.id]
            );

        } else if (eventType === 'subscription') {
            // Get subscription tier
            const userResult = await query(
                'SELECT subscription_tier FROM users WHERE id = $1',
                [userId]
            );
            
            const tier = userResult.rows[0]?.subscription_tier;
            
            if (tier === 'pro') {
                referrerReward = 2000;
            } else if (tier === 'vip') {
                referrerReward = 5000;
            }

            // Mark referral as completed
            await query(
                `UPDATE referrals 
                 SET status = 'completed', completed_at = NOW()
                 WHERE id = $1`,
                [referral.id]
            );

            // Grant referrer extended access
            const bonusDays = tier === 'pro' ? 14 : 30;
            await query(
                `UPDATE users 
                 SET subscription_ends_at = COALESCE(subscription_ends_at, NOW()) + INTERVAL '${bonusDays} days'
                 WHERE id = $1`,
                [referral.referrer_id]
            );
        }

        // Award referrer
        if (referrerReward > 0) {
            await query(
                'UPDATE users SET coins = coins + $1, xp = xp + $2 WHERE id = $3',
                [referrerReward, Math.floor(referrerReward / 4), referral.referrer_id]
            );

            await query(
                `INSERT INTO coin_transactions (user_id, amount, type, description, metadata)
                 VALUES ($1, $2, 'referral', 'Referral reward', $3)`,
                [referral.referrer_id, referrerReward, JSON.stringify({ type: eventType, referee: userId })]
            );
        }

        // Award referee
        if (refereeReward > 0) {
            await query(
                'UPDATE users SET coins = coins + $1, xp = xp + $2 WHERE id = $3',
                [refereeReward, Math.floor(refereeReward / 4), userId]
            );

            await query(
                `INSERT INTO coin_transactions (user_id, amount, type, description, metadata)
                 VALUES ($1, $2, 'referral', 'Referral milestone', $3)`,
                [userId, refereeReward, JSON.stringify({ type: eventType })]
            );
        }

        // Check for referrer milestones
        const countResult = await query(
            'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1 AND status = \'completed\'',
            [referral.referrer_id]
        );

        const completedCount = parseInt(countResult.rows[0].count);
        const milestones = [5, 10, 25, 50, 100];
        
        if (milestones.includes(completedCount)) {
            const milestoneRewards = {
                5: 1000,
                10: 2500,
                25: 5000,
                50: 10000,
                100: 25000
            };

            const milestoneBonus = milestoneRewards[completedCount];

            await query(
                'UPDATE users SET coins = coins + $1 WHERE id = $2',
                [milestoneBonus, referral.referrer_id]
            );

            await query(
                `INSERT INTO coin_transactions (user_id, amount, type, description, metadata)
                 VALUES ($1, $2, 'referral', 'Referral milestone', $3)`,
                [referral.referrer_id, milestoneBonus, JSON.stringify({ milestone: completedCount })]
            );
        }

        res.json({
            success: true,
            message: 'Referral completed',
            rewards: {
                referrerReward,
                refereeReward
            }
        });

    } catch (error) {
        console.error('Error completing referral:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete referral'
        });
    }
});

// ============================================
// GET REFERRAL STATISTICS
// ============================================

router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get referral code
        const codeResult = await query(
            'SELECT referral_code FROM users WHERE id = $1',
            [userId]
        );

        // Get referral counts
        const statsResult = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'active') as active_count,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
                SUM(CASE WHEN status = 'completed' THEN coins_earned ELSE 0 END) as total_coins,
                SUM(CASE WHEN status = 'completed' THEN xp_earned ELSE 0 END) as total_xp
             FROM referrals
             WHERE referrer_id = $1`,
            [userId]
        );

        const stats = statsResult.rows[0];

        res.json({
            success: true,
            code: codeResult.rows[0]?.referral_code,
            stats: {
                pending: parseInt(stats.pending_count) || 0,
                active: parseInt(stats.active_count) || 0,
                completed: parseInt(stats.completed_count) || 0,
                total: (parseInt(stats.pending_count) || 0) + 
                       (parseInt(stats.active_count) || 0) + 
                       (parseInt(stats.completed_count) || 0),
                totalCoins: parseFloat(stats.total_coins) || 0,
                totalXP: parseFloat(stats.total_xp) || 0
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

// ============================================
// GET USER'S REFERRALS
// ============================================

router.get('/my-referrals', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 50, offset = 0 } = req.query;

        let whereClause = 'WHERE referrer_id = $1';
        const params = [userId];

        if (status) {
            whereClause += ' AND status = $2';
            params.push(status);
        }

        const result = await query(
            `SELECT 
                r.*,
                u.username,
                u.avatar,
                u.level,
                u.subscription_tier
             FROM referrals r
             JOIN users u ON u.id = r.referee_id
             ${whereClause}
             ORDER BY r.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            referrals: result.rows
        });

    } catch (error) {
        console.error('Error getting referrals:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get referrals'
        });
    }
});

// ============================================
// GET REFERRAL LEADERBOARD
// ============================================

router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const result = await query(
            `SELECT 
                u.id,
                u.username,
                u.avatar,
                u.level,
                COUNT(r.id) FILTER (WHERE r.status = 'completed') as successful_referrals,
                SUM(r.coins_earned) as total_coins_earned
             FROM users u
             LEFT JOIN referrals r ON r.referrer_id = u.id
             GROUP BY u.id
             HAVING COUNT(r.id) FILTER (WHERE r.status = 'completed') > 0
             ORDER BY successful_referrals DESC, total_coins_earned DESC
             LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            leaderboard: result.rows
        });

    } catch (error) {
        console.error('Error getting referral leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get leaderboard'
        });
    }
});

// ============================================
// TRACK REFERRAL EVENT (Internal API)
// ============================================

router.post('/track-event', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { eventType, data } = req.body;

        // Log event for analytics
        await query(
            `INSERT INTO referral_events (user_id, event_type, metadata)
             VALUES ($1, $2, $3)`,
            [userId, eventType, JSON.stringify(data)]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('Error tracking referral event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track event'
        });
    }
});

module.exports = router;
