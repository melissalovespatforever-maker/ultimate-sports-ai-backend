/**
 * Test Payment Endpoints
 * Quick test script for payment API endpoints
 */

const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'YOUR_TEST_TOKEN_HERE';

console.log('========================================');
console.log('🧪 Testing Payment Endpoints');
console.log('========================================\n');
console.log(`API URL: ${API_BASE_URL}`);
console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 20)}...\n`);

// Test 1: PayPal Purchase
async function testPayPalPurchase() {
    console.log('Test 1: POST /api/transactions/paypal-purchase');
    console.log('-----------------------------------------------');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions/paypal-purchase`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'credit',
                amount: 10000,
                reason: 'PayPal Purchase: Test Starter Pack',
                metadata: {
                    method: 'paypal',
                    paypalTransactionId: `TEST-${Date.now()}`,
                    bundleName: 'Test Starter Pack',
                    verified: true,
                    timestamp: Date.now()
                }
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ SUCCESS');
            console.log('Status:', response.status);
            console.log('New Balance:', data.balance);
            console.log('Transaction ID:', data.transaction.id);
        } else {
            console.log('❌ FAILED');
            console.log('Status:', response.status);
            console.log('Error:', data.error);
            console.log('Message:', data.message);
        }
    } catch (error) {
        console.log('❌ ERROR');
        console.log('Message:', error.message);
    }
    
    console.log('');
}

// Test 2: Subscription Activation
async function testSubscriptionActivation() {
    console.log('Test 2: POST /api/subscriptions/activate');
    console.log('-----------------------------------------------');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/subscriptions/activate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tier: 'Silver VIP',
                tierId: 'silver_monthly',
                monthlyCoins: 15000,
                subscriptionId: `TEST-SUB-${Date.now()}`,
                billingCycle: 'monthly',
                price: 19.99,
                metadata: {
                    method: 'paypal',
                    paypalSubscriptionId: `TEST-SUB-${Date.now()}`,
                    verified: true,
                    timestamp: Date.now()
                }
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ SUCCESS');
            console.log('Status:', response.status);
            console.log('Subscription:', data.subscription.tier);
            console.log('New Balance:', data.balance);
            console.log('Coins Added:', data.coinsAdded);
        } else {
            console.log('❌ FAILED');
            console.log('Status:', response.status);
            console.log('Error:', data.error);
            console.log('Message:', data.message);
        }
    } catch (error) {
        console.log('❌ ERROR');
        console.log('Message:', error.message);
    }
    
    console.log('');
}

// Test 3: Transaction History
async function testTransactionHistory() {
    console.log('Test 3: GET /api/transactions/history');
    console.log('-----------------------------------------------');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions/history?limit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ SUCCESS');
            console.log('Status:', response.status);
            console.log('Total Transactions:', data.total);
            console.log('Transactions Returned:', data.transactions.length);
        } else {
            console.log('❌ FAILED');
            console.log('Status:', response.status);
            console.log('Error:', data.error);
        }
    } catch (error) {
        console.log('❌ ERROR');
        console.log('Message:', error.message);
    }
    
    console.log('');
}

// Test 4: Subscription Status
async function testSubscriptionStatus() {
    console.log('Test 4: GET /api/subscriptions/status');
    console.log('-----------------------------------------------');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/subscriptions/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ SUCCESS');
            console.log('Status:', response.status);
            console.log('Has Active Subscription:', data.hasActiveSubscription);
            if (data.subscription) {
                console.log('Tier:', data.subscription.tier);
                console.log('Next Billing:', new Date(data.subscription.next_billing_date).toLocaleDateString());
            }
        } else {
            console.log('❌ FAILED');
            console.log('Status:', response.status);
            console.log('Error:', data.error);
        }
    } catch (error) {
        console.log('❌ ERROR');
        console.log('Message:', error.message);
    }
    
    console.log('');
}

// Run all tests
async function runTests() {
    if (AUTH_TOKEN === 'YOUR_TEST_TOKEN_HERE') {
        console.log('❌ ERROR: Please set TEST_AUTH_TOKEN environment variable\n');
        console.log('Example: export TEST_AUTH_TOKEN="your-jwt-token"\n');
        process.exit(1);
    }
    
    await testPayPalPurchase();
    await testSubscriptionActivation();
    await testTransactionHistory();
    await testSubscriptionStatus();
    
    console.log('========================================');
    console.log('✅ All tests completed');
    console.log('========================================\n');
}

// Run
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
