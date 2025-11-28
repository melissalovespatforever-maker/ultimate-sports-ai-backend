// ============================================
// PAYPAL PAYMENT UI COMPONENT
// Beautiful payment interface for subscriptions
// ============================================

import { paypalPaymentSystem } from './paypal-payment-system.js';
import { subscriptionNotificationCenter } from './subscription-notification-center.js';

export class PayPalPaymentUI {
    constructor() {
        this.currentSubscription = null;
        this.init();
    }

    async init() {
        await this.checkSubscriptionStatus();
        this.setupEventListeners();
    }

    // ============================================
    // CHECK SUBSCRIPTION STATUS
    // ============================================

    async checkSubscriptionStatus() {
        try {
            this.currentSubscription = paypalPaymentSystem.getSubscriptionStatus();
            console.log('📦 Current Subscription:', this.currentSubscription);
        } catch (error) {
            console.error('❌ Error checking subscription:', error);
        }
    }

    // ============================================
    // SETUP EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Listen for upgrade button clicks
        document.addEventListener('click', (e) => {
            // Main upgrade button (shows pricing modal)
            if (e.target.closest('.payment-upgrade-btn') || 
                e.target.closest('#payment-upgrade-btn')) {
                e.preventDefault();
                this.showPricingModal();
                return;
            }

            // PRO upgrade buttons
            if (e.target.closest('.upgrade-pro-btn') || 
                e.target.closest('[data-upgrade="pro"]') ||
                e.target.closest('.upgrade-button-header')) {
                e.preventDefault();
                this.handleProUpgrade();
            }

            // VIP upgrade buttons
            if (e.target.closest('.upgrade-vip-btn') || 
                e.target.closest('[data-upgrade="vip"]')) {
                e.preventDefault();
                this.handleVipUpgrade();
            }

            // Manage subscription
            if (e.target.closest('.manage-subscription-btn')) {
                e.preventDefault();
                this.showManageSubscriptionModal();
            }
        });

