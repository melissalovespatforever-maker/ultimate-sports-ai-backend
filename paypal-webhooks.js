// ============================================
// PAYPAL WEBHOOK HANDLERS
// Automated subscription verification and activation
// ============================================

const express = require('express');
const axios = require('axios');
const { query, transaction } = require('../config/database');
const crypto = require('crypto');

const router = express.Router();

// PayPal configuration
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_BASE_URL = PAYPAL_MODE === 'live'
    ? 'https://api.paypal.com'
    : 'https://api.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// Cache for PayPal access token
let paypalAccessToken = null;
let tokenExpiry = null;

// ============================================
// PAYPAL API HELPERS
// ============================================

/**
 * Get PayPal access token for API verification
 */
async function getPayPalAccessToken() {
    try {
        // Return cached token if still valid
        if (paypalAccessToken && tokenExpiry && tokenExpiry > Date.now()) {
            return paypalAccessToken;
        }

        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

        const response = await axios.post(
            `${PAYPAL_BASE_URL}/v1/oauth2/token`,
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        paypalAccessToken = response.data.access_token;
        // Set expiry 5 minutes before actual expiry
        tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

        console.log('✅ PayPal access token obtained');
        return paypalAccessToken;

    } catch (error) {
        console.error('❌ Error getting PayPal access token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with PayPal');
    }
}

/**
 * Verify webhook signature from PayPal
 */
async function verifyWebhookSignature(req) {
    try {
        const transmissionId = req.headers['paypal-transmission-id'];
        const transmissionTime = req.headers['paypal-transmission-time'];
        const certUrl = req.headers['paypal-cert-url'];
        const authAlgo = req.headers['paypal-auth-algo'];
        const transmissionSig = req.headers['paypal-transmission-sig'];

        if (!transmissionId || !transmissionTime || !transmissionSig) {
            console.warn('⚠️ Missing webhook headers for verification');
            return false;
        }

        const accessToken = await getPayPalAccessToken();

        const response = await axios.post(
            `${PAYPAL_BASE_URL}/v1/notifications/webhooks-events/${req.body.id}/verify-signature`,
            {
                transmission_id: transmissionId,
                transmission_time: transmissionTime,
                cert_url: certUrl,
                auth_algo: authAlgo,
                transmission_sig: transmissionSig,
                webhook_id: WEBHOOK_ID,
                webhook_event: req.body
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.verification_status === 'SUCCESS';

    } catch (error) {
        console.error('❌ Error verifying webhook signature:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Get subscription details from PayPal
 */
async function getSubscriptionDetails(subscriptionId) {
    try {
        const accessToken = await getPayPalAccessToken();

        const response = await axios.get(
            `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error('❌ Error getting subscription details:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get order details from PayPal
 */
async function getOrderDetails(orderId) {
    try {
        const accessToken = await getPayPalAccessToken();

        const response = await axios.get(
            `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error('❌ Error getting order details:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// WEBHOOK EVENT HANDLERS
// ============================================

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(event) {
    try {
        const subscriptionId = event.resource.id;
        const customData = event.resource.custom_id; // User ID encoded in custom data

        console.log(`📝 Subscription created: ${subscriptionId}`);

        // Get subscription details from PayPal
        const subscription = await getSubscriptionDetails(subscriptionId);

        // Extract user email or ID from custom data
        const userId = customData;

        // Store subscription in database
        await query(
            `UPDATE users 
             SET paypal_subscription_id = $1,
                 subscription_status = $2,
                 subscription_starts_at = $3
             WHERE id = $4`,
            [subscriptionId, 'active', new Date(subscription.start_time), userId]
        );

        console.log(`✅ Subscription created and stored for user: ${userId}`);
        return true;

    } catch (error) {
        console.error('❌ Error handling subscription created:', error.message);
        return false;
    }
}

/**
 * Handle subscription activated event (first payment received)
 */
async function handleSubscriptionActivated(event) {
    try {
        const subscriptionId = event.resource.id;
        const customData = event.resource.custom_id;
        const userId = customData;

        console.log(`✅ Subscription activated: ${subscriptionId}`);

        // Get subscription details
        const subscription = await getSubscriptionDetails(subscriptionId);

        // Determine tier from subscription amount
        let tier = 'pro';
        if (subscription.billing_cycles) {
            const billingCycle = subscription.billing_cycles[0];
            if (billingCycle && billingCycle.pricing_scheme) {
                const amount = parseFloat(billingCycle.pricing_scheme.fixed_price.value);
                if (amount >= 99.99) {
                    tier = 'vip';
                }
            }
        }

        // Use transaction for atomicity
        const result = await transaction(async (client) => {
            // Update subscription status
            await client.query(
                `UPDATE users 
                 SET paypal_subscription_id = $1,
                     subscription_status = $2,
                     subscription_tier = $3,
                     subscription_starts_at = $4,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5`,
                [subscriptionId, 'active', tier, new Date(subscription.start_time), userId]
            );

            // Create payment record
            await client.query(
                `INSERT INTO payments (user_id, paypal_subscription_id, amount, tier, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 ON CONFLICT DO NOTHING`,
                [userId, subscriptionId, parseFloat(subscription.billing_cycles[0].pricing_scheme.fixed_price.value), tier, 'completed']
            );

            // Create audit log
            await client.query(
                `INSERT INTO audit_logs (user_id, action, details, created_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                [userId, 'subscription_activated', JSON.stringify({ tier, subscriptionId })]
            );

            return { success: true, tier };
        });

        console.log(`✅ User ${userId} upgraded to ${result.tier}`);
        return result;

    } catch (error) {
        console.error('❌ Error handling subscription activated:', error.message);
        return false;
    }
}

/**
 * Handle subscription payment completed event
 */
async function handleSubscriptionPaymentCompleted(event) {
    try {
        const subscriptionId = event.resource.id;
        const customData = event.resource.custom_id;
        const userId = customData;
        const amount = parseFloat(event.resource.amount_paid.value);

        console.log(`💰 Payment completed for subscription: ${subscriptionId}`);

        // Create payment record
        await query(
            `INSERT INTO payments (user_id, paypal_subscription_id, amount, status, payment_id, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (payment_id) DO NOTHING`,
            [userId, subscriptionId, amount, 'completed', event.id]
        );

        // Update last payment date
        await query(
            `UPDATE users SET last_payment_date = CURRENT_TIMESTAMP WHERE id = $1`,
            [userId]
        );

        console.log(`✅ Payment recorded for user: ${userId}`);
        return true;

    } catch (error) {
        console.error('❌ Error handling subscription payment completed:', error.message);
        return false;
    }
}

/**
 * Handle subscription payment failed event
 */
async function handleSubscriptionPaymentFailed(event) {
    try {
        const subscriptionId = event.resource.id;
        const customData = event.resource.custom_id;
        const userId = customData;

        console.log(`❌ Payment failed for subscription: ${subscriptionId}`);

        // Create failed payment record
        await query(
            `INSERT INTO payments (user_id, paypal_subscription_id, status, payment_id, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (payment_id) DO NOTHING`,
            [userId, subscriptionId, 'failed', event.id]
        );

        // Update user status
        await query(
            `UPDATE users SET subscription_status = $1 WHERE id = $2`,
            [
                'payment_failed',
                userId
            ]
        );

        console.log(`⚠️ Payment failure recorded for user: ${userId}`);
        return true;

    } catch (error) {
        console.error('❌ Error handling subscription payment failed:', error.message);
        return false;
    }
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(event) {
    try {
        const subscriptionId = event.resource.id;
        const customData = event.resource.custom_id;
        const userId = customData;

        console.log(`🚫 Subscription cancelled: ${subscriptionId}`);

        await query(
            `UPDATE users 
             SET subscription_status = $1,
                 subscription_tier = $2,
                 subscription_ends_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            ['cancelled', 'free', userId]
        );

        // Create audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, created_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            [userId, 'subscription_cancelled']
        );

        console.log(`✅ Subscription cancelled for user: ${userId}`);
        return true;

    } catch (error) {
        console.error('❌ Error handling subscription cancelled:', error.message);
        return false;
    }
}

/**
 * Handle subscription suspended event
 */
async function handleSubscriptionSuspended(event) {
    try {
        const subscriptionId = event.resource.id;
        const customData = event.resource.custom_id;
        const userId = customData;

        console.log(`⏸️ Subscription suspended: ${subscriptionId}`);

        await query(
            `UPDATE users SET subscription_status = $1 WHERE id = $2`,
            ['suspended', userId]
        );

        console.log(`✅ Subscription suspended for user: ${userId}`);
        return true;

    } catch (error) {
        console.error('❌ Error handling subscription suspended:', error.message);
        return false;
    }
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/paypal/webhooks
 * Receive webhook events from PayPal
 */
router.post('/webhooks', async (req, res, next) => {
    try {
        const event = req.body;

        console.log(`📨 Webhook received: ${event.event_type}`);

        // Verify webhook signature
        const isValid = await verifyWebhookSignature(req);
        if (!isValid && process.env.NODE_ENV === 'production') {
            console.warn('⚠️ Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Handle different event types
        let result = true;
        switch (event.event_type) {
            case 'BILLING.SUBSCRIPTION.CREATED':
                result = await handleSubscriptionCreated(event);
                break;
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                result = await handleSubscriptionActivated(event);
                break;
            case 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED':
                result = await handleSubscriptionPaymentCompleted(event);
                break;
            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                result = await handleSubscriptionPaymentFailed(event);
                break;
            case 'BILLING.SUBSCRIPTION.CANCELLED':
                result = await handleSubscriptionCancelled(event);
                break;
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                result = await handleSubscriptionSuspended(event);
                break;
            default:
                console.log(`⚠️ Unhandled event type: ${event.event_type}`);
        }

        // Always return 200 to PayPal to acknowledge receipt
        res.status(200).json({
            success: result,
            event_id: event.id
        });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        // Still return 200 to prevent PayPal retries
        res.status(200).json({
            success: false,
            event_id: req.body?.id || 'unknown',
            error: error.message
        });
    }
});

/**
 * GET /api/paypal/verify-subscription
 * Manual verification of subscription status
 */
router.get('/verify-subscription/:subscriptionId', async (req, res, next) => {
    try {
        const { subscriptionId } = req.params;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'Subscription ID required' });
        }

        // Get subscription details from PayPal
        const subscription = await getSubscriptionDetails(subscriptionId);

        // Determine tier
        let tier = 'pro';
        if (subscription.billing_cycles) {
            const billingCycle = subscription.billing_cycles[0];
            if (billingCycle && billingCycle.pricing_scheme) {
                const amount = parseFloat(billingCycle.pricing_scheme.fixed_price.value);
                if (amount >= 99.99) {
                    tier = 'vip';
                }
            }
        }

        res.json({
            valid: true,
            status: subscription.status,
            tier,
            subscription
        });

    } catch (error) {
        console.error('❌ Subscription verification error:', error);
        res.status(400).json({
            valid: false,
            error: error.message
        });
    }
});

/**
 * POST /api/paypal/sync-payments
 * Sync pending payments from PayPal (admin endpoint)
 */
router.post('/sync-payments', async (req, res, next) => {
    try {
        // Get all users with paypal subscription IDs
        const result = await query(
            `SELECT id, email, paypal_subscription_id, subscription_status
             FROM users
             WHERE paypal_subscription_id IS NOT NULL
             AND subscription_status != 'cancelled'
             LIMIT 100`
        );

        const users = result.rows;
        let synced = 0;
        let errors = 0;

        for (const user of users) {
            try {
                const subscription = await getSubscriptionDetails(user.paypal_subscription_id);

                // Determine tier
                let tier = 'pro';
                if (subscription.billing_cycles) {
                    const billingCycle = subscription.billing_cycles[0];
                    if (billingCycle && billingCycle.pricing_scheme) {
                        const amount = parseFloat(billingCycle.pricing_scheme.fixed_price.value);
                        if (amount >= 99.99) {
                            tier = 'vip';
                        }
                    }
                }

                // Update user subscription status
                await query(
                    `UPDATE users 
                     SET subscription_status = $1,
                         subscription_tier = $2,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [subscription.status, tier, user.id]
                );

                synced++;

            } catch (error) {
                console.error(`Error syncing user ${user.id}:`, error.message);
                errors++;
            }
        }

        res.json({
            synced,
            errors,
            total: users.length
        });

    } catch (error) {
        console.error('❌ Payment sync error:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;
