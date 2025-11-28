// ============================================
// PAYPAL EMAIL RECEIPTS SYSTEM
// Beautiful, customizable email receipts for PayPal payments
// ============================================

export class PayPalEmailReceipts {
    constructor() {
        this.apiUrl = window.APP_CONFIG?.API?.BASE_URL || 'http://localhost:3001';
        this.receiptsConfig = this.initializeConfig();
        this.emailQueue = [];
        this.sentReceipts = new Map();
    }

    /**
     * Initialize receipt configuration
     */
    initializeConfig() {
        return {
            sender: {
                email: 'mikewill898@icloud.com',
                name: 'Ultimate Sports AI',
                logo: 'https://play.rosebud.ai/assets/Ultimate sports logo match app layout.png?lZrN'
            },
            branding: {
                primaryColor: '#0070ba',
                accentColor: '#10b981',
                companyName: 'Ultimate Sports AI',
                supportEmail: 'mikewill898@icloud.com',
                website: 'https://ultimate-sports-ai.com'
            },
            templates: {
                pro: this.getProTemplate(),
                vip: this.getVIPTemplate()
            }
        };
    }

    /**
     * Get PRO plan email template
     */
    getProTemplate() {
        return {
            subject: '🎉 Welcome to Ultimate Sports AI PRO - Your Receipt',
            preheader: 'Your upgrade is confirmed! Check your PRO features now.',
            highlights: [
                '10+ AI Coaches',
                'Advanced Analytics',
                'Live Odds from 30+ Sportsbooks'
            ],
            ctaText: 'Start Using PRO',
            ctaLink: '/coaching',
            color: '#0070ba'
        };
    }

    /**
     * Get VIP plan email template
     */
    getVIPTemplate() {
        return {
            subject: '👑 Welcome to Ultimate Sports AI VIP - Your Receipt',
            preheader: 'You\'re now a VIP member! Exclusive features await.',
            highlights: [
                'Everything in PRO',
                'Exclusive AI Models',
                'Real-time Arbitrage Alerts'
            ],
            ctaText: 'Explore VIP Features',
            ctaLink: '/coaching',
            color: '#ffd700'
        };
    }