        // Check for pending subscriptions on load
        this.checkPendingSubscription();
    }

    // ============================================
    // SHOW PRICING MODAL
    // ============================================

    showPricingModal() {
        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay';
        modal.innerHTML = `
            <div class="paypal-modal pricing-modal">
                <div class="paypal-modal-header">
                    <h2><i class="fas fa-crown"></i> Upgrade Your Account</h2>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body">
                    <div class="pricing-plans">
                        <div class="pricing-plan">
                            <div class="plan-header">
                                <h3>PRO</h3>
                                <div class="plan-price">$49.99<span>/mo</span></div>
                            </div>
                            <ul class="plan-features">
                                <li><i class="fas fa-check"></i> 10+ AI Coaches</li>
                                <li><i class="fas fa-check"></i> Advanced Analytics</li>
                                <li><i class="fas fa-check"></i> Live Odds from 30+ Sportsbooks</li>
                                <li><i class="fas fa-check"></i> Priority Support</li>
                                <li><i class="fas fa-check"></i> Export Reports</li>
                                <li><i class="fas fa-check"></i> Custom Alerts</li>
                            </ul>
                            <button class="pricing-select-btn" data-plan="pro">
                                <i class="fab fa-paypal"></i> Select PRO
                            </button>
                        </div>
                        
                        <div class="pricing-plan featured">
                            <div class="featured-badge">BEST VALUE</div>
                            <div class="plan-header">
                                <h3>VIP</h3>
                                <div class="plan-price">$99.99<span>/mo</span></div>
                            </div>
                            <ul class="plan-features">
                                <li><i class="fas fa-check"></i> Everything in PRO</li>
                                <li><i class="fas fa-check"></i> Exclusive AI Models</li>
                                <li><i class="fas fa-check"></i> Real-time Arbitrage Alerts</li>
                                <li><i class="fas fa-check"></i> VIP Discord Access</li>
                                <li><i class="fas fa-check"></i> Personal Strategy Sessions</li>
                                <li><i class="fas fa-check"></i> Early Feature Access</li>
                            </ul>
                            <button class="pricing-select-btn" data-plan="vip">
                                <i class="fab fa-paypal"></i> Select VIP
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup handlers
        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        // Plan selection handlers
        modal.querySelectorAll('.pricing-select-btn').forEach(btn => {
            btn.onclick = () => {
                const plan = btn.dataset.plan;
                modal.remove();
                if (plan === 'pro') {
                    this.handleProUpgrade();
                } else {
                    this.handleVipUpgrade();
                }
            };
        });
    }

    // ============================================
    // HANDLE PRO UPGRADE
    // ============================================

    async handleProUpgrade() {
        try {
            // Check if already subscribed
            if (this.currentSubscription?.tier === 'PRO') {
                alert('You\'re already on the PRO plan!');
                return;
            }

            if (this.currentSubscription?.tier === 'VIP') {
                alert('You\'re already on the VIP plan (which includes all PRO features)!');
                return;
            }

            // Create temporary container for button
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'paypal-modal-overlay';
            modalOverlay.innerHTML = `
                <div class="paypal-modal">
                    <div class="paypal-modal-header">
                        <h2>Upgrade to PRO</h2>
                        <button class="paypal-modal-close">&times;</button>
                    </div>
                    <div class="paypal-modal-body">
                        <div id="paypal-button-pro"></div>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            // Setup close handlers
            modalOverlay.querySelector('.paypal-modal-close').onclick = () => modalOverlay.remove();
            modalOverlay.onclick = (e) => {
                if (e.target === modalOverlay) modalOverlay.remove();
            };

            // Create PayPal button
            await paypalPaymentSystem.createSubscriptionButton('pro', 'paypal-button-pro');

        } catch (error) {
            console.error('❌ Error starting PRO upgrade:', error);
            alert('Error starting upgrade. Please try again.');
        }
    }

    // ============================================
    // HANDLE VIP UPGRADE
    // ============================================

    async handleVipUpgrade() {
        try {
            // Check if already subscribed
            if (this.currentSubscription?.tier === 'VIP') {
                alert('You\'re already on the VIP plan!');
                return;
            }

            // Create temporary container for button
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'paypal-modal-overlay';
            modalOverlay.innerHTML = `
                <div class="paypal-modal">
                    <div class="paypal-modal-header">
                        <h2>Upgrade to VIP</h2>
                        <button class="paypal-modal-close">&times;</button>
                    </div>
                    <div class="paypal-modal-body">
                        <div id="paypal-button-vip"></div>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            // Setup close handlers
            modalOverlay.querySelector('.paypal-modal-close').onclick = () => modalOverlay.remove();
            modalOverlay.onclick = (e) => {
                if (e.target === modalOverlay) modalOverlay.remove();
            };

            // Create PayPal button
            await paypalPaymentSystem.createSubscriptionButton('vip', 'paypal-button-vip');

        } catch (error) {
            console.error('❌ Error starting VIP upgrade:', error);
            alert('Error starting upgrade. Please try again.');
        }
    }

    // ============================================
    // CHECK PENDING SUBSCRIPTION
    // ============================================

    checkPendingSubscription() {
        const pending = localStorage.getItem('pending_subscription');
        if (pending) {
            try {
                const subscription = JSON.parse(pending);
                const timeSince = Date.now() - subscription.timestamp;
                
                // If less than 30 minutes old, show reminder
                if (timeSince < 1800000) {
                    setTimeout(() => {
                        this.showPendingPaymentReminder(subscription);
                    }, 2000);
                }
            } catch (error) {
                console.error('Error checking pending subscription:', error);
            }
        }
    }

    // ============================================
    // SHOW PENDING PAYMENT REMINDER
    // ============================================

    showPendingPaymentReminder(subscription) {
        const reminder = document.createElement('div');
        reminder.className = 'pending-payment-reminder';
        reminder.innerHTML = `
            <div class="reminder-content">
                <i class="fas fa-clock"></i>
                <div class="reminder-text">
                    <strong>Pending ${subscription.tier} Upgrade</strong>
                    <p>Complete your payment to activate premium features</p>
                </div>
                <button class="reminder-complete">Complete Now</button>
                <button class="reminder-dismiss">&times;</button>
            </div>
        `;

        document.body.appendChild(reminder);

        reminder.querySelector('.reminder-complete').onclick = () => {
            paypalPaymentSystem.showPaymentCompletionDialog(subscription.tier.toLowerCase());
            reminder.remove();
        };

        reminder.querySelector('.reminder-dismiss').onclick = () => {
            reminder.remove();
        };
    }

    // ============================================
    // SHOW MANAGE SUBSCRIPTION MODAL
    // ============================================

    showManageSubscriptionModal() {
        if (!this.currentSubscription) {
            alert('You don\'t have an active subscription.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay';
        modal.innerHTML = `
            <div class="paypal-modal">
                <div class="paypal-modal-header">
                    <h2>Manage Subscription</h2>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body">
                    <div class="subscription-details">
                        <div class="detail-row">
                            <span class="detail-label">Current Plan</span>
                            <span class="detail-value">${this.currentSubscription.tier}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value status-${this.currentSubscription.status}">
                                ${this.currentSubscription.status}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Amount</span>
                            <span class="detail-value">$${this.currentSubscription.amount}/mo</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Next Billing</span>
                            <span class="detail-value">
                                ${new Date(this.currentSubscription.nextBillingDate).toLocaleDateString()}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Payment Method</span>
                            <span class="detail-value">
                                <i class="fab fa-paypal"></i> PayPal
                            </span>
                        </div>
                    </div>
                    
                    <div class="subscription-actions">
                        <button class="action-button view-history">
                            <i class="fas fa-history"></i> View History
                        </button>
                        <button class="action-button cancel-subscription">
                            <i class="fas fa-times-circle"></i> Cancel Subscription
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup handlers
        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        modal.querySelector('.view-history').onclick = () => {
            modal.remove();
            subscriptionNotificationCenter.open();
        };

        modal.querySelector('.cancel-subscription').onclick = () => {
            modal.remove();
            paypalPaymentSystem.cancelSubscription();
        };
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const paypalPaymentUI = new PayPalPaymentUI();
