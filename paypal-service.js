// ============================================
// PAYPAL SERVICE
// Handle PayPal subscriptions and payments
// Free, PRO ($49.99/mo), VIP ($99.99/mo)
// ============================================

const PayPalService = {
    paypalEmail: 'mikewill898@icloud.com',
    paypalMeUsername: 'mikewill898',
    
    plans: {
        FREE: {
            id: 'free',
            name: 'FREE',
            price: 0,
            features: [
                '3 picks per day',
                'Basic analytics',
                'Live odds viewing',
                'Community access'
            ],
            limits: {
                picksPerDay: 3,
                aiCoaches: 0,
                parlayBuilder: false,
                arbitrage: false
            }
        },
        PRO: {
            id: 'pro',
            name: 'PRO',
            price: 49.99,
            paypalMeUrl: 'https://www.paypal.com/paypalme/mikewill898/49.99',
            features: [
                'Unlimited picks',
                '10+ AI Coaches',
                'Advanced analytics',
                'Live odds from 30+ sportsbooks',
                'Parlay builder',
                'Export reports',
                'Priority support'
            ],
            limits: {
                picksPerDay: -1, // Unlimited
                aiCoaches: 3,
                parlayBuilder: true,
                arbitrage: false
            }
        },
        VIP: {
            id: 'vip',
            name: 'VIP',
            price: 99.99,
            paypalMeUrl: 'https://www.paypal.com/paypalme/mikewill898/99.99',
            features: [
                'Everything in PRO',
                'Exclusive AI models',
                'Real-time arbitrage alerts',
                'VIP Discord access',
                'Personal strategy sessions',
                'API access',
                'Early feature access',
                'White-glove support'
            ],
            limits: {
                picksPerDay: -1,
                aiCoaches: 6,
                parlayBuilder: true,
                arbitrage: true
            }
        }
    },
    
    currentTier: 'FREE',
    
    init() {
        console.log('💰 PayPal Service initialized');
        this.loadUserTier();
        this.loadPayPalSDK();
    },
    
    loadUserTier() {
        // Get user tier from backend or localStorage
        const user = window.AuthService?.getUser?.();
        if (user && user.subscription_tier) {
            this.currentTier = user.subscription_tier.toUpperCase();
        } else {
            this.currentTier = localStorage.getItem('user_tier') || 'FREE';
        }
        console.log('👤 User tier:', this.currentTier);
    },
    
    loadPayPalSDK() {
        // Load PayPal SDK (using sandbox for now)
        if (!document.getElementById('paypal-sdk')) {
            const script = document.createElement('script');
            script.id = 'paypal-sdk';
            script.src = 'https://www.paypal.com/sdk/js?client-id=sb&currency=USD&intent=subscription&vault=true';
            script.onload = () => {
                console.log('✅ PayPal SDK loaded');
            };
            script.onerror = () => {
                console.error('❌ Failed to load PayPal SDK');
            };
            document.head.appendChild(script);
        }
    },
    
    getTier() {
        return this.currentTier;
    },
    
    getPlanDetails(tier) {
        return this.plans[tier.toUpperCase()] || this.plans.FREE;
    },
    
    canAccessFeature(feature) {
        const plan = this.plans[this.currentTier];
        return plan.limits[feature] !== false && plan.limits[feature] !== 0;
    },
    
    getRemainingPicks() {
        const plan = this.plans[this.currentTier];
        
        if (plan.limits.picksPerDay === -1) {
            return -1; // Unlimited
        }
        
        // Get today's picks count from localStorage
        const today = new Date().toDateString();
        const picksToday = this.getPicksToday();
        
        return Math.max(0, plan.limits.picksPerDay - picksToday.length);
    },
    
    getPicksToday() {
        const today = new Date().toDateString();
        const allPicks = JSON.parse(localStorage.getItem('picks_history') || '[]');
        return allPicks.filter(p => new Date(p.created_at).toDateString() === today);
    },
    
    canPlacePick() {
        const remaining = this.getRemainingPicks();
        return remaining === -1 || remaining > 0;
    },
    
    async createSubscription(tier) {
        const plan = this.plans[tier.toUpperCase()];
        
        if (!plan || tier === 'FREE') {
            console.error('Invalid plan or already free');
            return false;
        }
        
        if (!window.paypal) {
            console.error('PayPal SDK not loaded');
            alert('PayPal is loading, please try again in a moment.');
            return false;
        }
        
        // Show PayPal button modal
        this.showPayPalModal(tier);
        
        return true;
    },
    
    showPayPalModal(tier) {
        const plan = this.plans[tier.toUpperCase()];
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'paypal-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        margin: 0 auto 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 40px;
                        color: white;
                    ">
                        <i class="fas fa-crown"></i>
                    </div>
                    <h2 style="font-size: 28px; font-weight: 800; margin: 0 0 8px 0;">
                        Upgrade to ${plan.name}
                    </h2>
                    <div style="font-size: 36px; font-weight: 800; color: #10b981; margin-bottom: 8px;">
                        $${plan.price}<span style="font-size: 18px; color: #6b7280;">/month</span>
                    </div>
                </div>
                
                <!-- Features -->
                <div style="margin-bottom: 32px;">
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #374151;">
                        What's included:
                    </h3>
                    ${plan.features.map(feature => `
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            margin-bottom: 12px;
                            padding: 12px;
                            background: #f9fafb;
                            border-radius: 8px;
                        ">
                            <i class="fas fa-check-circle" style="color: #10b981; font-size: 20px;"></i>
                            <span style="font-size: 15px; color: #374151;">${feature}</span>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Payment Instructions -->
                <div style="
                    background: #f0f9ff;
                    border: 2px solid #3b82f6;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                ">
                    <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px;">
                        <i class="fas fa-info-circle"></i> Next Steps:
                    </h4>
                    <ol style="margin: 0; padding-left: 20px; color: #374151;">
                        <li style="margin-bottom: 8px;">Click "Pay with PayPal" below</li>
                        <li style="margin-bottom: 8px;">Complete payment on PayPal</li>
                        <li style="margin-bottom: 8px;">Return here to confirm payment</li>
                        <li>Your features will activate instantly!</li>
                    </ol>
                </div>
                
                <!-- PayPal Button -->
                <button onclick="window.PayPalService.handlePayPalPayment('${tier}')" style="
                    width: 100%;
                    padding: 18px;
                    background: linear-gradient(135deg, #0070ba 0%, #003087 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 18px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0, 112, 186, 0.3);
                    transition: transform 0.2s;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="fab fa-paypal" style="font-size: 24px;"></i>
                    <span>Pay with PayPal - $${plan.price}</span>
                </button>
                
                <!-- Cancel -->
                <button onclick="document.getElementById('paypal-modal').remove()" style="
                    width: 100%;
                    padding: 14px;
                    background: transparent;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    cursor: pointer;
                    transition: all 0.3s;
                ">
                    Maybe Later
                </button>
                
                <p style="
                    text-align: center;
                    font-size: 12px;
                    color: #9ca3af;
                    margin-top: 16px;
                    line-height: 1.5;
                ">
                    Cancel anytime. Secure payment via PayPal. By subscribing, you agree to our Terms of Service.
                </p>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    handlePayPalPayment(tier) {
        const plan = this.plans[tier.toUpperCase()];
        
        // Store pending subscription
        const pendingSubscription = {
            tier: tier.toUpperCase(),
            amount: plan.price,
            timestamp: Date.now(),
            status: 'pending'
        };
        localStorage.setItem('pending_subscription', JSON.stringify(pendingSubscription));
        
        // Open PayPal.me in new window
        const isMobile = window.innerWidth <= 768;
        const paypalWindow = window.open(
            plan.paypalMeUrl, 
            isMobile ? '_self' : '_blank', 
            'width=600,height=700'
        );
        
        // Close modal
        document.getElementById('paypal-modal').remove();
        
        // Start checking for payment completion
        this.startPaymentCheck(tier, paypalWindow);
    },
    
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
    },
    
    showPaymentCompletionDialog(tier) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 450px;
                width: 90%;
                text-align: center;
            ">
                <div style="font-size: 64px; margin-bottom: 20px;">💳</div>
                <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">
                    Did you complete payment?
                </h2>
                <p style="color: #6b7280; margin-bottom: 32px; line-height: 1.6;">
                    If you completed your PayPal payment, click "Yes" to activate your subscription immediately.
                </p>
                <button onclick="window.PayPalService.activateSubscription('${tier}'); this.parentElement.parentElement.remove();" style="
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    margin-bottom: 12px;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                ">
                    <i class="fas fa-check"></i> Yes, I Completed Payment
                </button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    width: 100%;
                    padding: 14px;
                    background: transparent;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    cursor: pointer;
                ">
                    Not Yet
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
    },
    
    async activateSubscription(tier) {
        const plan = this.plans[tier.toUpperCase()];
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        
        // Update local tier immediately
        this.currentTier = tier.toUpperCase();
        localStorage.setItem('user_tier', this.currentTier);
        
        // Update user subscription in localStorage
        const userSubscription = {
            tier: tier.toUpperCase(),
            status: 'active',
            amount: plan.price,
            interval: 'month',
            startDate: new Date().toISOString(),
            nextBillingDate: nextBillingDate.toISOString(),
            paymentMethod: 'PayPal',
            paypalEmail: this.paypalEmail
        };
        
        localStorage.setItem('user_subscription', JSON.stringify(userSubscription));
        localStorage.removeItem('pending_subscription');
        
        // Update AuthService user data
        if (window.AuthService) {
            const user = window.AuthService.getUser?.();
            if (user) {
                user.subscription_tier = this.currentTier;
                localStorage.setItem('ultimate_sports_user', JSON.stringify(user));
            }
        }
        
        // Try to update backend (optional - works offline)
        try {
            if (window.AuthService?.isAuthenticated()) {
                const response = await fetch(`${window.APP_CONFIG.API.BASE_URL}/api/subscription/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.AuthService.getToken()}`
                    },
                    body: JSON.stringify({
                        tier: tier.toUpperCase(),
                        paypal_email: this.paypalEmail,
                        amount: plan.price,
                        start_date: new Date().toISOString()
                    })
                });
                
                if (response.ok) {
                    console.log('✅ Backend updated');
                }
            }
        } catch (error) {
            console.warn('⚠️ Backend update failed, continuing with local activation');
        }
        
        // Show success
        this.showUpgradeSuccess(tier);
        
        // Update UI
        if (window.SubscriptionUI) {
            window.SubscriptionUI.updateTierDisplay();
        }
        
        console.log('✅ Subscription activated:', tier);
    },
    
    showUpgradeSuccess(tier) {
        const plan = this.plans[tier.toUpperCase()];
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10001;
            text-align: center;
            max-width: 400px;
            animation: scaleIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 80px; margin-bottom: 20px;">🎉</div>
            <h2 style="font-size: 28px; font-weight: 800; margin-bottom: 12px; color: #111827;">
                Welcome to ${plan.name}!
            </h2>
            <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6;">
                Your subscription is now active. Enjoy all the premium features!
            </p>
            <button onclick="this.parentElement.remove(); location.reload();" style="
                padding: 14px 32px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-weight: 700;
                font-size: 16px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            ">
                Let's Go!
            </button>
        `;
        
        document.body.appendChild(notification);
    },
    
    async cancelSubscription() {
        if (this.currentTier === 'FREE') {
            alert('You are already on the free plan.');
            return;
        }
        
        if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
            return;
        }
        
        try {
            const response = await fetch(`${window.APP_CONFIG.API.BASE_URL}/api/subscription/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to cancel subscription');
            }
            
            alert('Subscription cancelled. You will have access until the end of your billing period.');
            
        } catch (error) {
            console.error('❌ Error cancelling subscription:', error);
            alert('Failed to cancel subscription. Please contact support.');
        }
    },
    
    showUpgradePrompt(feature) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 450px;
                width: 90%;
                text-align: center;
            ">
                <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 12px;">
                    Premium Feature
                </h2>
                <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6;">
                    ${feature} is available on PRO and VIP plans. Upgrade to unlock this feature and more!
                </p>
                <button onclick="window.PayPalService.createSubscription('PRO'); this.parentElement.parentElement.remove();" style="
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    margin-bottom: 12px;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                ">
                    <i class="fas fa-crown"></i> Upgrade to PRO - $49.99/mo
                </button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    width: 100%;
                    padding: 14px;
                    background: transparent;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    cursor: pointer;
                ">
                    Maybe Later
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
};

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes scaleIn {
        from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PayPalService.init());
} else {
    PayPalService.init();
}

// Export globally
window.PayPalService = PayPalService;

console.log('📦 PayPal Service loaded');
