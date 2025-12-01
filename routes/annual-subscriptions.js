// ============================================
// ANNUAL SUBSCRIPTION ROUTES
// Manage annual & monthly billing cycles
// ============================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ============================================
// PRICING ENDPOINTS
// ============================================

/**
 * GET /api/annual-subscriptions/pricing
 * Get current pricing for all tiers with monthly and annual options
 */
router.get('/pricing', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT 
                tier, plan_name, description, 
                monthly_price, annual_price, annual_discount_percentage, 
                features
             FROM subscription_plans 
             WHERE is_active = true
             ORDER BY tier`
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No active subscription plans found' });
        }

        const pricing = {};
        result.rows.forEach(plan => {
            pricing[plan.tier] = {
                name: plan.plan_name,
                description: plan.description,
                monthlyPrice: parseFloat(plan.monthly_price),
                annualPrice: parseFloat(plan.annual_price),
                discountPercentage: plan.annual_discount_percentage,
                features: plan.features,
                // Calculate derived values
                annualSavings: parseFloat(plan.monthly_price) * 12 - parseFloat(plan.annual_price),
                effectiveMonthly: parseFloat(plan.annual_price) / 12
            };
        });

        res.json({
            pricing,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting pricing:', error);
        res.status(500).json({
            error: 'Failed to get pricing',
            message: error.message
        });
    }
});

/**
 * GET /api/annual-subscriptions/pricing/:tier
 * Get pricing for specific tier
 */
router.get('/pricing/:tier', async (req, res, next) => {
    try {
        const { tier } = req.params;

        const result = await query(
            `SELECT * FROM subscription_plans WHERE tier = $1 AND is_active = true`,
            [tier.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subscription plan not found' });
        }

        const plan = result.rows[0];

        res.json({
            tier: plan.tier,
            name: plan.plan_name,
            description: plan.description,
            pricing: {
                monthly: parseFloat(plan.monthly_price),
                annual: parseFloat(plan.annual_price),
                discountPercentage: plan.annual_discount_percentage,
                savings: parseFloat(plan.monthly_price) * 12 - parseFloat(plan.annual_price),
                effectiveMonthly: parseFloat(plan.annual_price) / 12
            },
            features: plan.features
        });

    } catch (error) {
        console.error('❌ Error getting pricing:', error);
        res.status(500).json({
            error: 'Failed to get pricing',
            message: error.message
        });
    }
});

// ============================================
// BILLING CYCLE MANAGEMENT
// ============================================

/**
 * GET /api/annual-subscriptions/billing-info
 * Get current user's billing info
 */
router.get('/billing-info', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT 
                subscription_tier, subscription_status, billing_cycle,
                subscription_starts_at, annual_renewal_date,
                subscription_discount_percentage
             FROM users 
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            tier: user.subscription_tier,
            status: user.subscription_status,
            billingCycle: user.billing_cycle,
            discountPercentage: user.subscription_discount_percentage,
            subscribedAt: user.subscription_starts_at,
            renewalDate: user.annual_renewal_date
        });

    } catch (error) {
        console.error('❌ Error getting billing info:', error);
        res.status(500).json({
            error: 'Failed to get billing info',
            message: error.message
        });
    }
});

/**
 * POST /api/annual-subscriptions/switch-billing-cycle
 * Switch between monthly and annual billing
 */
router.post('/switch-billing-cycle', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { newBillingCycle, tier } = req.body;

        // Validate input
        if (!['monthly', 'annual'].includes(newBillingCycle)) {
            return res.status(400).json({
                error: 'Invalid billing cycle. Must be monthly or annual'
            });
        }

        // Get current user
        const userResult = await query(
            `SELECT subscription_tier, billing_cycle, subscription_starts_at 
             FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        const oldBillingCycle = user.billing_cycle;

        // Get subscription plan
        const planResult = await query(
            `SELECT monthly_price, annual_price FROM subscription_plans 
             WHERE tier = $1`,
            [user.subscription_tier.toLowerCase()]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Subscription plan not found' });
        }

        const plan = planResult.rows[0];
        const monthlyPrice = parseFloat(plan.monthly_price);
        const annualPrice = parseFloat(plan.annual_price);

        // Use transaction
        const result = await transaction(async (client) => {
            // Calculate renewal date based on new cycle
            let renewalDate;
            if (newBillingCycle === 'annual') {
                renewalDate = new Date();
                renewalDate.setFullYear(renewalDate.getFullYear() + 1);
            } else {
                renewalDate = new Date();
                renewalDate.setMonth(renewalDate.getMonth() + 1);
            }

            // Update user
            const updateResult = await client.query(
                `UPDATE users 
                 SET billing_cycle = $1,
                     annual_renewal_date = $2,
                     subscription_discount_percentage = $3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING *`,
                [
                    newBillingCycle,
                    renewalDate,
                    newBillingCycle === 'annual' ? 20 : 0,
                    userId
                ]
            );

            // Record plan conversion
            const savingsAmount = newBillingCycle === 'annual'
                ? (monthlyPrice * 12) - annualPrice
                : 0;

            await client.query(
                `INSERT INTO plan_conversions 
                 (user_id, from_billing_cycle, to_billing_cycle, from_tier, to_tier, savings_amount, old_renewal_date, new_renewal_date, conversion_reason)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userId,
                    oldBillingCycle,
                    newBillingCycle,
                    user.subscription_tier,
                    user.subscription_tier,
                    savingsAmount,
                    user.subscription_starts_at,
                    renewalDate,
                    'user_initiated'
                ]
            );

            // Create billing history
            await client.query(
                `INSERT INTO billing_history 
                 (user_id, tier, billing_cycle, price_charged, regular_price, discount_amount, discount_percentage, status, billing_start_date, billing_end_date, next_renewal_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10)`,
                [
                    userId,
                    user.subscription_tier.toLowerCase(),
                    newBillingCycle,
                    newBillingCycle === 'annual' ? annualPrice : monthlyPrice,
                    newBillingCycle === 'annual' ? monthlyPrice * 12 : monthlyPrice,
                    newBillingCycle === 'annual' ? savingsAmount : 0,
                    newBillingCycle === 'annual' ? 20 : 0,
                    'pending',
                    renewalDate,
                    renewalDate
                ]
            );

            return {
                user: updateResult.rows[0],
                savings: savingsAmount,
                renewalDate
            };
        });

        res.json({
            success: true,
            message: `Billing cycle switched to ${newBillingCycle}`,
            billingCycle: newBillingCycle,
            renewalDate: result.renewalDate,
            savings: result.savings,
            user: {
                id: result.user.id,
                subscription_tier: result.user.subscription_tier,
                billing_cycle: result.user.billing_cycle
            }
        });

    } catch (error) {
        console.error('❌ Error switching billing cycle:', error);
        res.status(500).json({
            error: 'Failed to switch billing cycle',
            message: error.message
        });
    }
});

// ============================================
// BILLING HISTORY
// ============================================

/**
 * GET /api/annual-subscriptions/billing-history
 * Get user's billing history
 */
router.get('/billing-history', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;

        const result = await query(
            `SELECT 
                id, tier, billing_cycle, price_charged, discount_amount, discount_percentage,
                status, billing_start_date, billing_end_date, next_renewal_date, created_at
             FROM billing_history
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            billingHistory: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Error getting billing history:', error);
        res.status(500).json({
            error: 'Failed to get billing history',
            message: error.message
        });
    }
});

// ============================================
// PROMOTIONAL CODES
// ============================================

/**
 * GET /api/annual-subscriptions/promotions/validate/:code
 * Validate promotional code
 */
router.get('/promotions/validate/:code', async (req, res, next) => {
    try {
        const { code } = req.params;

        const result = await query(
            `SELECT 
                id, code, description, discount_type, discount_value, 
                max_discount_amount, applicable_tiers, start_date, end_date,
                max_uses, usage_count
             FROM annual_promotions
             WHERE code = $1 AND is_active = true`,
            [code.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                valid: false,
                message: 'Promotional code not found or expired'
            });
        }

        const promo = result.rows[0];
        const now = new Date();

        // Check if within date range
        if (now < new Date(promo.start_date) || now > new Date(promo.end_date)) {
            return res.status(400).json({
                valid: false,
                message: 'Promotional code expired'
            });
        }

        // Check usage limits
        if (promo.max_uses && promo.usage_count >= promo.max_uses) {
            return res.status(400).json({
                valid: false,
                message: 'Promotional code has reached maximum uses'
            });
        }

        res.json({
            valid: true,
            promotion: {
                code: promo.code,
                description: promo.description,
                discountType: promo.discount_type,
                discountValue: parseFloat(promo.discount_value),
                maxDiscount: promo.max_discount_amount ? parseFloat(promo.max_discount_amount) : null,
                applicableTiers: promo.applicable_tiers,
                remainingUses: promo.max_uses ? promo.max_uses - promo.usage_count : null
            }
        });

    } catch (error) {
        console.error('❌ Error validating promotion:', error);
        res.status(500).json({
            error: 'Failed to validate promotional code',
            message: error.message
        });
    }
});

