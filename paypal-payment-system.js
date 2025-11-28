// ============================================
// PAYPAL PAYMENT SYSTEM
// Complete PayPal integration for subscriptions
// ============================================

import { subscriptionNotificationCenter } from './subscription-notification-center.js';
import { paypalEmailReceipts } from './paypal-email-receipts.js';
import { paypalInvoiceGenerator } from './paypal-invoice-generator.js';

export class PayPalPaymentSystem {
    constructor() {
        this.paypalEmail = 'mikewill898@icloud.com';
        this.paypalLoaded = false;
        this.plans = {
            pro: {
                name: 'PRO',
                price: 49.99,
                interval: 'month',
                features: [
                    '10+ AI Coaches',
                    'Advanced Analytics',
                    'Live Odds from 30+ Sportsbooks',
                    'Priority Support',
                    'Export Reports',
                    'Custom Alerts'
                ]
            },
            vip: {
                name: 'VIP',
                price: 99.99,
                interval: 'month',
                features: [
                    'Everything in PRO',
                    'Exclusive AI Models',
                    'Real-time Arbitrage Alerts',
                    'VIP Discord Access',
                    'Personal Strategy Sessions',
                    'Early Feature Access'
                ]
            }
        };
        
        this.init();
    }

    async init() {
        try {
            await this.loadPayPalSDK();
            console.log('✅ PayPal Payment System Initialized');
        } catch (error) {
            console.error('❌ PayPal initialization error:', error);
        }
    }

