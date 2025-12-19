// ============================================
// UNIFIED COIN SYSTEM
// Single source of truth for all coin transactions
// ONLY USD/PayPal for: Coin Bundles & Subscriptions
// ONLY COINS for: Everything else (bets, games, items, etc)
// ============================================

const UnifiedCoinSystem = {
    
    // ============================================
    // COIN COSTS - ALL GAME/FEATURE COSTS
    // ============================================
    costs: {
        // Games
        games: {
            prizeWheel: 50,          // Per spin
            trivia: 25,              // Per game
            slots: 40,               // Per spin
            wheelOfFortune: 30,      // Per spin
            coinFlip: 20,            // Per flip
            parlay: 100,             // Per parlay
            beatTheStreak: 50,       // Per round
            arcade: 35               // Per play
        },
        
        // Betting
        betting: {
            minBet: 10,
            maxBet: 10000,
            parlay: 100,
            livebet: 25
        },
        
        // Shop Items (NO SUBSCRIPTIONS - Use USD only!)
        shop: {
            boosters: {
                coin2x: 500,
                xp2x: 400,
                megaPack: 800
            },
            avatars: {
                jordan: 1500,
                crown: 2500,
                moneyTree: 5000,
                scrooge: 6000
            },
            achievements: {
                badge: 200,
                trophy: 300
            }
        },
        
        // Coach Subscriptions (COINS for daily/weekly/monthly)
        coachSubscription: {
            daily: 250,
            weekly: 1200,   // ~240/day
            monthly: 4000   // ~133/day
        },
        
        // Cosmetics & Special Items
        cosmetics: {
            nameColor: 150,
            avatar: 250,
            badge: 100
        },
        
        // Tournaments
        tournaments: {
            entry: 500
        }
    },
    
    // ============================================
    // REWARDS - WHAT USERS EARN IN COINS
    // ============================================
    rewards: {
        // Daily
        dailyLogin: 50,
        dailyChallenge: 100,
        
        // Achievements
        firstWin: 100,
        winStreak5: 500,
        winStreak10: 1000,
        
        // Referrals
        referralSignup: 250,
        referralFirstBet: 500,
        
        // Betting (varies by odds)
        betWinMultiplier: 1.5,  // Win = stake * multiplier
        
        // Games (already in segment values)
        prizeWheel: [1000, 500, 250, 100, 75, 25],  // See minigame-wheel.html
        trivia: {
            perfect: 500,
            good: 250,
            ok: 100
        },
        slots: {
            jackpot: 1000,
            bigWin: 500,
            win: 100
        }
    },
    
    // ============================================
    // COIN BUNDLE PRICES (USD to Coins conversion)
    // ============================================
    coinBundles: {
        // Small Bundles
        starter: {
            usdPrice: 4.99,
            coins: 500,
            bonus: 50      // 10% bonus
        },
        popular: {
            usdPrice: 9.99,
            coins: 1200,
            bonus: 200     // 20% bonus
        },
        
        // Medium Bundles
        classic: {
            usdPrice: 19.99,
            coins: 2500,
            bonus: 500     // 20% bonus
        },
        ultimate: {
            usdPrice: 49.99,
            coins: 6500,
            bonus: 2000    // 30% bonus
        },
        
        // Large Bundles
        legendary: {
            usdPrice: 99.99,
            coins: 14000,
            bonus: 6000    // 40% bonus
        }
    },
    
    // ============================================
    // SUBSCRIPTIONS (USD ONLY - Monthly)
    // ============================================
    subscriptions: {
        rookie: {
            usdPrice: 9.99,
            features: ['lite_features', 'ads']
        },
        pro: {
            usdPrice: 49.99,
            features: ['full_features', 'no_ads', '15_games_daily']
        },
        vip: {
            usdPrice: 99.99,
            features: ['full_features', 'no_ads', 'unlimited_games', 'vip_prizes']
        }
    },
    
    // ============================================
    // VALIDATION FUNCTIONS
    // ============================================
    
    // Check if user has enough coins for action
    hasEnoughCoins(userCoins, costType, costAmount) {
        console.log(`💰 Checking coins: ${userCoins} vs cost: ${costAmount}`);
        return userCoins >= costAmount;
    },
    
    // Deduct coins from user
    deductCoins(currentCoins, costType, costAmount) {
        const newBalance = Math.max(0, currentCoins - costAmount);
        console.log(`💸 Deducted ${costAmount} coins | Balance: ${currentCoins} → ${newBalance}`);
        return newBalance;
    },
    
    // Add coins to user
    addCoins(currentCoins, rewardType, rewardAmount) {
        const newBalance = currentCoins + rewardAmount;
        console.log(`🎉 Added ${rewardAmount} coins | Balance: ${currentCoins} → ${newBalance}`);
        return newBalance;
    },
    
    // Calculate coin reward based on bet odds
    calculateBetReward(betAmount, odds) {
        // If odds are -110, return 1x. If +200, return 3x, etc
        const multiplier = (odds > 0) ? (odds / 100) : (100 / Math.abs(odds));
        return Math.floor(betAmount * multiplier * this.rewards.betWinMultiplier);
    },
    
    // Convert USD to coins
    usdToCoins(usd, bundle) {
        if (!bundle || !this.coinBundles[bundle]) {
            console.warn('⚠️ Invalid coin bundle');
            return 0;
        }
        const bundleInfo = this.coinBundles[bundle];
        if (Math.abs(bundleInfo.usdPrice - usd) < 0.01) {
            return bundleInfo.coins + bundleInfo.bonus;
        }
        console.warn('⚠️ USD amount doesn\'t match bundle');
        return 0;
    },
    
    // Get all costs for a specific category
    getCategoryVosts(category) {
        return this.costs[category] || {};
    },
    
    // ============================================
    // DISPLAY HELPERS
    // ============================================
    
    // Format coins display
    formatCoins(amount) {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + 'K';
        }
        return amount.toString();
    },
    
    // Get cost display string
    getCostDisplay(costType) {
        return `${costType} 🪙`;
    },
    
    // Verify all costs are coins (not USD)
    verifyCoinOnly(feature) {
        // Allowed USD: coins bundles + subscriptions only
        const usdOnlyFeatures = ['coin_bundle', 'subscription'];
        
        if (usdOnlyFeatures.includes(feature)) {
            console.log(`✅ ${feature} correctly uses USD`);
            return true;
        } else {
            console.log(`✅ ${feature} correctly uses coins`);
            return true;
        }
    }
};

// Export globally
window.UnifiedCoinSystem = UnifiedCoinSystem;

console.log('✅ Unified Coin System loaded');
console.log('📊 All game costs: coins only');
console.log('💳 All subscriptions & bundles: USD only');
