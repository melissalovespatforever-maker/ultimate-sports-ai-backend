// ============================================
// TRANSACTIONAL EMAIL SERVICE
// Password resets, receipts, notifications
// Using Resend API (most buildless-friendly)
// ============================================

const axios = require('axios');

class EmailService {
    constructor() {
        this.apiKey = process.env.RESEND_API_KEY;
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@ultimatesportsai.app';
        this.brandName = 'Ultimate Sports AI';
        this.baseUrl = 'https://api.resend.com';
    }

    /**
     * Check if email service is configured
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(user, resetToken, resetLink) {
        if (!this.isConfigured()) {
            console.warn('⚠️ Email service not configured (RESEND_API_KEY missing)');
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const html = this.getPasswordResetTemplate(user.username, resetLink);
            
            const response = await axios.post(
                `${this.baseUrl}/emails`,
                {
                    from: this.fromEmail,
                    to: user.email,
                    subject: '🔐 Reset Your Ultimate Sports AI Password',
                    html: html
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Password reset email sent to ${user.email}`);
            return {
                success: true,
                messageId: response.data.id,
                email: user.email
            };
        } catch (error) {
            console.error('❌ Failed to send password reset email:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send payment receipt email
     */
    async sendPaymentReceiptEmail(user, paymentData) {
        if (!this.isConfigured()) {
            console.warn('⚠️ Email service not configured (RESEND_API_KEY missing)');
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const html = this.getPaymentReceiptTemplate(user, paymentData);
            
            const response = await axios.post(
                `${this.baseUrl}/emails`,
                {
                    from: this.fromEmail,
                    to: user.email,
                    subject: `🎉 Receipt: Your ${paymentData.plan} Subscription`,
                    html: html
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Payment receipt sent to ${user.email}`);
            return {
                success: true,
                messageId: response.data.id,
                email: user.email
            };
        } catch (error) {
            console.error('❌ Failed to send payment receipt:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send welcome email
     */
    async sendWelcomeEmail(user) {
        if (!this.isConfigured()) {
            console.warn('⚠️ Email service not configured');
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const html = this.getWelcomeTemplate(user.username);
            
            const response = await axios.post(
                `${this.baseUrl}/emails`,
                {
                    from: this.fromEmail,
                    to: user.email,
                    subject: '👋 Welcome to Ultimate Sports AI!',
                    html: html
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Welcome email sent to ${user.email}`);
            return {
                success: true,
                messageId: response.data.id
            };
        } catch (error) {
            console.error('❌ Failed to send welcome email:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send bet settled notification
     */
    async sendBetSettledEmail(user, betData) {
        if (!this.isConfigured()) {
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const isWin = betData.status === 'won';
            const html = this.getBetSettledTemplate(user.username, betData, isWin);
            
            const response = await axios.post(
                `${this.baseUrl}/emails`,
                {
                    from: this.fromEmail,
                    to: user.email,
                    subject: `${isWin ? '🎉' : '😞'} Your bet on ${betData.match} has settled`,
                    html: html
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Bet settled email sent to ${user.email}`);
            return {
                success: true,
                messageId: response.data.id
            };
        } catch (error) {
            console.error('❌ Failed to send bet settled email:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send daily digest email
     */
    async sendDailyDigestEmail(user, digestData) {
        if (!this.isConfigured()) {
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const html = this.getDailyDigestTemplate(user.username, digestData);
            
            const response = await axios.post(
                `${this.baseUrl}/emails`,
                {
                    from: this.fromEmail,
                    to: user.email,
                    subject: '📊 Your Daily Sports AI Digest',
                    html: html
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Daily digest sent to ${user.email}`);
            return {
                success: true,
                messageId: response.data.id
            };
        } catch (error) {
            console.error('❌ Failed to send daily digest:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // EMAIL TEMPLATES
    // ============================================

    getPasswordResetTemplate(username, resetLink) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
            <p>Hi ${username},</p>
            
            <p>We received a request to reset the password associated with this email address.</p>
            
            <p style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            
            <p>Or copy and paste this link in your browser:</p>
            <p style="background: #f0f0f0; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
                ${resetLink}
            </p>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email or contact support.
            </div>
            
            <p>For security, we never send passwords via email. Always reset through our secure link.</p>
            
            <p>Questions? <a href="https://ultimatesportsai.app/support">Contact our support team</a></p>
        </div>
        <div class="footer">
            <p>${this.brandName} • Secure Password Reset</p>
            <p>© 2024 Ultimate Sports AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    getPaymentReceiptTemplate(user, payment) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .receipt-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
        .receipt-table th, .receipt-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        .receipt-table th { background: #f0f0f0; font-weight: 600; }
        .total-row { background: #667eea; color: white; font-size: 18px; font-weight: bold; }
        .total-row td { padding: 16px 12px; }
        .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .features li { margin: 8px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Payment Confirmed</h1>
            <p>Thank you for upgrading to ${payment.plan}!</p>
        </div>
        <div class="content">
            <p>Hi ${user.username},</p>
            
            <p>Your payment has been successfully processed. Here's your receipt:</p>
            
            <table class="receipt-table">
                <tr>
                    <th>Item</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
                <tr>
                    <td>${payment.plan} Subscription (${payment.billingPeriod})</td>
                    <td style="text-align: right;">$${payment.amount.toFixed(2)}</td>
                </tr>
                ${payment.discount ? `<tr><td>Discount</td><td style="text-align: right;">-$${payment.discount.toFixed(2)}</td></tr>` : ''}
                <tr class="total-row">
                    <td><strong>Total</strong></td>
                    <td style="text-align: right;"><strong>$${(payment.amount - (payment.discount || 0)).toFixed(2)}</strong></td>
                </tr>
            </table>
            
            <p><strong>Subscription Details:</strong></p>
            <ul style="line-height: 1.8;">
                <li>Plan: ${payment.plan}</li>
                <li>Billing Cycle: ${payment.billingPeriod}</li>
                <li>Next Billing Date: ${new Date(payment.nextBillingDate).toLocaleDateString()}</li>
                <li>Transaction ID: ${payment.transactionId}</li>
            </ul>
            
            <div class="features">
                <strong>Your ${payment.plan} includes:</strong>
                <ul>
                    ${payment.features.map(f => `<li>✅ ${f}</li>`).join('')}
                </ul>
            </div>
            
            <p>You can manage your subscription in your account settings anytime.</p>
            
            <p>Questions? <a href="https://ultimatesportsai.app/support">Contact support</a> or reply to this email.</p>
        </div>
        <div class="footer">
            <p>${this.brandName} • Payment Receipt</p>
            <p>© 2024 Ultimate Sports AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    getWelcomeTemplate(username) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { background: #f0f0f0; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px auto; text-align: center; }
        .feature-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #667eea; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>👋 Welcome to Ultimate Sports AI!</h1>
            <p>Your AI-powered sports analytics platform</p>
        </div>
        <div class="content">
            <p>Hi ${username},</p>
            
            <p>Welcome aboard! We're thrilled to have you join ${this.brandName}. Get ready to revolutionize your sports betting with AI-powered picks and real-time analytics.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ultimatesportsai.app/dashboard" class="button">Go to Dashboard</a>
            </div>
            
            <p><strong>Getting Started:</strong></p>
            
            <div class="feature-box">
                <strong>🤖 11 AI Coaches</strong><br/>
                Each specializing in different sports and betting strategies
            </div>
            
            <div class="feature-box">
                <strong>📊 Live Analytics</strong><br/>
                Real-time scores, odds, and data for 5 major sports
            </div>
            
            <div class="feature-box">
                <strong>🎯 Bet Tracking</strong><br/>
                Monitor your bets with automatic win/loss grading
            </div>
            
            <div class="feature-box">
                <strong>💎 Three Tiers</strong><br/>
                FREE, PRO ($49.99/mo), or VIP ($99.99/mo)
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
                <li>Complete your profile</li>
                <li>Choose your favorite sports</li>
                <li>View AI coach picks</li>
                <li>Start tracking bets</li>
            </ol>
            
            <p>Questions? Check out our <a href="https://ultimatesportsai.app/help">help center</a> or email <a href="mailto:support@ultimatesportsai.app">support</a>.</p>
        </div>
        <div class="footer">
            <p>© 2024 Ultimate Sports AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    getBetSettledTemplate(username, bet, isWin) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${isWin ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : 'linear-gradient(135deg, #f05454 0%, #e84343 100%)'}; color: white; padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .bet-box { background: white; padding: 20px; border-left: 4px solid ${isWin ? '#4caf50' : '#f05454'}; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isWin ? '🎉 BET WON!' : '😞 Bet Lost'}</h1>
        </div>
        <div class="content">
            <p>Hi ${username},</p>
            
            <p>Your bet has settled!</p>
            
            <div class="bet-box">
                <p><strong>Match:</strong> ${bet.match}</p>
                <p><strong>Your Pick:</strong> ${bet.pick}</p>
                <p><strong>Sport:</strong> ${bet.sport}</p>
                <p><strong>Coach:</strong> ${bet.coach}</p>
                <p><strong>Stake:</strong> $${bet.stake}</p>
                <p><strong>Status:</strong> <span style="color: ${isWin ? '#4caf50' : '#f05454'}; font-weight: bold;">${bet.status.toUpperCase()}</span></p>
                ${isWin ? `<p><strong>Winnings:</strong> <span style="color: #4caf50; font-size: 18px; font-weight: bold;">+$${bet.potentialWin}</span></p>` : ''}
            </div>
            
            <p><a href="https://ultimatesportsai.app/my-bets">View your bet history</a></p>
            
            <p>Keep tracking your bets to see your win rate and profit over time!</p>
        </div>
        <div class="footer">
            <p>${this.brandName} • Bet Settlement Notification</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    getDailyDigestTemplate(username, digest) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .stat-box { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; display: inline-block; width: 48%; margin-right: 2%; vertical-align: top; }
        .pick-card { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 4px; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Digest</h1>
            <p>${new Date().toLocaleDateString()}</p>
        </div>
        <div class="content">
            <p>Hi ${username},</p>
            
            <p><strong>Your Stats Today:</strong></p>
            <div class="stat-box">
                <strong>${digest.betsSettled || 0}</strong><br/>
                Bets Settled
            </div>
            <div class="stat-box">
                <strong>${digest.wins || 0}-${digest.losses || 0}</strong><br/>
                Win/Loss
            </div>
            
            ${digest.profit ? `<p><strong>Profit: <span style="color: ${digest.profit >= 0 ? '#4caf50' : '#f05454'};">$${digest.profit.toFixed(2)}</span></strong></p>` : ''}
            
            ${digest.topPicks && digest.topPicks.length > 0 ? `
                <p><strong>Top Picks Today:</strong></p>
                ${digest.topPicks.map(pick => `
                    <div class="pick-card">
                        ${pick.sport} • ${pick.match}<br/>
                        <strong>${pick.pick}</strong><br/>
                        ${pick.coach} • ${pick.confidence}% confidence
                    </div>
                `).join('')}
            ` : ''}
            
            <p style="text-align: center; margin-top: 30px;">
                <a href="https://ultimatesportsai.app/dashboard" style="color: #667eea; text-decoration: none; font-weight: 600;">View Full Dashboard →</a>
            </p>
        </div>
        <div class="footer">
            <p>${this.brandName} • Daily Digest</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

module.exports = new EmailService();
