// ============================================
// LIVE ODDS COMPARISON V2 - 30+ SPORTSBOOKS
// Professional odds comparison with real-time updates
// ============================================

class OddsComparisonSystemV2 {
    constructor() {
        this.games = new Map();
        this.sportsbooks = this.initializeSportsbooks();
        this.updateInterval = null;
        this.isLive = false;
        this.selectedSport = 'basketball_nba';
        this.filters = {
            minSportsbooks: 3,
            marketTypes: ['moneyline', 'spread', 'totals'],
            onlyBestOdds: false,
            showArbitrage: true
        };
        
        // Cache for historical odds movement
        this.oddsHistory = new Map();
        this.maxHistorySize = 100; // per game
        
        // Event listeners
        this.listeners = new Map();
        
        // Auto-start if enabled
        this.autoStartLive = false;
        
        console.log('✅ Odds Comparison V2 initialized with', this.sportsbooks.size, 'sportsbooks');
    }

    // ============================================
    // SPORTSBOOK DATABASE - 30+ BOOKS
    // ============================================
    
    initializeSportsbooks() {
        const books = new Map();
        
        // Tier 1: Major US Books
        books.set('draftkings', {
            name: 'DraftKings',
            tier: 1,
            rating: 5.0,
            reliability: 'Excellent',
            limits: 'Very High',
            states: ['All Legal States'],
            features: ['Live Betting', 'Cash Out', 'Same Game Parlay'],
            bonuses: 'Up to $1,000 Deposit Match',
            promoCode: 'ULTIMATE1000',
            color: '#53D337',
            logo: '🎯'
        });
        
        books.set('fanduel', {
            name: 'FanDuel',
            tier: 1,
            rating: 5.0,
            reliability: 'Excellent',
            limits: 'Very High',
            states: ['All Legal States'],
            features: ['Live Betting', 'Cash Out', 'Same Game Parlay'],
            bonuses: '$1,000 No Sweat First Bet',
            promoCode: 'ULTIMATE1K',
            color: '#0088FF',
            logo: '⭐'
        });
        
        books.set('betmgm', {
            name: 'BetMGM',
            tier: 1,
            rating: 5.0,
            reliability: 'Excellent',
            limits: 'Very High',
            states: ['All Legal States'],
            features: ['Live Betting', 'Cash Out', 'Easy Parlay'],
            bonuses: '$1,500 First Bet Offer',
            promoCode: 'ULTIMATE1500',
            color: '#BB9645',
            logo: '🦁'
        });
        
        books.set('caesars', {
            name: 'Caesars',
            tier: 1,
            rating: 4.8,
            reliability: 'Excellent',
            limits: 'Very High',
            states: ['All Legal States'],
            features: ['Live Betting', 'Cash Out', 'Same Game Parlay'],
            bonuses: '$1,000 First Bet on Caesars',
            promoCode: 'ULTIMATE1000C',
            color: '#FFD700',
            logo: '👑'
        });
        
        books.set('espnbet', {
            name: 'ESPN BET',
            tier: 1,
            rating: 4.7,
            reliability: 'Excellent',
            limits: 'High',
            states: ['Growing'],
            features: ['Live Betting', 'ESPN Integration'],
            bonuses: '$1,000 First Bet Reset',
            promoCode: 'ESPNULTIMATE',
            color: '#FF0033',
            logo: '📺'
        });
        
        // Tier 2: Established Books
        books.set('betrivers', {
            name: 'BetRivers',
            tier: 2,
            rating: 4.5,
            reliability: 'Very Good',
            limits: 'High',
            states: ['Multiple States'],
            features: ['Live Betting', 'iRush Rewards'],
            bonuses: '$500 Second Chance Bet',
            promoCode: 'RIVER500',
            color: '#005EB8',
            logo: '🏞️'
        });
        
        books.set('pointsbet', {
            name: 'PointsBet',
            tier: 2,
            rating: 4.5,
            reliability: 'Very Good',
            limits: 'Medium-High',
            states: ['Select States'],
            features: ['PointsBetting', 'Live Betting'],
            bonuses: '$500 in Second Chance Bets',
            promoCode: 'POINTSMAX',
            color: '#FF6B35',
            logo: '📊'
        });
        
        books.set('wynnbet', {
            name: 'WynnBET',
            tier: 2,
            rating: 4.4,
            reliability: 'Very Good',
            limits: 'Medium',
            states: ['Select States'],
            features: ['Live Betting', 'Wynn Rewards'],
            bonuses: '$1,000 Risk Free Bet',
            promoCode: 'WYNNMAX',
            color: '#B8860B',
            logo: '🎰'
        });
        
        books.set('barstool', {
            name: 'Barstool',
            tier: 2,
            rating: 4.3,
            reliability: 'Good',
            limits: 'Medium',
            states: ['Select States'],
            features: ['Live Betting', 'Barstool Content'],
            bonuses: '$1,000 First Bet Match',
            promoCode: 'STOOLMAX',
            color: '#000000',
            logo: '🪑'
        });
        
        books.set('unibet', {
            name: 'Unibet',
            tier: 2,
            rating: 4.5,
            reliability: 'Very Good',
            limits: 'Medium-High',
            states: ['Select States'],
            features: ['Live Betting', 'Cash Out'],
            bonuses: '$500 Second Chance Bet',
            promoCode: 'UNIMAX',
            color: '#00A651',
            logo: '🌐'
        });
        
        // Tier 3: Regional & Specialized Books
        books.set('hardrock', {
            name: 'Hard Rock Bet',
            tier: 3,
            rating: 4.2,
            reliability: 'Good',
            limits: 'Medium',
            states: ['FL, NJ, Others'],
            features: ['Live Betting', 'Unity Rewards'],
            bonuses: '$100 Risk Free Bet',
            promoCode: 'ROCKBET',
            color: '#E31837',
            logo: '🎸'
        });
        
        books.set('bet365', {
            name: 'bet365',
            tier: 1,
            rating: 4.9,
            reliability: 'Excellent',
            limits: 'Very High',
            states: ['CO, NJ, VA, OH, LA'],
            features: ['Live Betting', 'Early Payout', 'Bet Builder'],
            bonuses: 'Bet $1 Get $200 in Bonus Bets',
            promoCode: 'BET365MAX',
            color: '#005A2B',
            logo: '🟢'
        });
        
        books.set('superbook', {
            name: 'SuperBook',
            tier: 3,
            rating: 4.0,
            reliability: 'Good',
            limits: 'Medium',
            states: ['NV, AZ, CO, NJ, OH, TN'],
            features: ['Sharp Lines', 'Player Props'],
            bonuses: '$1,000 First Bet',
            promoCode: 'SUPERMAX',
            color: '#D32F2F',
            logo: '📖'
        });
        
        books.set('betfred', {
            name: 'Betfred',
            tier: 3,
            rating: 4.0,
            reliability: 'Good',
            limits: 'Medium',
            states: ['CO, IA, LA, MD, OH, PA, VA'],
            features: ['Live Betting', 'Pick Your Punt'],
            bonuses: '$200 in Free Bets',
            promoCode: 'FREDMAX',
            color: '#E41E31',
            logo: '🎲'
        });
        
        books.set('fanatics', {
            name: 'Fanatics',
            tier: 2,
            rating: 4.6,
            reliability: 'Very Good',
            limits: 'High',
            states: ['Growing Fast'],
            features: ['Live Betting', 'FanCash Rewards'],
            bonuses: 'Get $1,000 in Bonus Bets',
            promoCode: 'FANMAX1K',
            color: '#001952',
            logo: '⚡'
        });
        
        books.set('sisportsbook', {
            name: 'SI Sportsbook',
            tier: 3,
            rating: 4.1,
            reliability: 'Good',
            limits: 'Medium',
            states: ['Select States'],
            features: ['Live Betting', 'SI Content'],
            bonuses: '$1,000 First Bet',
            promoCode: 'SIMAX',
            color: '#DD0031',
            logo: '📰'
        });
        
        books.set('borgata', {
            name: 'Borgata',
            tier: 2,
            rating: 4.4,
            reliability: 'Very Good',
            limits: 'High',
            states: ['NJ, PA, MI, WV'],
            features: ['Live Betting', 'Cash Out'],
            bonuses: '$1,000 Bonus Bet',
            promoCode: 'BORGMAX',
            color: '#8B4513',
            logo: '🎰'
        });
        
        books.set('twinspires', {
            name: 'TwinSpires',
            tier: 3,
            rating: 3.9,
            reliability: 'Good',
            limits: 'Medium',
            states: ['Multiple States'],
            features: ['Live Betting', 'Horse Racing Integration'],
            bonuses: '$1,000 Risk Free Bet',
            promoCode: 'TWINMAX',
            color: '#0033A0',
            logo: '🐎'
        });
        
        books.set('resorts', {
            name: 'Resorts',
            tier: 3,
            rating: 3.8,
            reliability: 'Good',
            limits: 'Low-Medium',
            states: ['NJ'],
            features: ['Live Betting'],
            bonuses: '$250 Deposit Match',
            promoCode: 'RESORTMAX',
            color: '#006837',
            logo: '🏖️'
        });
        
        books.set('playup', {
            name: 'PlayUp',
            tier: 3,
            rating: 3.7,
            reliability: 'Fair',
            limits: 'Low',
            states: ['NJ, CO'],
            features: ['Live Betting'],
            bonuses: '$200 Risk Free Bet',
            promoCode: 'PLAYMAX',
            color: '#FF6B00',
            logo: '🎮'
        });
        
        // Additional books for 30+ coverage
        books.set('foxbet', {
            name: 'FOX Bet',
            tier: 3,
            rating: 4.0,
            reliability: 'Good',
            limits: 'Medium',
            states: ['PA, MI, CO, NJ'],
            features: ['Live Betting', 'FOX Sports Integration'],
            bonuses: '$500 Risk Free Bet',
            promoCode: 'FOXMAX',
            color: '#003B71',
            logo: '🦊'
        });
        
        books.set('ballybet', {
            name: "Bally Bet",
            tier: 3,
            rating: 3.9,
            reliability: 'Good',
            limits: 'Medium',
            states: ['Select States'],
            features: ['Live Betting', 'Rewards Integration'],
            bonuses: '$500 First Bet',
            promoCode: 'BALLYMAX',
            color: '#C8102E',
            logo: '🎰'
        });
        
        books.set('tipico', {
            name: 'Tipico',
            tier: 3,
            rating: 4.0,
            reliability: 'Good',
            limits: 'Medium',
            states: ['NJ, CO, IA, OH'],
            features: ['Live Betting', 'European Expertise'],
            bonuses: '$750 Risk Free Bet',
            promoCode: 'TIPICOMAX',
            color: '#004B87',
            logo: '⚽'
        });
        
        books.set('betway', {
            name: 'Betway',
            tier: 2,
            rating: 4.3,
            reliability: 'Very Good',
            limits: 'Medium-High',
            states: ['PA, NJ, AZ, CO, IN, IA, OH, VA'],
            features: ['Live Betting', 'Cash Out', 'Parlay+'],
            bonuses: '$250 First Bet Match',
            promoCode: 'BETWAYMAX',
            color: '#000000',
            logo: '💎'
        });
        
        books.set('sugarhouse', {
            name: 'SugarHouse',
            tier: 3,
            rating: 3.9,
            reliability: 'Good',
            limits: 'Medium',
            states: ['PA, NJ'],
            features: ['Live Betting', 'iRush Rewards'],
            bonuses: '$500 Second Chance',
            promoCode: 'SUGARMAX',
            color: '#FFD700',
            logo: '🏠'
        });
        
        books.set('williamhill', {
            name: 'William Hill',
            tier: 2,
            rating: 4.2,
            reliability: 'Very Good',
            limits: 'High',
            states: ['Multiple States'],
            features: ['Live Betting', 'Sharp Lines'],
            bonuses: '$1,000 Risk Free Bet',
            promoCode: 'HILLMAX',
            color: '#0066B2',
            logo: '🏔️'
        });
        
        books.set('mybookie', {
            name: 'MyBookie',
            tier: 3,
            rating: 3.8,
            reliability: 'Good',
            limits: 'Medium',
            states: ['Offshore'],
            features: ['Crypto Friendly', 'Live Betting'],
            bonuses: '100% Deposit Bonus',
            promoCode: 'MYBMAX',
            color: '#E74C3C',
            logo: '📚'
        });
        
        books.set('bovada', {
            name: 'Bovada',
            tier: 3,
            rating: 4.1,
            reliability: 'Good',
            limits: 'High',
            states: ['Offshore'],
            features: ['Crypto Friendly', 'Live Betting', 'Sharp Lines'],
            bonuses: '$750 Sports Welcome Bonus',
            promoCode: 'BOVMAX',
            color: '#D32F2F',
            logo: '🐂'
        });
        
        books.set('betonline', {
            name: 'BetOnline',
            tier: 3,
            rating: 4.0,
            reliability: 'Good',
            limits: 'Very High',
            states: ['Offshore'],
            features: ['Crypto Friendly', 'Live Betting', 'Props'],
            bonuses: '50% Welcome Bonus',
            promoCode: 'BOLMAX',
            color: '#FF6B35',
            logo: '💻'
        });
        
        books.set('heritage', {
            name: 'Heritage Sports',
            tier: 3,
            rating: 4.2,
            reliability: 'Very Good',
            limits: 'Very High',
            states: ['Offshore'],
            features: ['Reduced Juice', 'Live Betting'],
            bonuses: '100% Bonus up to $1,000',
            promoCode: 'HERIMAX',
            color: '#1A5490',
            logo: '🏛️'
        });
        
        books.set('bookmaker', {
            name: 'Bookmaker',
            tier: 3,
            rating: 4.3,
            reliability: 'Very Good',
            limits: 'Very High',
            states: ['Offshore'],
            features: ['Sharp Lines', 'High Limits'],
            bonuses: '15% Cash Bonus',
            promoCode: 'BOOKMAX',
            color: '#2C3E50',
            logo: '📖'
        });
        
        console.log(`✅ Initialized ${books.size} sportsbooks`);
        return books;
    }

