/**
 * Push Notifications Backend Routes
 * Handles device registration and push notification sending
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

/**
 * Register device for push notifications
 * POST /api/notifications/register-device
 */
router.post('/register-device', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceToken, platform, deviceInfo } = req.body;

        if (!deviceToken || !platform) {
            return res.status(400).json({
                success: false,
                error: 'Device token and platform are required'
            });
        }

        // Check if device already registered
        const checkQuery = `
            SELECT id FROM push_notification_devices
            WHERE user_id = $1 AND device_token = $2
        `;
        const existing = await pool.query(checkQuery, [userId, deviceToken]);

        if (existing.rows.length > 0) {
            // Update existing device
            const updateQuery = `
                UPDATE push_notification_devices
                SET platform = $1, device_info = $2, updated_at = CURRENT_TIMESTAMP, active = true
                WHERE user_id = $3 AND device_token = $4
                RETURNING *
            `;
            const result = await pool.query(updateQuery, [platform, deviceInfo, userId, deviceToken]);
            
            return res.json({
                success: true,
                message: 'Device updated successfully',
                device: result.rows[0]
            });
        } else {
            // Insert new device
            const insertQuery = `
                INSERT INTO push_notification_devices (user_id, device_token, platform, device_info)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const result = await pool.query(insertQuery, [userId, deviceToken, platform, deviceInfo]);
            
            return res.json({
                success: true,
                message: 'Device registered successfully',
                device: result.rows[0]
            });
        }
    } catch (error) {
        console.error('Register device error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register device'
        });
    }
});

/**
 * Register web push subscription
 * POST /api/notifications/register-web-push
 */
router.post('/register-web-push', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscription, platform } = req.body;

        if (!subscription) {
            return res.status(400).json({
                success: false,
                error: 'Subscription is required'
            });
        }

        const endpoint = subscription.endpoint;

        // Check if subscription already exists
        const checkQuery = `
            SELECT id FROM web_push_subscriptions
            WHERE user_id = $1 AND endpoint = $2
        `;
        const existing = await pool.query(checkQuery, [userId, endpoint]);

        if (existing.rows.length > 0) {
            // Update existing subscription
            const updateQuery = `
                UPDATE web_push_subscriptions
                SET subscription = $1, updated_at = CURRENT_TIMESTAMP, active = true
                WHERE user_id = $2 AND endpoint = $3
                RETURNING *
            `;
            const result = await pool.query(updateQuery, [subscription, userId, endpoint]);
            
            return res.json({
                success: true,
                message: 'Subscription updated successfully',
                subscription: result.rows[0]
            });
        } else {
            // Insert new subscription
            const insertQuery = `
                INSERT INTO web_push_subscriptions (user_id, endpoint, subscription)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            const result = await pool.query(insertQuery, [userId, endpoint, subscription]);
            
            return res.json({
                success: true,
                message: 'Subscription registered successfully',
                subscription: result.rows[0]
            });
        }
    } catch (error) {
        console.error('Register web push error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register web push subscription'
        });
    }
});

/**
 * Unregister device
 * POST /api/notifications/unregister-device
 */
router.post('/unregister-device', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceToken } = req.body;

        if (!deviceToken) {
            return res.status(400).json({
                success: false,
                error: 'Device token is required'
            });
        }

        const query = `
            UPDATE push_notification_devices
            SET active = false, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND device_token = $2
        `;
        await pool.query(query, [userId, deviceToken]);

        res.json({
            success: true,
            message: 'Device unregistered successfully'
        });
    } catch (error) {
        console.error('Unregister device error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unregister device'
        });
    }
});

/**
 * Get user's notification preferences
 * GET /api/notifications/preferences
 */
router.get('/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT * FROM notification_preferences
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            // Create default preferences
            const createQuery = `
                INSERT INTO notification_preferences (user_id)
                VALUES ($1)
                RETURNING *
            `;
            const created = await pool.query(createQuery, [userId]);
            return res.json({
                success: true,
                preferences: created.rows[0]
            });
        }

        res.json({
            success: true,
            preferences: result.rows[0]
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notification preferences'
        });
    }
});

/**
 * Update notification preferences
 * PUT /api/notifications/preferences
 */
router.put('/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            new_picks,
            game_results,
            tournament_updates,
            achievements,
            daily_deals,
            friend_requests,
            challenge_invites,
            marketing
        } = req.body;

        const query = `
            UPDATE notification_preferences
            SET 
                new_picks = COALESCE($1, new_picks),
                game_results = COALESCE($2, game_results),
                tournament_updates = COALESCE($3, tournament_updates),
                achievements = COALESCE($4, achievements),
                daily_deals = COALESCE($5, daily_deals),
                friend_requests = COALESCE($6, friend_requests),
                challenge_invites = COALESCE($7, challenge_invites),
                marketing = COALESCE($8, marketing),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $9
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            new_picks, game_results, tournament_updates, achievements,
            daily_deals, friend_requests, challenge_invites, marketing,
            userId
        ]);

        if (result.rows.length === 0) {
            // Create preferences if they don't exist
            const createQuery = `
                INSERT INTO notification_preferences (
                    user_id, new_picks, game_results, tournament_updates, 
                    achievements, daily_deals, friend_requests, challenge_invites, marketing
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            const created = await pool.query(createQuery, [
                userId, new_picks, game_results, tournament_updates,
                achievements, daily_deals, friend_requests, challenge_invites, marketing
            ]);
            
            return res.json({
                success: true,
                preferences: created.rows[0]
            });
        }

        res.json({
            success: true,
            preferences: result.rows[0]
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notification preferences'
        });
    }
});

/**
 * Send push notification (admin/system use)
 * POST /api/notifications/send
 */
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { userId, title, body, data, type } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({
                success: false,
                error: 'User ID, title, and body are required'
            });
        }

        // Get user's active devices
        const devicesQuery = `
            SELECT device_token, platform
            FROM push_notification_devices
            WHERE user_id = $1 AND active = true
        `;
        const devices = await pool.query(devicesQuery, [userId]);

        if (devices.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No active devices found for user'
            });
        }

        // Check user's notification preferences
        const prefsQuery = `
            SELECT * FROM notification_preferences
            WHERE user_id = $1
        `;
        const prefs = await pool.query(prefsQuery, [userId]);

        if (prefs.rows.length > 0 && type) {
            const preference = prefs.rows[0][type];
            if (preference === false) {
                return res.json({
                    success: true,
                    message: 'User has disabled this notification type',
                    sent: 0
                });
            }
        }

        // Send notifications to all devices
        // Note: Actual push notification sending would be done via:
        // - Apple Push Notification service (APNs) for iOS
        // - Firebase Cloud Messaging (FCM) for Android
        // This is a placeholder for the implementation

        const notificationPayload = {
            title,
            body,
            data: data || {},
            type
        };

        console.log(`Sending push notification to ${devices.rows.length} device(s):`, notificationPayload);

        // Log notification in database
        const logQuery = `
            INSERT INTO push_notification_log (user_id, title, body, data, type, device_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const logged = await pool.query(logQuery, [
            userId, title, body, data, type, devices.rows.length
        ]);

        res.json({
            success: true,
            message: 'Notification sent successfully',
            sent: devices.rows.length,
            notification: logged.rows[0]
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification'
        });
    }
});

module.exports = router;
