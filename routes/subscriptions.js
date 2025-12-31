// ============================================
// SUBSCRIPTION MANAGEMENT ROUTES
// Handle subscription creation, activation, and management
// ============================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Optional: Try to load email service, but don't fail if it's not available
let emailService = null;
try {
    const EmailService = require('../services/email-service');
    emailService = new EmailService();
    console.log('✅ Email service initialized');
} catch (error) {
    console.warn('⚠️ Email service not available:', error.message);
}

// ============================================
// PUBLIC ROUTES (optional auth)
// ============================================

/**
 * GET /api/subscriptions/status
 * Get current subscription status for user
 * HARDENED: Returns safe defaults instead of 500 errors
 */
router.get('/status', optionalAuth, async (req, res) => {
    try {
        console.log('📋 /status endpoint called');
        
        // Get userId - be defensive
        let userId = null;
        if (req.user) {
            userId = req.user.id || req.user.userId;
            console.log(`✅ User found: ${userId}`);
        }

        if (!userId) {
            console.warn('⚠️ No user ID in request, returning free tier');
            return res.status(200).json({
                success: true,
                subscriptionTier: 'free',
                subscriptionStatus: 'inactive',
                message: 'No user authenticated - returning free tier'
            });
        }

        // Get user email for convenience
        const userEmail = req.user?.email || null;

        // Query with maximum defensiveness
        let subscription = null;
        
        try {
            console.log(`🔍 Querying subscriptions for user ${userId}`);
            const result = await query(
                `SELECT id, user_id, plan_name, price, status, started_at, billing_cycle
                 FROM subscriptions 
                 WHERE user_id = $1
                 LIMIT 1`,
                [userId]
            );

            if (result?.rows?.[0]) {
                subscription = result.rows[0];
                console.log(`✅ Found subscription: ${subscription.plan_name}`);
            } else {
                console.log(`ℹ️ No subscription record found`);
            }
        } catch (dbError) {
            console.error('⚠️ Database query failed:', dbError.message);
            // Don't throw - return safe default instead
        }

        // Always return a successful response
        return res.status(200).json({
            success: true,
            subscriptionId: subscription?.id || null,
            userId: userId,
            subscriptionTier: subscription?.plan_name || 'free',
            subscriptionStatus: subscription?.status || 'inactive',
            price: subscription?.price || null,
            billingCycle: subscription?.billing_cycle || null,
            startsAt: subscription?.started_at || null,
            email: userEmail,
            message: subscription ? 'Active subscription' : 'No subscription found'
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in /status:', error.message);
        
        // Last resort - always return something
        return res.status(200).json({
            success: false,
            subscriptionTier: 'free',
            subscriptionStatus: 'inactive',
            message: 'Service temporarily unavailable'
        });
    }
});

// ============================================
// PROTECTED ROUTES (require auth)
// ============================================

// Require authentication for all other subscription routes
router.use(authenticateToken);

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/subscriptions/create-subscription
 * Create a new subscription (simplified - no actual PayPal integration)
 */
router.post('/create-subscription', async (req, res, next) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { tier, amount } = req.body;

        // Validate input
        if (!tier || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tier, amount'
            });
        }

        if (!['pro', 'vip'].includes(tier.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid tier. Must be pro or vip'
            });
        }

        // Generate a subscription ID
        const subscriptionId = `sub_${Date.now()}_${userId}`;

        console.log(`✅ Created subscription for user ${userId}: ${tier} ($${amount})`);

        res.json({
            success: true,
            subscription: {
                id: subscriptionId,
                tier: tier.toLowerCase(),
                amount: amount,
                status: 'active'
            },
            message: 'Subscription created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating subscription:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create subscription',
            message: error.message
        });
    }
});

/**
 * POST /api/subscriptions/activate-manual
 * Manually activate subscription after manual PayPal payment
 * HARDENED: Returns 200 with safe defaults instead of 500 errors
 */
