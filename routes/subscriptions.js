// ============================================
// SUBSCRIPTION MANAGEMENT ROUTES
// Handle subscription creation, activation, and management
// ============================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ============================================
// MIDDLEWARE
// ============================================

// Require authentication for all subscription routes
router.use(authenticateToken);

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/subscriptions/activate-manual
 * Manually activate subscription after manual PayPal payment
 */
router.post('/activate-manual', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { paypalSubscriptionId, tier, amount } = req.body;

        // Validate input
        if (!paypalSubscriptionId || !tier || !amount) {
            return res.status(400).json({
                error: 'Missing required fields: paypalSubscriptionId, tier, amount'
            });
        }

        if (!['pro', 'vip'].includes(tier)) {
            return res.status(400).json({
                error: 'Invalid tier. Must be pro or vip'
            });
        }

        // Use transaction for atomicity
        const result = await transaction(async (client) => {
            // Get current user subscription status
            const userResult = await client.query(
                'SELECT subscription_tier FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const previousTier = userResult.rows[0].subscription_tier;

            // Update user subscription
            const updateResult = await client.query(
                `UPDATE users 
                 SET paypal_subscription_id = $1,
                     subscription_status = $2,
                     subscription_tier = $3,
                     subscription_starts_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING *`,
                [paypalSubscriptionId, 'active', tier, userId]
            );

            const updatedUser = updateResult.rows[0];

            // Create payment record
            await client.query(
                `INSERT INTO payments (user_id, paypal_subscription_id, amount, tier, status, payment_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                 ON CONFLICT (payment_id) DO NOTHING`,
                [userId, paypalSubscriptionId, amount, tier, 'completed', `manual-${Date.now()}`]
            );

            // Create subscription change log
            await client.query(
                `INSERT INTO subscription_changes (user_id, from_tier, to_tier, reason, paypal_subscription_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, previousTier || 'free', tier, 'upgrade', paypalSubscriptionId]
            );

            // Create audit log
            await client.query(
                `INSERT INTO audit_logs (user_id, action, details)
                 VALUES ($1, $2, $3)`,
                [userId, 'manual_subscription_activation', JSON.stringify({
                    tier,
                    amount,
                    paypalSubscriptionId,
                    timestamp: new Date().toISOString()
                })]
            );

            return updatedUser;
        });

        res.json({
            success: true,
            message: `Subscription activated for tier: ${tier}`,
            user: {
                id: result.id,
                username: result.username,
                email: result.email,
                subscription_tier: result.subscription_tier,
                subscription_status: result.subscription_status
            }
        });

    } catch (error) {
        console.error('❌ Error activating subscription:', error);
        res.status(500).json({
            error: 'Failed to activate subscription',
            message: error.message
        });
    }
});

/**
 * GET /api/subscriptions/status
 * Get current subscription status for user
 */
router.get('/status', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT 
                id, email, subscription_tier, subscription_status,
                subscription_starts_at, subscription_ends_at, 
                paypal_subscription_id, last_payment_date
             FROM users 
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            subscriptionTier: user.subscription_tier,
            subscriptionStatus: user.subscription_status,
            startsAt: user.subscription_starts_at,
            endsAt: user.subscription_ends_at,
            paypalSubscriptionId: user.paypal_subscription_id,
            lastPaymentDate: user.last_payment_date
        });

    } catch (error) {
        console.error('❌ Error getting subscription status:', error);
        res.status(500).json({
            error: 'Failed to get subscription status',
            message: error.message
        });
    }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel user subscription
 */
router.post('/cancel', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const result = await transaction(async (client) => {
            // Get current subscription
            const userResult = await client.query(
                'SELECT subscription_tier, paypal_subscription_id FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const previousTier = userResult.rows[0].subscription_tier;

            // Update subscription status
            const updateResult = await client.query(
                `UPDATE users 
                 SET subscription_status = $1,
                     subscription_tier = $2,
                     subscription_ends_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3
                 RETURNING *`,
                ['cancelled', 'free', userId]
            );

            // Log subscription change
            await client.query(
                `INSERT INTO subscription_changes (user_id, from_tier, to_tier, reason)
                 VALUES ($1, $2, $3, $4)`,
                [userId, previousTier, 'free', 'cancellation']
            );

            // Create audit log
            await client.query(
                `INSERT INTO audit_logs (user_id, action)
                 VALUES ($1, $2)`,
                [userId, 'subscription_cancelled']
            );

            return updateResult.rows[0];
        });

        res.json({
            success: true,
            message: 'Subscription cancelled',
            subscriptionTier: result.subscription_tier,
            subscriptionStatus: result.subscription_status
        });

    } catch (error) {
        console.error('❌ Error cancelling subscription:', error);
        res.status(500).json({
            error: 'Failed to cancel subscription',
            message: error.message
        });
    }
});

/**
 * GET /api/subscriptions/history
 * Get subscription change history
 */
router.get('/history', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT 
                id, from_tier, to_tier, reason, created_at, effective_date
             FROM subscription_changes
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );

        res.json({
            history: result.rows
        });

    } catch (error) {
        console.error('❌ Error getting subscription history:', error);
        res.status(500).json({
            error: 'Failed to get subscription history',
            message: error.message
        });
    }
});

/**
 * GET /api/subscriptions/payment-history
 * Get payment history for subscription
 */
router.get('/payment-history', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT 
                id, amount, currency, tier, status, created_at, processed_at
             FROM payments
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId]
        );

        res.json({
            payments: result.rows
        });

    } catch (error) {
        console.error('❌ Error getting payment history:', error);
        res.status(500).json({
            error: 'Failed to get payment history',
            message: error.message
        });
    }
});

/**
 * POST /api/subscriptions/reactivate
 * Reactivate cancelled subscription
 */
router.post('/reactivate', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { tier } = req.body;

        if (!['pro', 'vip'].includes(tier)) {
            return res.status(400).json({
                error: 'Invalid tier. Must be pro or vip'
            });
        }

        const result = await transaction(async (client) => {
            // Update subscription
            const updateResult = await client.query(
                `UPDATE users 
                 SET subscription_status = $1,
                     subscription_tier = $2,
                     subscription_starts_at = CURRENT_TIMESTAMP,
                     subscription_ends_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3
                 RETURNING *`,
                ['active', tier, userId]
            );

            // Log reactivation
            await client.query(
                `INSERT INTO subscription_changes (user_id, from_tier, to_tier, reason)
                 VALUES ($1, $2, $3, $4)`,
                [userId, 'free', tier, 'reactivation']
            );

            return updateResult.rows[0];
        });

        res.json({
            success: true,
            message: `Subscription reactivated for tier: ${tier}`,
            user: {
                id: result.id,
                subscription_tier: result.subscription_tier,
                subscription_status: result.subscription_status
            }
        });

    } catch (error) {
        console.error('❌ Error reactivating subscription:', error);
        res.status(500).json({
            error: 'Failed to reactivate subscription',
            message: error.message
        });
    }
});

module.exports = router;
