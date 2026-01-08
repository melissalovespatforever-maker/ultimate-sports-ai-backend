/**
 * Subscription Routes for Ultimate Sports AI
 * Handles VIP subscription activation and management
 * Version: 2.5.1
 */

const express = require('express');
const router = express.Router();

// Import your authentication middleware
let authenticateToken;
try {
    authenticateToken = require('../middleware/auth');
} catch (e) {
    try {
        authenticateToken = require('../../middleware/auth');
    } catch (e) {
        console.warn('⚠️  Auth middleware not found, using placeholder');
        authenticateToken = (req, res, next) => {
            req.user = { id: 1 };
            next();
        };
    }
}

// Import database connection
let db;
try {
    db = require('../config/database');
} catch (e) {
    try {
        db = require('../../config/database');
    } catch (e) {
        const { Pool } = require('pg');
        db = {
            query: async (text, params) => {
                const pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false }
                });
                const result = await pool.query(text, params);
                await pool.end();
                return result;
            }
        };
    }
}

/**
 * POST /api/subscriptions/activate
 * Activate a VIP subscription
 */
router.post('/subscriptions/activate', authenticateToken, async (req, res) => {
    const {
        tier,
        tierId,
        monthlyCoins,
        subscriptionId,
        billingCycle,
        price,
        metadata
    } = req.body;
    const userId = req.user.id;

    // Validation
    if (!tier || !tierId || !subscriptionId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            message: 'tier, tierId, and subscriptionId are required'
        });
    }

    if (!billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid billing cycle',
            message: 'billingCycle must be "monthly" or "annual"'
        });
    }

    if (!monthlyCoins || monthlyCoins <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid monthly coins',
            message: 'monthlyCoins must be positive'
        });
    }

    try {
        // Calculate next billing date
        const daysToAdd = billingCycle === 'annual' ? 365 : 30;
        
        // Start transaction
        await db.query('BEGIN');

        // Check for existing subscription
        const existingResult = await db.query(
            'SELECT id, active FROM subscriptions WHERE subscription_id = $1',
            [subscriptionId]
        );

        let subscriptionRecord;

        if (existingResult.rows && existingResult.rows.length > 0) {
            // Reactivate existing subscription
            const updateResult = await db.query(
                `UPDATE subscriptions
                 SET active = true,
                     updated_at = NOW(),
                     next_billing_date = NOW() + INTERVAL '${daysToAdd} days'
                 WHERE subscription_id = $1
                 RETURNING *`,
                [subscriptionId]
            );
            subscriptionRecord = updateResult.rows[0];
            console.log(`🔄 Reactivated subscription: ${subscriptionId}`);
        } else {
            // Deactivate any other active subscriptions for this user
            await db.query(
                `UPDATE subscriptions 
                 SET active = false, 
                     cancelled_at = NOW(),
                     updated_at = NOW()
                 WHERE user_id = $1 AND active = true`,
                [userId]
            );

            // Create new subscription
            const insertResult = await db.query(
                `INSERT INTO subscriptions (
                    user_id,
                    tier,
                    tier_id,
                    monthly_coins,
                    billing_cycle,
                    price,
                    subscription_id,
                    paypal_subscription_id,
                    active,
                    start_date,
                    next_billing_date,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW() + INTERVAL '${daysToAdd} days', NOW())
                RETURNING *`,
                [
                    userId,
                    tier,
                    tierId,
                    monthlyCoins,
                    billingCycle,
                    price,
                    subscriptionId,
                    metadata?.paypalSubscriptionId || subscriptionId
                ]
            );
            subscriptionRecord = insertResult.rows[0];
        }

        // Update user tier
        const tierName = tierId.split('_')[0]; // e.g., 'bronze_monthly' -> 'bronze'
        await db.query(
            `UPDATE users 
             SET subscription_tier = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [tierName, userId]
        );

        // Credit initial coins
        const balanceResult = await db.query(
            `UPDATE users 
             SET balance = balance + $1,
                 last_balance_update = NOW(),
                 updated_at = NOW()
             WHERE id = $2
             RETURNING balance`,
            [monthlyCoins, userId]
        );

        const newBalance = balanceResult.rows[0].balance;

        // Log transaction for initial coins
        await db.query(
            `INSERT INTO transactions (
                user_id,
                type,
                amount,
                reason,
                method,
                subscription_id,
                metadata,
                created_at
            ) VALUES ($1, 'credit', $2, $3, 'subscription', $4, $5, NOW())`,
            [
                userId,
                monthlyCoins,
                `VIP Subscription: ${tier} (Initial Coins)`,
                subscriptionId,
                JSON.stringify(metadata || {})
            ]
        );

        // Commit transaction
        await db.query('COMMIT');

        console.log(`✅ Subscription activated: User ${userId}, Tier: ${tier}, Coins: ${monthlyCoins}`);

        // Return success
        res.json({
            success: true,
            subscription: {
                id: subscriptionRecord.id,
                user_id: subscriptionRecord.user_id,
                tier: subscriptionRecord.tier,
                tierId: subscriptionRecord.tier_id,
                monthlyCoins: subscriptionRecord.monthly_coins,
                billingCycle: subscriptionRecord.billing_cycle,
                price: parseFloat(subscriptionRecord.price),
                subscriptionId: subscriptionRecord.subscription_id,
                active: subscriptionRecord.active,
                startDate: subscriptionRecord.start_date,
                nextBillingDate: subscriptionRecord.next_billing_date
            },
            balance: newBalance,
            coinsAdded: monthlyCoins
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('❌ Subscription activation error:', error);

        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to activate subscription',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/subscriptions/status
 * Get user's subscription status
 */
router.get('/subscriptions/status', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT 
                id,
                tier,
                tier_id,
                monthly_coins,
                billing_cycle,
                price,
                subscription_id,
                active,
                start_date,
                next_billing_date,
                cancelled_at,
                created_at
             FROM subscriptions
             WHERE user_id = $1 AND active = true
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );

        if (result.rows && result.rows.length > 0) {
            res.json({
                success: true,
                subscription: result.rows[0],
                hasActiveSubscription: true
            });
        } else {
            res.json({
                success: true,
                subscription: null,
                hasActiveSubscription: false
            });
        }

    } catch (error) {
        console.error('❌ Subscription status error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to fetch subscription status'
        });
    }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel a subscription
 */
router.post('/subscriptions/cancel', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
        return res.status(400).json({
            success: false,
            error: 'Missing subscription ID',
            message: 'subscriptionId is required'
        });
    }

    try {
        const result = await db.query(
            `UPDATE subscriptions
             SET active = false,
                 cancelled_at = NOW(),
                 updated_at = NOW()
             WHERE user_id = $1 
             AND subscription_id = $2 
             AND active = true
             RETURNING *`,
            [userId, subscriptionId]
        );

        if (result.rows && result.rows.length > 0) {
            console.log(`🔴 Subscription cancelled: ${subscriptionId}`);
            res.json({
                success: true,
                message: 'Subscription cancelled successfully',
                subscription: result.rows[0]
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Subscription not found',
                message: 'No active subscription found with that ID'
            });
        }

    } catch (error) {
        console.error('❌ Subscription cancellation error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to cancel subscription'
        });
    }
});

/**
 * GET /api/subscriptions/history
 * Get user's subscription history
 */
router.get('/subscriptions/history', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT 
                id,
                tier,
                tier_id,
                monthly_coins,
                billing_cycle,
                price,
                subscription_id,
                active,
                start_date,
                next_billing_date,
                cancelled_at,
                created_at
             FROM subscriptions
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            subscriptions: result.rows
        });

    } catch (error) {
        console.error('❌ Subscription history error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to fetch subscription history'
        });
    }
});

module.exports = router;