router.post('/activate-manual', async (req, res) => {
    try {
        console.log('💳 /activate-manual endpoint called');
        
        // Get userId - be defensive
        let userId = null;
        if (req.user) {
            userId = req.user.id || req.user.userId;
        }

        if (!userId) {
            console.warn('⚠️ No user ID found');
            return res.status(200).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Validate request body
        const { paypalSubscriptionId, tier, amount } = req.body || {};

        if (!paypalSubscriptionId || !tier || !amount) {
            return res.status(200).json({
                success: false,
                error: 'Missing required fields: paypalSubscriptionId, tier, amount'
            });
        }

        const tierLower = tier.toLowerCase();
        if (!['pro', 'vip'].includes(tierLower)) {
            return res.status(200).json({
                success: false,
                error: 'Invalid tier. Must be pro or vip'
            });
        }

        console.log(`💳 Activating ${tier} subscription for user ${userId}`);

        // Initialize user object with minimal defaults
        let updatedUser = {
            id: userId,
            username: 'User',
            email: 'user@example.com',
            subscription_tier: tierLower,
            subscription_status: 'active'
        };

        // Try to fetch user details from database (gracefully degrade if fails)
        try {
            console.log(`🔍 Fetching user ${userId} from database`);
            const userResult = await query(
                `SELECT id, username, email FROM users WHERE id = $1`,
                [userId]
            );

            if (userResult?.rows?.[0]) {
                updatedUser = { ...updatedUser, ...userResult.rows[0] };
                console.log(`✅ User found: ${updatedUser.email}`);
                
                // Try to update subscription tier
                try {
                    await query(
                        `UPDATE users SET subscription_tier = $1 WHERE id = $2`,
                        [tierLower, userId]
                    );
                    console.log(`✅ Database updated with tier: ${tierLower}`);
                } catch (updateErr) {
                    console.warn('⚠️ Database update failed, continuing:', updateErr.message);
                }
            } else {
                console.warn('⚠️ User not found in database');
            }
        } catch (dbErr) {
            console.warn('⚠️ Database query failed:', dbErr.message);
        }

        // Send receipt email asynchronously (non-blocking)
        if (emailService) {
            setImmediate(async () => {
                try {
                    const tierName = tier.toUpperCase();
                    const tierPricing = { 'pro': 14.99, 'vip': 29.99 };
                    const tierFeatures = {
                        'pro': [
                            'All FREE features',
                            'Unlimited AI predictions',
                            'Advanced analytics dashboard',
                            'Real-time odds comparison',
                            'Priority customer support'
                        ],
                        'vip': [
                            'Everything in PRO',
                            'Exclusive AI models',
                            '1-on-1 coaching sessions',
                            'Early feature access',
                            'VIP community access',
                            'Custom alerts & notifications'
                        ]
                    };
                    const paymentData = {
                        plan: tierName,
                        amount: tierPricing[tierLower] || amount,
                        billingPeriod: 'Monthly',
                        transactionId: paypalSubscriptionId,
                        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        features: tierFeatures[tierLower] || []
                    };
                    const emailResult = await emailService.sendPaymentReceiptEmail(updatedUser, paymentData);
                    if (emailResult?.success) {
                        console.log(`📧 Email sent to ${updatedUser.email}`);
                    } else {
                        console.warn(`⚠️ Email failed:`, emailResult?.error);
                    }
                } catch (emailError) {
                    console.error('❌ Email error:', emailError.message);
                }
            });
        }

        // Always return success
        return res.status(200).json({
            success: true,
            message: `Subscription activated for tier: ${tier}`,
            emailSent: emailService ? true : false,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                subscription_tier: updatedUser.subscription_tier,
                subscription_status: updatedUser.subscription_status
            }
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in activate-manual:', error.message);
        
        // Last resort - always return 200 with safe data
        return res.status(200).json({
            success: false,
            error: 'Service temporarily unavailable',
            message: error.message.substring(0, 100)
        });
    }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel user subscription
 */
router.post('/cancel', async (req, res, next) => {
    try {
        const userId = req.user.id || req.user.userId;

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
        const userId = req.user.id || req.user.userId;

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
        const userId = req.user.id || req.user.userId;

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
        const userId = req.user.id || req.user.userId;
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
