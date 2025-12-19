// ============================================
// PAYPAL SHOP INTEGRATION
// Handles PayPal payments for shop items
// ============================================

const PayPalShop = {
    config: {
        clientId: 'AY8wzPPT8jprCoc4NhICcYnBXBUFCGP0Fy0NL6eCz94Utfc5ugDU8e99IPOwZtYYC1VxqyZ4-fD5MGOv',
        mode: 'sandbox', // sandbox or production
        currency: 'USD'
    },
    
    initialized: false,
    
    init() {
        console.log('💳 Initializing PayPal Shop Integration...');
        
        // Load PayPal SDK
        if (!document.querySelector('script[src*="paypal.com/sdk/js"]')) {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${this.config.clientId}&currency=${this.config.currency}&intent=capture`;
            script.onload = () => {
                this.initialized = true;
                console.log('✅ PayPal SDK loaded');
            };
            script.onerror = () => {
                console.error('❌ Failed to load PayPal SDK');
            };
            document.head.appendChild(script);
        }
    },
    
    // Convert coins to USD (10,000 coins = $10 USD for example)
    coinsToUSD(coins) {
        return (coins / 1000).toFixed(2);
    },
    
    // Create PayPal button for a shop item
    createPayPalButton(containerId, item) {
        if (!this.initialized) {
            console.warn('⚠️ PayPal SDK not loaded yet');
            setTimeout(() => this.createPayPalButton(containerId, item), 500);
            return;
        }
        
        if (!window.paypal) {
            console.error('❌ PayPal SDK not available');
            return;
        }
        
        const usdPrice = this.coinsToUSD(item.price || item.dealPrice);
        
        window.paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'pay'
            },
            
            createOrder: (data, actions) => {
                console.log(`💳 Creating PayPal order for: ${item.name}`);
                
                return actions.order.create({
                    purchase_units: [{
                        description: item.name,
                        custom_id: item.id,
                        amount: {
                            currency_code: this.config.currency,
                            value: usdPrice,
                            breakdown: {
                                item_total: {
                                    currency_code: this.config.currency,
                                    value: usdPrice
                                }
                            }
                        },
                        items: [{
                            name: item.name,
                            description: item.description || 'Shop item',
                            unit_amount: {
                                currency_code: this.config.currency,
                                value: usdPrice
                            },
                            quantity: '1',
                            category: 'DIGITAL_GOODS'
                        }]
                    }],
                    application_context: {
                        shipping_preference: 'NO_SHIPPING'
                    }
                });
            },
            
            onApprove: async (data, actions) => {
                console.log('✅ Payment approved:', data);
                
                try {
                    const order = await actions.order.capture();
                    console.log('✅ Payment captured:', order);
                    
                    // Process the purchase
                    await this.processPurchase(item, order);
                    
                    // Show success message
                    this.showSuccessMessage(item);
                    
                    return order;
                } catch (error) {
                    console.error('❌ Payment capture failed:', error);
                    this.showErrorMessage('Payment processing failed. Please try again.');
                }
            },
            
            onError: (err) => {
                console.error('❌ PayPal error:', err);
                this.showErrorMessage('Payment error occurred. Please try again.');
            },
            
            onCancel: (data) => {
                console.log('ℹ️ Payment cancelled:', data);
                this.showInfoMessage('Payment cancelled. You can try again anytime.');
            }
            
        }).render(`#${containerId}`);
    },
    
    // Process the purchase after successful payment
    async processPurchase(item, paypalOrder) {
        try {
            const userId = window.appState?.user?.id || 'guest';
            
            // Send to backend
            const response = await fetch(`${window.CONFIG?.API_BASE_URL || ''}/api/shop/purchase/paypal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    userId,
                    item,
                    paypalOrderId: paypalOrder.id,
                    paypalPayerId: paypalOrder.payer.payer_id,
                    amount: paypalOrder.purchase_units[0].amount.value,
                    currency: paypalOrder.purchase_units[0].amount.currency_code,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Purchase recorded:', data);
                
                // Update user's inventory
                if (window.unifiedCurrency) {
                    window.unifiedCurrency.addToInventory(item);
                }
                
                // Trigger achievement check
                if (window.achievementsSystem) {
                    window.achievementsSystem.trackPurchase(item);
                }
                
            } else {
                console.warn('⚠️ Failed to record purchase on backend');
            }
            
        } catch (error) {
            console.error('❌ Error processing purchase:', error);
        }
    },
    
    // Show success message
    showSuccessMessage(item) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            color: white;
            padding: 30px 50px;
            border-radius: 15px;
            font-size: 20px;
            font-weight: bold;
            z-index: 100000;
            box-shadow: 0 10px 40px rgba(46, 204, 113, 0.5);
            animation: slideIn 0.3s ease-out;
            text-align: center;
        `;
        
        message.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 15px;">✅</div>
            <div style="font-size: 24px; margin-bottom: 10px;">Purchase Successful!</div>
            <div style="font-size: 16px; opacity: 0.9;">${item.name} added to your inventory</div>
        `;
        
        document.body.appendChild(message);
        
        // Confetti effect
        if (window.confetti) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
        
        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => message.remove(), 300);
        }, 3000);
    },
    
    // Show error message
    showErrorMessage(text) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 25px 40px;
            border-radius: 15px;
            font-size: 18px;
            font-weight: bold;
            z-index: 100000;
            box-shadow: 0 10px 40px rgba(231, 76, 60, 0.5);
            animation: shake 0.5s ease-in-out;
        `;
        
        message.innerHTML = `❌ ${text}`;
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 3000);
    },
    
    // Show info message
    showInfoMessage(text) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 25px 40px;
            border-radius: 15px;
            font-size: 18px;
            font-weight: bold;
            z-index: 100000;
            box-shadow: 0 10px 40px rgba(52, 152, 219, 0.5);
        `;
        
        message.innerHTML = `ℹ️ ${text}`;
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 2500);
    }
};

// Add necessary CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translate(-50%, -40%);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -60%);
        }
    }
    
    @keyframes shake {
        0%, 100% { transform: translate(-50%, -50%); }
        25% { transform: translate(-52%, -50%); }
        75% { transform: translate(-48%, -50%); }
    }
`;
document.head.appendChild(style);

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PayPalShop.init());
} else {
    PayPalShop.init();
}

// Export globally
window.PayPalShop = PayPalShop;

console.log('✅ PayPal Shop Integration loaded');