    // ============================================
    // ODDS FETCHING & PROCESSING
    // ============================================
    
    async fetchOdds(sport = null) {
        const targetSport = sport || this.selectedSport;
        console.log(`📊 Fetching odds for ${targetSport}...`);
        
        try {
            // Try to fetch from API first
            const apiOdds = await this.fetchFromAPI(targetSport);
            if (apiOdds && apiOdds.length > 0) {
                this.processOddsData(apiOdds, targetSport);
                return true;
            }
        } catch (error) {
            console.warn('API fetch failed, using demo data:', error);
        }
        
        // Fall back to demo data
        this.loadDemoData(targetSport);
        return true;
    }
    
    async fetchFromAPI(sport) {
        // Placeholder for actual API integration
        // This would connect to The Odds API or similar service
        const response = await fetch(`/api/odds/${sport}`).catch(() => null);
        if (!response || !response.ok) return null;
        return await response.json();
    }
    
    processOddsData(apiData, sport) {
        apiData.forEach(game => {
            const gameId = game.id || `${game.home_team}_${game.away_team}_${game.commence_time}`;
            
            const processedGame = {
                id: gameId,
                sport: sport,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                commenceTime: new Date(game.commence_time),
                status: this.getGameStatus(game.commence_time),
                bookmakers: new Map(),
                bestOdds: null,
                arbitrageOpportunities: []
            };
            
            // Process each bookmaker
            if (game.bookmakers) {
                game.bookmakers.forEach(book => {
                    if (this.sportsbooks.has(book.key)) {
                        const oddsData = this.extractOdds(book);
                        processedGame.bookmakers.set(book.key, oddsData);
                    }
                });
            }
            
            // Calculate best odds across all books
            processedGame.bestOdds = this.calculateBestOdds(processedGame.bookmakers);
            
            // Detect arbitrage opportunities
            processedGame.arbitrageOpportunities = this.detectArbitrage(processedGame.bookmakers);
            
            // Store in games map
            this.games.set(gameId, processedGame);
            
            // Track odds history for line movement
            this.trackOddsHistory(gameId, processedGame);
        });
        
        this.emit('oddsUpdated', { sport, count: apiData.length });
    }
    
