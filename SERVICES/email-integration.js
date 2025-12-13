// ============================================
// EMAIL INTEGRATION HELPERS
// Handle sending emails with logging
// ============================================

const pool = require('../config/database');
const emailService = require('./email-service');

class EmailIntegration {
    /**
     * Send payment receipt and log it
     */
    static async sendPaymentReceipt(userId, paymentData) {
        try {
            // Get user
            const userResult = await pool.query(
                'SELECT id, username, email FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                console.error(`❌ User ${userId} not found for receipt email`);
                return { success: false, error: 'User not found' };
            }

            const user = userResult.rows[0];

            // Check user preferences
            const prefsResult = await pool.query(
                'SELECT payment_receipts FROM email_preferences WHERE user_id = $1',
                [userId]
            );

            if (prefsResult.rows.length > 0 && !prefsResult.rows[0].payment_receipts) {
                console.log(`ℹ️ User ${userId} has disabled payment receipts`);
                return { success: true, message: 'User disabled payment receipts' };
            }

            // Send email
            const emailResult = await emailService.sendPaymentReceiptEmail(user, paymentData);

            // Log email
            await pool.query(
                `INSERT INTO email_log (user_id, email_address, email_type, subject, status, resend_message_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    userId,
                    user.email,
                    'receipt',
                    `Payment Receipt: ${paymentData.plan}`,
                    emailResult.success ? 'sent' : 'failed',
                    emailResult.messageId || null,
                    JSON.stringify(paymentData)
                ]
            );

            // Update payment receipt record
            if (paymentData.transactionId) {
                await pool.query(
                    `UPDATE payment_receipts 
                     SET email_sent = true, email_sent_at = NOW(), resend_message_id = $1
                     WHERE transaction_id = $2`,
                    [emailResult.messageId || null, paymentData.transactionId]
                );
            }

            if (emailResult.success) {
                console.log(`✅ Payment receipt email sent to ${user.email}`);
            }

            return emailResult;

        } catch (error) {
            console.error('❌ Error in sendPaymentReceipt:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send bet settled notification
     */
    static async sendBetSettledEmail(userId, betData) {
        try {
            // Get user
            const userResult = await pool.query(
                'SELECT id, username, email FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const user = userResult.rows[0];

            // Check preferences
            const prefsResult = await pool.query(
                'SELECT bet_notifications FROM email_preferences WHERE user_id = $1',
                [userId]
            );

            if (prefsResult.rows.length > 0 && !prefsResult.rows[0].bet_notifications) {
                return { success: true, message: 'User disabled bet notifications' };
            }

            // Send email
            const emailResult = await emailService.sendBetSettledEmail(user, betData);

            // Log email
            await pool.query(
                `INSERT INTO email_log (user_id, email_address, email_type, subject, status, resend_message_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    userId,
                    user.email,
                    'bet_settled',
                    `Bet ${betData.status}: ${betData.match}`,
                    emailResult.success ? 'sent' : 'failed',
                    emailResult.messageId || null,
                    JSON.stringify(betData)
                ]
            );

            return emailResult;

        } catch (error) {
            console.error('❌ Error in sendBetSettledEmail:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send welcome email
     */
    static async sendWelcomeEmail(userId) {
        try {
            const userResult = await pool.query(
                'SELECT id, username, email FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const user = userResult.rows[0];

            // Send email
            const emailResult = await emailService.sendWelcomeEmail(user);

            // Log email
            await pool.query(
                `INSERT INTO email_log (user_id, email_address, email_type, subject, status, resend_message_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    userId,
                    user.email,
                    'welcome',
                    'Welcome to Ultimate Sports AI!',
                    emailResult.success ? 'sent' : 'failed',
                    emailResult.messageId || null
                ]
            );

            return emailResult;

        } catch (error) {
            console.error('❌ Error in sendWelcomeEmail:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send daily digest
     */
    static async sendDailyDigest(userId, digestData) {
        try {
            const userResult = await pool.query(
                'SELECT id, username, email FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const user = userResult.rows[0];

            // Check preferences
            const prefsResult = await pool.query(
                `SELECT daily_digest, digest_frequency FROM email_preferences WHERE user_id = $1`,
                [userId]
            );

            if (prefsResult.rows.length > 0) {
                if (!prefsResult.rows[0].daily_digest) {
                    return { success: true, message: 'User disabled daily digest' };
                }

                const freq = prefsResult.rows[0].digest_frequency;
                if (freq !== 'daily') {
                    return { success: true, message: `User has digest set to ${freq}` };
                }
            }

            // Send email
            const emailResult = await emailService.sendDailyDigestEmail(user, digestData);

            // Log email
            await pool.query(
                `INSERT INTO email_log (user_id, email_address, email_type, subject, status, resend_message_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    userId,
                    user.email,
                    'digest',
                    'Your Daily Sports AI Digest',
                    emailResult.success ? 'sent' : 'failed',
                    emailResult.messageId || null,
                    JSON.stringify(digestData)
                ]
            );

            // Update last sent time
            await pool.query(
                'UPDATE email_preferences SET last_digest_sent = NOW() WHERE user_id = $1',
                [userId]
            );

            return emailResult;

        } catch (error) {
            console.error('❌ Error in sendDailyDigest:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Log email error
     */
    static async logEmailError(userId, emailAddress, emailType, error) {
        try {
            await pool.query(
                `INSERT INTO email_log (user_id, email_address, email_type, subject, status, error_message)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [userId, emailAddress, emailType, emailType, 'failed', error.message || error]
            );
        } catch (err) {
            console.error('❌ Failed to log email error:', err);
        }
    }

    /**
     * Get email statistics for user
     */
    static async getUserEmailStats(userId) {
        try {
            const result = await pool.query(
                `SELECT 
                    email_type,
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
                 FROM email_log
                 WHERE user_id = $1
                 GROUP BY email_type
                 ORDER BY email_type`,
                [userId]
            );

            return {
                success: true,
                stats: result.rows
            };
        } catch (error) {
            console.error('❌ Error getting email stats:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailIntegration;