/**
 * POST /api/annual-subscriptions/promotions/apply
 * Apply promotional code to user's subscription
 */
router.post('/promotions/apply', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { code, tier } = req.body;

        if (!code || !tier) {
            return res.status(400).json({
                error: 'Code and tier are required'
            });
        }

        // Get promotion
        const promoResult = await query(
            `SELECT * FROM annual_promotions 
             WHERE code = $1 AND is_active = true`,
            [code.toUpperCase()]
        );

        if (promoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Promotional code not found' });
        }

        const promo = promoResult.rows[0];

        // Check if tier is applicable
        if (!promo.applicable_tiers.includes(tier.toLowerCase())) {
            return res.status(400).json({
                error: 'Promotional code not applicable to this tier'
            });
        }

        // Check user's promo usage
        if (promo.max_per_user) {
            const usageResult = await query(
                `SELECT COUNT(*) as count FROM promotion_usage 
                 WHERE user_id = $1 AND promotion_id = $2`,
                [userId, promo.id]
            );

            if (usageResult.rows[0].count >= promo.max_per_user) {
                return res.status(400).json({
                    error: 'You have already used this promotional code maximum times'
                });
            }
        }

        // Calculate discount
        let discountAmount = 0;
        const planResult = await query(
            `SELECT annual_price FROM subscription_plans WHERE tier = $1`,
            [tier.toLowerCase()]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Subscription plan not found' });
        }

        const annualPrice = parseFloat(planResult.rows[0].annual_price);

        if (promo.discount_type === 'percentage') {
            discountAmount = (annualPrice * parseFloat(promo.discount_value)) / 100;
        } else {
            discountAmount = parseFloat(promo.discount_value);
        }

        // Cap discount if needed
        if (promo.max_discount_amount) {
            discountAmount = Math.min(discountAmount, parseFloat(promo.max_discount_amount));
        }

        const finalPrice = Math.max(0, annualPrice - discountAmount);

        // Record promotion usage
        const result = await transaction(async (client) => {
            await client.query(
                `INSERT INTO promotion_usage (user_id, promotion_id, tier, billing_cycle, discount_amount)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, promo.id, tier.toLowerCase(), 'annual', discountAmount]
            );

            // Update promotion usage count
            await client.query(
                `UPDATE annual_promotions SET usage_count = usage_count + 1 WHERE id = $1`,
                [promo.id]
            );

            return {
                discount: discountAmount,
                finalPrice,
                originalPrice: annualPrice
            };
        });

        res.json({
            success: true,
            promotion: {
                code,
                description: promo.description,
                originalPrice: result.originalPrice,
                discountAmount: result.discount,
                finalPrice: result.finalPrice
            }
        });

    } catch (error) {
        console.error('❌ Error applying promotion:', error);
        res.status(500).json({
            error: 'Failed to apply promotional code',
            message: error.message
        });
    }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /api/annual-subscriptions/stats
 * Get annual subscription statistics (admin endpoint)
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
    try {
        // Check if user is admin (you would implement actual admin check)
        const userId = req.user.userId;

        const result = await query(
            `SELECT 
                billing_cycle, 
                subscription_tier,
                COUNT(*) as count,
                SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) as active,
                COUNT(DISTINCT DATE(created_at)) as active_days
             FROM users
             WHERE subscription_tier IN ('pro', 'vip')
             GROUP BY billing_cycle, subscription_tier
             ORDER BY billing_cycle, subscription_tier`
        );

        res.json({
            stats: result.rows,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({
            error: 'Failed to get statistics',
            message: error.message
        });
    }
});

module.exports = router;