    extractOdds(bookmaker) {
        const odds = {
            bookmaker: bookmaker.key,
            name: this.sportsbooks.get(bookmaker.key)?.name || bookmaker.title,
            lastUpdate: new Date(bookmaker.last_update),
            markets: {}
        };
        
        if (bookmaker.markets) {
            bookmaker.markets.forEach(market => {
                if (market.key === 'h2h') {
                    // Moneyline
                    odds.markets.moneyline = {
                        home: market.outcomes.find(o => o.name === bookmaker.home_team)?.price,
                        away: market.outcomes.find(o => o.name === bookmaker.away_team)?.price
                    };
                } else if (market.key === 'spreads') {
                    // Spread
                    const homeOutcome = market.outcomes.find(o => o.name === bookmaker.home_team);
                    const awayOutcome = market.outcomes.find(o => o.name === bookmaker.away_team);
                    odds.markets.spread = {
                        home: { odds: homeOutcome?.price, line: homeOutcome?.point },
                        away: { odds: awayOutcome?.price, line: awayOutcome?.point }
                    };
                } else if (market.key === 'totals') {
                    // Totals
                    const overOutcome = market.outcomes.find(o => o.name === 'Over');
                    const underOutcome = market.outcomes.find(o => o.name === 'Under');
                    odds.markets.totals = {
                        over: { odds: overOutcome?.price, line: overOutcome?.point },
                        under: { odds: underOutcome?.price, line: underOutcome?.point }
                    };
                }
            });
        }
        
        return odds;
    }
    
