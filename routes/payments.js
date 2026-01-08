/**
 * Payment Routes for Ultimate Sports AI
 * Handles PayPal coin purchases and subscription payments
 * Version: 2.5.1
 */

const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/payments/paypal-purchase
 * Record a PayPal coin purchase and credit user balance
 */
router.post('/paypal-purchase', authenticateToken, async (req, res) => {
    const { type, amount, reason, metadata } = req.body;
    const userId = req.user.id;

    // Validation
    if (!type || type !== 'credit') {
        return res.status(400).json({
            success: false,
            error: 'Invalid transaction type',
            message: 'Type must be "credit"'
        });
    }

    if (!amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid amount',
            message: 'Amount must be positive'
        });
    }

    if (!metadata || !metadata.paypalTransactionId) {
        return res.status(400).json({
            success: false,
            error: 'Missing PayPal transaction ID',
            message: 'metadata.paypalTransactionId is required'
        });
    }

    const { paypalTransactionId, bundleName } = metadata;

    let client;
    try {
        client = await pool.connect();
        
        // Check for duplicate transaction
        const existingTxn = await client.query(
            'SELECT id FROM transactions WHERE paypal_transaction_id = $1',
            [paypalTransactionId]
        );

        if (existingTxn.rows && existingTxn.rows.length > 0) {
            client.release();
            return res.status(400).json({
                success: false,
                error: 'Duplicate transaction',
                message: 'This PayPal transaction has already been processed'
            });
        }

        // Start database transaction
        await client.query('BEGIN');

        // Update user balance
        const balanceResult = await client.query(
            `UPDATE users 
             SET balance = COALESCE(balance, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2 
             RETURNING balance`,
            [amount, userId]
        );

        if (!balanceResult.rows || balanceResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'Could not find user to credit'
            });
        }

        const newBalance = balanceResult.rows[0].balance;

        // Insert transaction record
        const transactionResult = await client.query(
            `INSERT INTO transactions (
                user_id, 
                type, 
                amount, 
                reason, 
                method,
                paypal_transaction_id,
                metadata,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
            RETURNING *`,
            [
                userId,
                type,
                amount,
                reason || `PayPal Purchase: ${bundleName || 'Coin Bundle'}`,
                'paypal',
                paypalTransactionId,
                JSON.stringify(metadata),
                'completed'
            ]
        );

        // Commit transaction
        await client.query('COMMIT');
        client.release();

        const transaction = transactionResult.rows[0];

        console.log(`✅ PayPal purchase processed: User ${userId}, ${amount} coins, Balance: ${newBalance}`);

        // Return success
        res.json({
            success: true,
            balance: newBalance,
            transaction: {
                id: transaction.id,
                user_id: transaction.user_id,
                type: transaction.type,
                amount: transaction.amount,
                reason: transaction.reason,
                paypalTransactionId: transaction.paypal_transaction_id,
                timestamp: transaction.created_at
            }
        });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
            client.release();
        }
        console.error('❌ PayPal purchase error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to process purchase',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/payments/subscription-activate
 * Activate a VIP subscription and credit initial coins
 */
router.post('/subscription-activate', authenticateToken, async (req, res) => {
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

    let client;
    try {
        client = await pool.connect();
        
        // Calculate next billing date
        const daysToAdd = billingCycle === 'annual' ? 365 : 30;
        
        // Start transaction
        await client.query('BEGIN');

        // Check for existing subscription
        const existingResult = await client.query(
            'SELECT id, active FROM subscriptions WHERE subscription_id = $1',
            [subscriptionId]
        );

        let subscriptionRecord;

        if (existingResult.rows && existingResult.rows.length > 0) {
            // Reactivate existing subscription
            const updateResult = await client.query(
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
            await client.query(
                `UPDATE subscriptions 
                 SET active = false, 
                     cancelled_at = NOW(),
                     updated_at = NOW()
                 WHERE user_id = $1 AND active = true`,
                [userId]
            );

            // Create new subscription
            const insertResult = await client.query(
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
        await client.query(
            `UPDATE users 
             SET subscription_tier = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [tierName, userId]
        );

        // Credit initial coins
        const balanceResult = await client.query(
            `UPDATE users 
             SET balance = COALESCE(balance, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING balance`,
            [monthlyCoins, userId]
        );

        const newBalance = balanceResult.rows[0].balance;

        // Log transaction for initial coins
        await client.query(
            `INSERT INTO transactions (
                user_id,
                type,
                amount,
                reason,
                method,
                subscription_id,
                metadata,
                status,
                created_at
            ) VALUES ($1, 'credit', $2, $3, 'subscription', $4, $5, 'completed', NOW())`,
            [
                userId,
                monthlyCoins,
                `VIP Subscription: ${tier} (Initial Coins)`,
                subscriptionId,
                JSON.stringify(metadata || {})
            ]
        );

        // Commit transaction
        await client.query('COMMIT');
        client.release();

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
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
            client.release();
        }
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
 * GET /api/payments/history
 * Get user's payment transaction history
 */
router.get('/history', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const result = await query(
            `SELECT 
                id,
                type,
                amount,
                reason,
                method,
                paypal_transaction_id,
                metadata,
                status,
                created_at
             FROM transactions
             WHERE user_id = $1 AND method IN ('paypal', 'subscription')
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as total 
             FROM transactions 
             WHERE user_id = $1 AND method IN ('paypal', 'subscription')`,
            [userId]
        );

        res.json({
            success: true,
            transactions: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        });

    } catch (error) {
        console.error('❌ Payment history error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to fetch payment history'
        });
    }
});

module.exports = router;