    /**
     * Load PayPal SDK
     */
    async loadPayPalSDK() {
        if (window.paypal) {
            this.paypalLoaded = true;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://www.paypal.com/sdk/js?client-id=sb&currency=USD&intent=subscription&vault=true';
            script.onload = () => {
                this.paypalLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Create PayPal subscription button
     * @param {string} tier - pro or vip
     * @param {string} containerId - DOM element ID to render button
     */
    async createSubscriptionButton(tier, containerId) {
        if (!this.paypalLoaded) {
            await this.loadPayPalSDK();
        }

        const plan = this.plans[tier.toLowerCase()];
        if (!plan) {
            throw new Error(`Invalid subscription tier: ${tier}`);
        }

        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container not found: ${containerId}`);
        }

        // Clear any existing buttons
        container.innerHTML = '';

        // For now, use PayPal payment links until you set up a business account
        // This allows immediate payment acceptance
        this.createPayPalLink(tier, container);
    }

    /**
     * Create PayPal payment link (works with personal account)
     * @param {string} tier - pro or vip
     * @param {HTMLElement} container - DOM element
     */
    createPayPalLink(tier, container) {
        const plan = this.plans[tier.toLowerCase()];
        
        // Create PayPal.me link for instant payments
        const paypalMeUrl = `https://www.paypal.com/paypalme/mikewill898/${plan.price}`;
        
        const button = document.createElement('button');
        button.className = 'paypal-upgrade-button';
        button.innerHTML = `
            <div class="paypal-button-content">
                <i class="fab fa-paypal"></i>
                <span>Subscribe with PayPal</span>
                <span class="paypal-price">$${plan.price}/mo</span>
            </div>
        `;
        
        button.onclick = async () => {
            await this.handlePayPalUpgrade(tier, paypalMeUrl);
        };
        
        container.appendChild(button);
    }

    /**
     * Handle PayPal upgrade flow
     */
    async handlePayPalUpgrade(tier, paypalUrl) {
        const plan = this.plans[tier.toLowerCase()];
        
        // Show confirmation before redirecting
        const confirmModal = this.showConfirmationModal(plan);
        
        confirmModal.onConfirm = () => {
            // Store pending subscription in localStorage
            const pendingSubscription = {
                tier: tier.toUpperCase(),
                amount: plan.price,
                timestamp: Date.now(),
                status: 'pending'
            };
            localStorage.setItem('pending_subscription', JSON.stringify(pendingSubscription));
            
            // Open PayPal in new window (or same tab on mobile)
            const isMobile = window.innerWidth <= 768;
            const paypalWindow = window.open(paypalUrl, isMobile ? '_self' : '_blank', 'width=600,height=700');
            
            // Start checking for payment completion
            this.startPaymentCheck(tier, paypalWindow);
        };
    }

    /**
     * Show upgrade confirmation modal
     */
    showConfirmationModal(plan) {
        const overlay = document.createElement('div');
        overlay.className = 'paypal-modal-overlay';
        overlay.innerHTML = `
            <div class="paypal-modal">
                <div class="paypal-modal-header">
                    <h2><i class="fab fa-paypal"></i> Confirm Upgrade</h2>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body">
                    <div class="plan-summary">
                        <div class="plan-name">${plan.name} Plan</div>
                        <div class="plan-price">$${plan.price}<span>/month</span></div>
                    </div>
                    
                    <div class="plan-features">
                        <h3>What's Included:</h3>
                        <ul>
                            ${plan.features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="payment-instructions">
                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>Click "Continue to PayPal" below</li>
                            <li>Complete payment on PayPal</li>
                            <li>Return here to activate your subscription</li>
                        </ol>
                        <div class="payment-note">
                            <i class="fas fa-info-circle"></i>
                            After payment, click "I've Completed Payment" to activate your features.
                        </div>
                    </div>
                </div>
                <div class="paypal-modal-footer">
                    <button class="paypal-modal-cancel">Cancel</button>
                    <button class="paypal-modal-confirm">
                        <i class="fab fa-paypal"></i> Continue to PayPal
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const modal = {
            onConfirm: null
        };

        overlay.querySelector('.paypal-modal-close').onclick = () => overlay.remove();
        overlay.querySelector('.paypal-modal-cancel').onclick = () => overlay.remove();
        overlay.querySelector('.paypal-modal-confirm').onclick = () => {
            if (modal.onConfirm) modal.onConfirm();
            overlay.remove();
        };
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        return modal;
    }

    /**
     * Start checking for payment completion
     */
    startPaymentCheck(tier, paypalWindow) {
        const checkInterval = setInterval(() => {
            // Check if PayPal window is closed
            if (paypalWindow && paypalWindow.closed) {
                clearInterval(checkInterval);
                this.showPaymentCompletionDialog(tier);
            }
        }, 1000);

        // Stop checking after 10 minutes
        setTimeout(() => clearInterval(checkInterval), 600000);
    }

    /**
     * Show payment completion confirmation
     */
    showPaymentCompletionDialog(tier) {
        const overlay = document.createElement('div');
        overlay.className = 'paypal-modal-overlay';
        overlay.innerHTML = `
            <div class="paypal-modal payment-check-modal">
                <div class="paypal-modal-header">
                    <h2><i class="fas fa-check-circle"></i> Payment Complete?</h2>
                </div>
                <div class="paypal-modal-body">
                    <p class="payment-check-message">
                        Did you complete your PayPal payment?
                    </p>
                    <div class="payment-check-options">
                        <div class="payment-option">
                            <i class="fas fa-check-circle" style="color: var(--success);"></i>
                            <p>If you completed the payment, click "Yes" to activate your subscription immediately.</p>
                        </div>
                        <div class="payment-option">
                            <i class="fas fa-clock" style="color: var(--warning);"></i>
                            <p>If you're still completing payment, click "Not Yet" and we'll remind you.</p>
                        </div>
                    </div>
                </div>
                <div class="paypal-modal-footer">
                    <button class="paypal-modal-cancel">Not Yet</button>
                    <button class="paypal-modal-confirm payment-confirm-yes">
                        <i class="fas fa-check"></i> Yes, I've Completed Payment
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('.paypal-modal-cancel').onclick = () => {
            overlay.remove();
            this.showPendingPaymentNotice(tier);
        };

        overlay.querySelector('.payment-confirm-yes').onclick = async () => {
            overlay.remove();
            await this.activateSubscription(tier);
        };
    }

    /**
     * Show pending payment notice
     */
    showPendingPaymentNotice(tier) {
        const plan = this.plans[tier.toLowerCase()];
        
        subscriptionNotificationCenter.addNotification({
            category: 'billing',
            status: 'info',
            title: 'Payment Pending',
            message: `Your ${plan.name} upgrade is pending payment completion.`,
            details: {
                'Plan': plan.name,
                'Amount': `$${plan.price}`,
                'Status': 'Awaiting Payment Confirmation'
            },
            icon: '⏳',
            actions: [
                {
                    id: 'complete-payment',
                    label: 'I Completed Payment',
                    callback: () => this.activateSubscription(tier)
                }
            ]
        });
    }

    /**
     * Activate subscription after payment
     */
    async activateSubscription(tier) {
        const plan = this.plans[tier.toLowerCase()];
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        // Update user subscription in localStorage
        const userSubscription = {
            tier: tier.toUpperCase(),
            status: 'active',
            amount: plan.price,
            interval: 'month',
            startDate: new Date().toISOString(),
            nextBillingDate: nextBillingDate.toISOString(),
            paymentMethod: 'PayPal'
        };

        localStorage.setItem('user_subscription', JSON.stringify(userSubscription));
        localStorage.removeItem('pending_subscription');

        // Send receipt email and generate invoice
        try {
            const authUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
            const email = authUser.email || 'user@example.com';
            const name = authUser.name || 'Valued Customer';
            
            // Send receipt email
            await paypalEmailReceipts.sendReceiptEmail({
                tier: tier.toUpperCase(),
                userEmail: email,
                amount: plan.price,
                nextBillingDate: nextBillingDate,
                sessionId: `paypal_${Date.now()}`,
                user: authUser
            });

            // Generate invoice
            const invoice = paypalInvoiceGenerator.generateInvoice({
                id: `paypal_${Date.now()}`,
                tier: tier.toUpperCase(),
                email: email,
                customerName: name,
                amount: plan.price,
                date: new Date().toISOString(),
                status: 'Paid',
                tax: 0,
                notes: 'Thank you for your subscription! Your payment has been processed.'
            });
            
            console.log('✅ Invoice generated:', invoice.invoiceNumber);
        } catch (error) {
            console.warn('Email receipt or invoice generation failed, continuing...');
        }

        // Show success modal
        await this.showSuccessModal(tier, plan, nextBillingDate);

        // Add to notification center
        subscriptionNotificationCenter.addNotification({
            category: 'upgrade',
            status: 'success',
            title: `Welcome to ${plan.name}! 🎉`,
            message: `Your upgrade is confirmed. You now have access to all ${plan.name} features!`,
            details: {
                'Plan': plan.name,
                'Amount': `$${plan.price}`,
                'Billing Period': 'Monthly',
                'Next Billing Date': nextBillingDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                'Payment Method': 'PayPal',
                'Features Unlocked': plan.features.join(', ')
            },
            icon: '⭐',
            actions: [
                {
                    id: 'start-using',
                    label: `Start Using ${plan.name}`,
                    callback: () => {
                        window.dispatchEvent(new CustomEvent('navigate', { 
                            detail: { page: 'coaching' } 
                        }));
                    }
                }
            ]
        });

        // Refresh the page to update UI
        setTimeout(() => window.location.reload(), 2000);
    }

    /**
     * Show success confirmation modal
     */
    async showSuccessModal(tier, plan, nextBillingDate) {
        // Dynamically import the confirmation modal
        try {
            const { subscriptionConfirmationModal } = await import('./subscription-confirmation-modal.js');
            subscriptionConfirmationModal.showConfirmation({
                tier: tier.toUpperCase(),
                amount: plan.price,
                interval: 'month',
                nextBillingDate: nextBillingDate,
                sessionId: `paypal_${Date.now()}`
            });
        } catch (e) {
            // Fallback success message
            alert(`🎉 Welcome to ${plan.name}!\n\nYour subscription is now active.`);
        }
    }

    /**
     * Check subscription status
     */
    getSubscriptionStatus() {
        const subscription = localStorage.getItem('user_subscription');
        if (subscription) {
            return JSON.parse(subscription);
        }
        return null;
    }

    /**
     * Cancel subscription
     */
    cancelSubscription() {
        const subscription = this.getSubscriptionStatus();
        if (subscription) {
            const confirmCancel = confirm(
                `Are you sure you want to cancel your ${subscription.tier} subscription?\n\n` +
                `You'll lose access to premium features at the end of your billing period.`
            );

            if (confirmCancel) {
                localStorage.removeItem('user_subscription');
                
                subscriptionNotificationCenter.addNotification({
                    category: 'billing',
                    status: 'warning',
                    title: 'Subscription Cancelled',
                    message: 'Your subscription has been cancelled. You can resubscribe anytime!',
                    icon: '⚠️'
                });

                setTimeout(() => window.location.reload(), 1500);
            }
        }
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const paypalPaymentSystem = new PayPalPaymentSystem();