    calculateBestOdds(bookmakers) {
        const best = {
            moneyline: { home: null, away: null },
            spread: { home: null, away: null },
            totals: { over: null, under: null }
        };
        
        bookmakers.forEach((odds, bookKey) => {
            // Best moneyline
            if (odds.markets.moneyline) {
                if (!best.moneyline.home || odds.markets.moneyline.home > best.moneyline.home.odds) {
                    best.moneyline.home = {
                        odds: odds.markets.moneyline.home,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
                if (!best.moneyline.away || odds.markets.moneyline.away > best.moneyline.away.odds) {
                    best.moneyline.away = {
                        odds: odds.markets.moneyline.away,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
            }
            
            // Best spread
            if (odds.markets.spread) {
                if (!best.spread.home || odds.markets.spread.home.odds > best.spread.home.odds) {
                    best.spread.home = {
                        odds: odds.markets.spread.home.odds,
                        line: odds.markets.spread.home.line,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
                if (!best.spread.away || odds.markets.spread.away.odds > best.spread.away.odds) {
                    best.spread.away = {
                        odds: odds.markets.spread.away.odds,
                        line: odds.markets.spread.away.line,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
            }
            
            // Best totals
            if (odds.markets.totals) {
                if (!best.totals.over || odds.markets.totals.over.odds > best.totals.over.odds) {
                    best.totals.over = {
                        odds: odds.markets.totals.over.odds,
                        line: odds.markets.totals.over.line,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
                if (!best.totals.under || odds.markets.totals.under.odds > best.totals.under.odds) {
                    best.totals.under = {
                        odds: odds.markets.totals.under.odds,
                        line: odds.markets.totals.under.line,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
            }
        });
        
        return best;
    }
    
    // ============================================
    // ARBITRAGE DETECTION
    // ============================================
    
    detectArbitrage(bookmakers) {
        const opportunities = [];
        
        // Check moneyline arbitrage
        const mlArb = this.checkMoneylineArbitrage(bookmakers);
        if (mlArb) opportunities.push(mlArb);
        
        // Check spread arbitrage (middle opportunities)
        const spreadArb = this.checkSpreadMiddle(bookmakers);
        if (spreadArb.length > 0) opportunities.push(...spreadArb);
        
        // Check total arbitrage (middle opportunities)
        const totalArb = this.checkTotalMiddle(bookmakers);
        if (totalArb.length > 0) opportunities.push(...totalArb);
        
        return opportunities;
    }
    
    checkMoneylineArbitrage(bookmakers) {
        let bestHome = null;
        let bestAway = null;
        
        bookmakers.forEach((odds, bookKey) => {
            if (odds.markets.moneyline) {
                if (!bestHome || odds.markets.moneyline.home > bestHome.odds) {
                    bestHome = {
                        odds: odds.markets.moneyline.home,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
                if (!bestAway || odds.markets.moneyline.away > bestAway.odds) {
                    bestAway = {
                        odds: odds.markets.moneyline.away,
                        book: bookKey,
                        bookName: odds.name
                    };
                }
            }
        });
        
        if (bestHome && bestAway) {
            const impliedHome = this.americanToImplied(bestHome.odds);
            const impliedAway = this.americanToImplied(bestAway.odds);
            const totalImplied = impliedHome + impliedAway;
            
            if (totalImplied < 100) {
                const profit = ((100 / totalImplied) - 1) * 100;
                return {
                    type: 'moneyline',
                    profit: profit.toFixed(2),
                    home: bestHome,
                    away: bestAway,
                    instructions: `Bet ${(impliedHome / totalImplied * 100).toFixed(1)}% on home at ${bestHome.bookName}, ${(impliedAway / totalImplied * 100).toFixed(1)}% on away at ${bestAway.bookName}`
                };
            }
        }
        
        return null;
    }
    
    checkSpreadMiddle(bookmakers) {
        const opportunities = [];
        const spreads = [];
        
        bookmakers.forEach((odds, bookKey) => {
            if (odds.markets.spread) {
                spreads.push({
                    book: bookKey,
                    bookName: odds.name,
                    homeLine: odds.markets.spread.home.line,
                    homeOdds: odds.markets.spread.home.odds,
                    awayLine: odds.markets.spread.away.line,
                    awayOdds: odds.markets.spread.away.odds
                });
            }
        });
        
        // Look for middle opportunities (different lines)
        for (let i = 0; i < spreads.length; i++) {
            for (let j = i + 1; j < spreads.length; j++) {
                const s1 = spreads[i];
                const s2 = spreads[j];
                
                // Check if lines create a middle
                if (Math.abs(s1.homeLine - s2.homeLine) >= 1) {
                    opportunities.push({
                        type: 'spread_middle',
                        book1: s1.bookName,
                        book2: s2.bookName,
                        line1: s1.homeLine,
                        line2: s2.homeLine,
                        middleSize: Math.abs(s1.homeLine - s2.homeLine)
                    });
                }
            }
        }
        
        return opportunities;
    }
    
    checkTotalMiddle(bookmakers) {
        const opportunities = [];
        const totals = [];
        
        bookmakers.forEach((odds, bookKey) => {
            if (odds.markets.totals) {
                totals.push({
                    book: bookKey,
                    bookName: odds.name,
                    line: odds.markets.totals.over.line,
                    overOdds: odds.markets.totals.over.odds,
                    underOdds: odds.markets.totals.under.odds
                });
            }
        });
        
        // Look for middle opportunities
        for (let i = 0; i < totals.length; i++) {
            for (let j = i + 1; j < totals.length; j++) {
                const t1 = totals[i];
                const t2 = totals[j];
                
                if (Math.abs(t1.line - t2.line) >= 1) {
                    opportunities.push({
                        type: 'total_middle',
                        book1: t1.bookName,
                        book2: t2.bookName,
                        line1: t1.line,
                        line2: t2.line,
                        middleSize: Math.abs(t1.line - t2.line)
                    });
                }
            }
        }
        
        return opportunities;
    }
    
    // ============================================
    // ODDS UTILITIES
    // ============================================
    
    americanToImplied(americanOdds) {
        if (americanOdds > 0) {
            return (100 / (americanOdds + 100)) * 100;
        } else {
            return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100;
        }
    }
    
    americanToDecimal(americanOdds) {
        if (americanOdds > 0) {
            return (americanOdds / 100) + 1;
        } else {
            return (100 / Math.abs(americanOdds)) + 1;
        }
    }
    
    formatOdds(odds, format = 'american') {
        if (!odds) return 'N/A';
        
        if (format === 'american') {
            return odds > 0 ? `+${odds}` : odds.toString();
        } else if (format === 'decimal') {
            return this.americanToDecimal(odds).toFixed(2);
        } else if (format === 'implied') {
            return this.americanToImplied(odds).toFixed(1) + '%';
        }
    }
    
    // ============================================
    // ODDS HISTORY & LINE MOVEMENT
    // ============================================
    
    trackOddsHistory(gameId, gameData) {
        if (!this.oddsHistory.has(gameId)) {
            this.oddsHistory.set(gameId, []);
        }
        
        const history = this.oddsHistory.get(gameId);
        history.push({
            timestamp: Date.now(),
            bestOdds: JSON.parse(JSON.stringify(gameData.bestOdds)),
            bookmakerCount: gameData.bookmakers.size
        });
        
        // Keep only last N entries
        if (history.length > this.maxHistorySize) {
            history.shift();
        }
    }
    
    getLineMovement(gameId, market = 'moneyline') {
        const history = this.oddsHistory.get(gameId);
        if (!history || history.length < 2) return null;
        
        const earliest = history[0];
        const latest = history[history.length - 1];
        
        const movement = {
            market,
            timespan: latest.timestamp - earliest.timestamp,
            home: this.calculateMovement(earliest, latest, market, 'home'),
            away: this.calculateMovement(earliest, latest, market, 'away')
        };
        
        return movement;
    }
    
    calculateMovement(earliest, latest, market, side) {
        const earlyOdds = earliest.bestOdds?.[market]?.[side]?.odds;
        const lateOdds = latest.bestOdds?.[market]?.[side]?.odds;
        
        if (!earlyOdds || !lateOdds) return null;
        
        return {
            from: earlyOdds,
            to: lateOdds,
            change: lateOdds - earlyOdds,
            direction: lateOdds > earlyOdds ? 'up' : lateOdds < earlyOdds ? 'down' : 'stable'
        };
    }
    
    // ============================================
    // LIVE UPDATES
    // ============================================
    
    startLiveUpdates(intervalSeconds = 30) {
        if (this.isLive) {
            console.warn('Live updates already running');
            return;
        }
        
        this.isLive = true;
        console.log(`🔴 Starting live updates (${intervalSeconds}s interval)`);
        
        // Initial fetch
        this.fetchOdds();
        
        // Set up interval
        this.updateInterval = setInterval(() => {
            this.fetchOdds();
        }, intervalSeconds * 1000);
        
        this.emit('liveStarted', { interval: intervalSeconds });
    }
    
    stopLiveUpdates() {
        if (!this.isLive) return;
        
        this.isLive = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('⏸️ Live updates stopped');
        this.emit('liveStopped');
    }
    
    // ============================================
    // DEMO DATA
    // ============================================
    
    loadDemoData(sport = 'basketball_nba') {
        console.log('📊 Loading demo data for', sport);
        
        const demoGames = this.generateDemoGames(sport);
        demoGames.forEach(game => {
            this.games.set(game.id, game);
        });
        
        this.emit('oddsUpdated', { sport, count: demoGames.length, demo: true });
    }
    
    generateDemoGames(sport) {
        const games = [];
        const now = new Date();
        
        // Generate 5 demo games
        for (let i = 0; i < 5; i++) {
            const gameTime = new Date(now.getTime() + (i * 2 * 60 * 60 * 1000)); // 2 hours apart
            const game = this.generateDemoGame(sport, gameTime, i);
            games.push(game);
        }
        
        return games;
    }
    
    generateDemoGame(sport, commenceTime, index) {
        const teams = this.getDemoTeams(sport);
        const homeTeam = teams[index * 2] || teams[0];
        const awayTeam = teams[index * 2 + 1] || teams[1];
        
        const gameId = `demo_${sport}_${index}`;
        const bookmakers = new Map();
        
        // Generate odds for random selection of books
        const selectedBooks = this.getRandomBooks(10, 20);
        
        selectedBooks.forEach(bookKey => {
            const odds = this.generateRandomOdds();
            bookmakers.set(bookKey, {
                bookmaker: bookKey,
                name: this.sportsbooks.get(bookKey).name,
                lastUpdate: new Date(),
                markets: odds
            });
        });
        
        return {
            id: gameId,
            sport: sport,
            homeTeam,
            awayTeam,
            commenceTime,
            status: this.getGameStatus(commenceTime),
            bookmakers,
            bestOdds: this.calculateBestOdds(bookmakers),
            arbitrageOpportunities: this.detectArbitrage(bookmakers)
        };
    }
    
    getDemoTeams(sport) {
        const teams = {
            basketball_nba: [
                'Los Angeles Lakers', 'Boston Celtics',
                'Golden State Warriors', 'Milwaukee Bucks',
                'Phoenix Suns', 'Miami Heat',
                'Denver Nuggets', 'Philadelphia 76ers',
                'Brooklyn Nets', 'Dallas Mavericks'
            ],
            americanfootball_nfl: [
                'Kansas City Chiefs', 'Buffalo Bills',
                'San Francisco 49ers', 'Philadelphia Eagles',
                'Dallas Cowboys', 'Miami Dolphins',
                'Baltimore Ravens', 'Cincinnati Bengals',
                'Detroit Lions', 'Green Bay Packers'
            ],
            baseball_mlb: [
                'Los Angeles Dodgers', 'New York Yankees',
                'Houston Astros', 'Atlanta Braves',
                'San Diego Padres', 'Philadelphia Phillies',
                'Toronto Blue Jays', 'Seattle Mariners',
                'Tampa Bay Rays', 'St. Louis Cardinals'
            ],
            icehockey_nhl: [
                'Colorado Avalanche', 'Tampa Bay Lightning',
                'Edmonton Oilers', 'Carolina Hurricanes',
                'Boston Bruins', 'Vegas Golden Knights',
                'Toronto Maple Leafs', 'New York Rangers',
                'Florida Panthers', 'Dallas Stars'
            ]
        };
        
        return teams[sport] || teams.basketball_nba;
    }
    
    generateRandomOdds() {
        const favoredBy = (Math.random() * 10) - 5; // -5 to +5
        const total = 200 + (Math.random() * 50); // 200-250 for basketball
        
        return {
            moneyline: {
                home: this.generateMoneylineOdds(favoredBy),
                away: this.generateMoneylineOdds(-favoredBy)
            },
            spread: {
                home: {
                    odds: -110 + (Math.random() * 20 - 10),
                    line: favoredBy
                },
                away: {
                    odds: -110 + (Math.random() * 20 - 10),
                    line: -favoredBy
                }
            },
            totals: {
                over: {
                    odds: -110 + (Math.random() * 20 - 10),
                    line: total
                },
                under: {
                    odds: -110 + (Math.random() * 20 - 10),
                    line: total
                }
            }
        };
    }
    
    generateMoneylineOdds(spread) {
        if (spread > 0) {
            // Favorite
            return -110 - (Math.abs(spread) * 20) + (Math.random() * 20 - 10);
        } else {
            // Underdog
            return 110 + (Math.abs(spread) * 20) + (Math.random() * 20 - 10);
        }
    }
    
    getRandomBooks(min, max) {
        const bookKeys = Array.from(this.sportsbooks.keys());
        const count = Math.floor(Math.random() * (max - min + 1)) + min;
        const selected = [];
        
        while (selected.length < count && selected.length < bookKeys.length) {
            const randomKey = bookKeys[Math.floor(Math.random() * bookKeys.length)];
            if (!selected.includes(randomKey)) {
                selected.push(randomKey);
            }
        }
        
        return selected;
    }
    
    // ============================================
    // GETTERS
    // ============================================
    
    getAllGames() {
        return Array.from(this.games.values());
    }
    
    getGame(gameId) {
        return this.games.get(gameId);
    }
    
    getSportsbook(bookKey) {
        return this.sportsbooks.get(bookKey);
    }
    
    getAllSportsbooks() {
        return Array.from(this.sportsbooks.values());
    }
    
    getGameStatus(commenceTime) {
        const now = new Date();
        const time = new Date(commenceTime);
        const diff = time - now;
        
        if (diff < -3 * 60 * 60 * 1000) return 'final'; // More than 3 hours ago
        if (diff < 0) return 'live'; // Started
        if (diff < 24 * 60 * 60 * 1000) return 'upcoming'; // Within 24 hours
        return 'scheduled';
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }
}

// Export singleton instance
const oddsComparisonV2 = new OddsComparisonSystemV2();
export { oddsComparisonV2, OddsComparisonSystemV2 };