    /**
     * Send receipt email
     */
    async sendReceiptEmail(paymentData) {
        try {
            const emailContent = this.generateReceiptHTML(paymentData);
            const emailPayload = {
                to: paymentData.userEmail,
                subject: this.receiptsConfig.templates[paymentData.tier.toLowerCase()].subject,
                html: emailContent,
                tier: paymentData.tier,
                amount: paymentData.amount,
                transactionId: paymentData.sessionId,
                timestamp: new Date().toISOString()
            };

            // Try to send via backend API
            try {
                const response = await fetch(`${this.apiUrl}/api/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify(emailPayload)
                });

                if (response.ok) {
                    console.log('✅ Receipt email sent successfully');
                    this.sentReceipts.set(paymentData.sessionId, emailPayload);
                    return { success: true, method: 'backend' };
                }
            } catch (error) {
                console.warn('Backend email failed, using fallback...');
            }

            // Fallback: Store locally and show download option
            this.storeReceiptLocally(paymentData, emailContent);
            return { success: true, method: 'local' };

        } catch (error) {
            console.error('❌ Error sending receipt email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate HTML receipt email
     */
    generateReceiptHTML(paymentData) {
        const template = this.receiptsConfig.templates[paymentData.tier.toLowerCase()];
        const nextBillingDate = paymentData.nextBillingDate || 
            new Date(new Date().setMonth(new Date().getMonth() + 1));

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.subject}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            color: #333;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }
        
        .email-header {
            background: linear-gradient(135deg, ${template.color} 0%, #1546a0 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .logo {
            width: 60px;
            height: 60px;
            margin-bottom: 20px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.1);
            padding: 10px;
        }
        
        .logo img {
            width: 100%;
            height: 100%;
            border-radius: 8px;
        }
        
        .header-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 500;
        }
        
        .email-body {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 24px;
            color: #1f2937;
        }
        
        .receipt-card {
            background: #f9fafb;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
        }
        
        .receipt-title {
            font-size: 14px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
        }
        
        .receipt-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
        }
        
        .receipt-item:last-child {
            border-bottom: none;
        }
        
        .receipt-item-label {
            font-weight: 500;
        }
        
        .receipt-item-value {
            font-weight: 700;
            color: #1f2937;
        }
        
        .receipt-item.total {
            background: linear-gradient(135deg, rgba(${this.hexToRgb(template.color)}, 0.1) 0%, rgba(21, 70, 160, 0.1) 100%);
            padding: 16px;
            border-radius: 8px;
            margin-top: 12px;
            border: none !important;
        }
        
        .receipt-item.total .receipt-item-label {
            color: #1f2937;
        }
        
        .receipt-item.total .receipt-item-value {
            color: ${template.color};
            font-size: 20px;
        }
        
        .highlights {
            background: #f0f9ff;
            border-left: 4px solid ${template.color};
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        
        .highlights-title {
            font-size: 16px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 12px;
        }
        
        .highlights-list {
            list-style: none;
        }
        
        .highlights-list li {
            padding: 8px 0;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .highlights-list li:before {
            content: '✓';
            color: #10b981;
            font-weight: 700;
            font-size: 18px;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, ${template.color} 0%, #1546a0 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 24px;
            transition: all 0.3s ease;
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 112, 186, 0.3);
        }
        
        .info-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            color: #92400e;
        }
        
        .info-box-title {
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .info-box-text {
            font-size: 14px;
            line-height: 1.6;
        }
        
        .email-footer {
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            padding: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        
        .footer-links {
            margin: 20px 0;
        }
        
        .footer-links a {
            color: ${template.color};
            text-decoration: none;
            margin: 0 15px;
            font-weight: 500;
        }
        
        .footer-text {
            font-size: 12px;
            color: #9ca3af;
            line-height: 1.6;
        }
        
        @media (max-width: 600px) {
            .email-header {
                padding: 30px 20px;
            }
            
            .email-body {
                padding: 30px 20px;
            }
            
            .email-footer {
                padding: 20px;
            }
            
            .header-title {
                font-size: 24px;
            }
            
            .greeting {
                font-size: 16px;
            }
            
            .footer-links a {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="email-header">
            <div class="logo">
                <img src="${this.receiptsConfig.sender.logo}" alt="Logo">
            </div>
            <div class="header-title">${paymentData.tier} Upgrade Confirmed!</div>
            <div class="header-subtitle">Your premium features are ready</div>
        </div>
        
        <!-- Body -->
        <div class="email-body">
            <div class="greeting">Hello ${paymentData.user?.username || 'Champion'},</div>
            
            <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                Thank you for upgrading to ${paymentData.tier}! Your payment has been confirmed and you now have instant access to all premium features.
            </p>
            
            <!-- Receipt Card -->
            <div class="receipt-card">
                <div class="receipt-title">Order Summary</div>
                <div class="receipt-item">
                    <span class="receipt-item-label">Plan</span>
                    <span class="receipt-item-value">${paymentData.tier}</span>
                </div>
                <div class="receipt-item">
                    <span class="receipt-item-label">Billing Period</span>
                    <span class="receipt-item-value">Monthly</span>
                </div>
                <div class="receipt-item">
                    <span class="receipt-item-label">Billing Date</span>
                    <span class="receipt-item-value">${new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</span>
                </div>
                <div class="receipt-item">
                    <span class="receipt-item-label">Next Billing</span>
                    <span class="receipt-item-value">${nextBillingDate.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</span>
                </div>
                <div class="receipt-item total">
                    <span class="receipt-item-label">Amount</span>
                    <span class="receipt-item-value">$${paymentData.amount.toFixed(2)}</span>
                </div>
            </div>
            
            <!-- Highlights -->
            <div class="highlights">
                <div class="highlights-title">What's Included:</div>
                <ul class="highlights-list">
                    ${template.highlights.map(h => `<li>${h}</li>`).join('')}
                </ul>
            </div>
            
            <!-- Info Box -->
            <div class="info-box">
                <div class="info-box-title">💡 Getting Started</div>
                <div class="info-box-text">
                    Your ${paymentData.tier} features are now active! Head to the app to explore your premium capabilities and maximize your sports analytics skills.
                </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${this.receiptsConfig.branding.website}${template.ctaLink}" class="cta-button">
                    ${template.ctaText}
                </a>
            </div>
            
            <!-- Cancellation Info -->
            <div class="info-box" style="background: #fecaca; border-left-color: #ef4444; color: #7f1d1d;">
                <div class="info-box-title">📋 Subscription Details</div>
                <div class="info-box-text">
                    You can manage or cancel your subscription anytime from your account settings. No questions asked!
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <div class="footer-links">
                <a href="${this.receiptsConfig.branding.website}">Visit Website</a>
                <a href="mailto:${this.receiptsConfig.branding.supportEmail}">Contact Support</a>
                <a href="${this.receiptsConfig.branding.website}/account">Manage Account</a>
            </div>
            <div class="footer-text">
                <p>Transaction ID: ${paymentData.sessionId}</p>
                <p>© ${new Date().getFullYear()} ${this.receiptsConfig.branding.companyName}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Convert hex color to RGB (for use in CSS rgba)
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 112, 186';
    }

    /**
     * Store receipt locally and show download option
     */
    storeReceiptLocally(paymentData, htmlContent) {
        const receipt = {
            id: paymentData.sessionId,
            tier: paymentData.tier,
            amount: paymentData.amount,
            email: paymentData.userEmail,
            date: new Date().toISOString(),
            html: htmlContent
        };

        // Store in localStorage
        const receipts = JSON.parse(localStorage.getItem('paypal_receipts') || '[]');
        receipts.push(receipt);
        localStorage.setItem('paypal_receipts', JSON.stringify(receipts));

        this.sentReceipts.set(paymentData.sessionId, receipt);
        console.log('✅ Receipt stored locally');

        return receipt;
    }

    /**
     * Get stored receipts
     */
    getStoredReceipts() {
        return JSON.parse(localStorage.getItem('paypal_receipts') || '[]');
    }

    /**
     * Download receipt as HTML file
     */
    downloadReceipt(receiptId) {
        const receipt = this.sentReceipts.get(receiptId) || 
            this.getStoredReceipts().find(r => r.id === receiptId);

        if (!receipt) {
            console.error('Receipt not found');
            return;
        }

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(receipt.html));
        element.setAttribute('download', `receipt-${receipt.tier}-${receiptId}.html`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        console.log('✅ Receipt downloaded');
    }

    /**
     * Print receipt
     */
    printReceipt(receiptId) {
        const receipt = this.sentReceipts.get(receiptId) || 
            this.getStoredReceipts().find(r => r.id === receiptId);

        if (!receipt) {
            console.error('Receipt not found');
            return;
        }

        const printWindow = window.open('', '', 'height=800,width=900');
        printWindow.document.write(receipt.html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();

        console.log('✅ Receipt printed');
    }

    /**
     * Send receipt via email (manual)
     */
    async resendReceipt(receiptId, newEmail) {
        const receipt = this.sentReceipts.get(receiptId) || 
            this.getStoredReceipts().find(r => r.id === receiptId);

        if (!receipt) {
            console.error('Receipt not found');
            return { success: false };
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    to: newEmail || receipt.email,
                    subject: receipt.html.match(/<title>(.*?)<\/title>/)?.[1] || 'Your Receipt',
                    html: receipt.html
                })
            });

            if (response.ok) {
                console.log('✅ Receipt resent successfully');
                return { success: true };
            }
        } catch (error) {
            console.warn('Could not resend via email');
        }

        return { success: false };
    }

    /**
     * Customize branding
     */
    customizeBranding(options) {
        this.receiptsConfig.branding = {
            ...this.receiptsConfig.branding,
            ...options
        };
        console.log('✅ Branding customized');
    }

    /**
     * Customize email templates
     */
    customizeTemplate(tier, templateOptions) {
        const tierLower = tier.toLowerCase();
        if (this.receiptsConfig.templates[tierLower]) {
            this.receiptsConfig.templates[tierLower] = {
                ...this.receiptsConfig.templates[tierLower],
                ...templateOptions
            };
            console.log(`✅ ${tier} template customized`);
        }
    }

    /**
     * Get receipt preview
     */
    getReceiptPreview(tier) {
        const sampleData = {
            tier: tier.toUpperCase(),
            userEmail: 'user@example.com',
            amount: tier.toLowerCase() === 'pro' ? 49.99 : 99.99,
            sessionId: `preview_${Date.now()}`,
            nextBillingDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            user: { username: 'John' }
        };

        return this.generateReceiptHTML(sampleData);
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const paypalEmailReceipts = new PayPalEmailReceipts();
