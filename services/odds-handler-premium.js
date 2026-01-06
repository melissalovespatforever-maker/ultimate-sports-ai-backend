// ============================================
// PREMIUM REAL-TIME ODDS HANDLER
// Live odds updates with line movement tracking
// ============================================

const axios = require('axios');

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

class PremiumOddsHandler {
    constructor(io) {
        this.io = io;
        this.subscriptions = new Map(); // Socket subscriptions
        this.updateIntervals = new Map(); // Update timers per sport
        this.oddsCache = new Map(); // Current odds cache
        this.oddsHistory = new Map(); // Historical odds for line movement
        this.lastUpdate = new Map(); // Last update timestamp
        this.lineMovements = new Map(); // Track line movements
        
        // Configuration
        this.updateFrequency = 5000; // 5 seconds (aggressive updates)
        this.historyDepth = 100; // Keep last 100 updates per game
        this.movementThreshold = 5; // Alert on 5+ point moves
    }

    // ============================================
    // CONNECTION HANDLERS
    // ============================================

    handleConnection(socket) {
        console.log(`🎰 Premium Odds WebSocket connected: ${socket.id}`);

        // Event listeners
        socket.on('subscribe_odds', (data) => this.handleSubscribe(socket, data));
        socket.on('unsubscribe_odds', (data) => this.handleUnsubscribe(socket, data));
        socket.on('get_live_odds', (data) => this.handleGetLiveOdds(socket, data));
        socket.on('get_line_movement', (data) => this.handleGetLineMovement(socket, data));
        socket.on('get_best_odds', (data) => this.handleGetBestOdds(socket, data));
        socket.on('track_game', (data) => this.handleTrackGame(socket, data));
        socket.on('ping_odds', () => this.handlePing(socket));
        socket.on('disconnect', () => this.handleDisconnect(socket));

        // Send connection acknowledgment
        socket.emit('odds_connected', {
            status: 'connected',
            updateFrequency: this.updateFrequency,
            features: [
                'real-time odds',
                'line movement tracking',
                'best odds comparison',
                'arbitrage opportunities',
                'steam moves detection'
            ],
            timestamp: Date.now()
        });
    }

    handleSubscribe(socket, data) {
        const { 
            sports = ['basketball_nba', 'americanfootball_nfl'], 
            markets = ['h2h', 'spreads', 'totals'],
            bookmakers = ['fanduel', 'draftkings', 'betmgm'],
            alertOnMovement = true
        } = data;

        // Create subscription
        sports.forEach(sport => {
            const subscriptionKey = `${socket.id}:${sport}`;
            this.subscriptions.set(subscriptionKey, {
                socketId: socket.id,
                sport,
                markets,
                bookmakers,
                alertOnMovement,
                subscribedAt: Date.now()
            });

            // Join room
            socket.join(`odds:${sport}`);
            console.log(`📊 Socket ${socket.id} subscribed to ${sport} odds`);

            // Start updates if not running
            if (!this.updateIntervals.has(sport)) {
                this.startOddsUpdates(sport);
            }

            // Send cached odds immediately
            if (this.oddsCache.has(sport)) {
                socket.emit('odds_snapshot', {
                    sport,
                    odds: this.oddsCache.get(sport),
                    lastUpdate: this.lastUpdate.get(sport),
                    timestamp: Date.now()
                });
            }
        });

        socket.emit('subscription_confirmed', {
            sports,
            markets,
            updateFrequency: this.updateFrequency,
            timestamp: Date.now()
        });
    }

    handleUnsubscribe(socket, data) {
        const { sports = [] } = data;

        sports.forEach(sport => {
            const subscriptionKey = `${socket.id}:${sport}`;
            this.subscriptions.delete(subscriptionKey);
            socket.leave(`odds:${sport}`);
            console.log(`📊 Socket ${socket.id} unsubscribed from ${sport}`);

            // Stop updates if no more subscribers
            const remainingSubscribers = Array.from(this.subscriptions.values())
                .filter(sub => sub.sport === sport);

            if (remainingSubscribers.length === 0) {
                this.stopOddsUpdates(sport);
            }
        });
    }

    handleGetLiveOdds(socket, data) {
        const { sport, gameId } = data;

        if (!sport) {
            socket.emit('error', { message: 'Sport is required' });
            return;
        }

        // Send cached odds or fetch fresh
        if (this.oddsCache.has(sport)) {
            const odds = this.oddsCache.get(sport);
            const filtered = gameId 
                ? odds.filter(o => o.gameId === gameId)
                : odds;

            socket.emit('live_odds', {
                sport,
                gameId,
                odds: filtered,
                cached: true,
                lastUpdate: this.lastUpdate.get(sport),
                timestamp: Date.now()
            });
        } else {
            this.fetchAndSendOdds(socket, sport, gameId);
        }
    }

    handleGetLineMovement(socket, data) {
        const { sport, gameId, bookmaker } = data;

        if (!sport || !gameId) {
            socket.emit('error', { message: 'Sport and gameId required' });
            return;
        }

        const movementKey = `${sport}:${gameId}`;
        const history = this.oddsHistory.get(movementKey) || [];

        // Calculate line movements
        const movements = this.calculateLineMovements(history, bookmaker);

        socket.emit('line_movement', {
            sport,
            gameId,
            bookmaker,
            movements,
            history: history.slice(-20), // Last 20 updates
            timestamp: Date.now()
        });
    }

    handleGetBestOdds(socket, data) {
        const { sport, gameId, market = 'h2h' } = data;

        if (!sport || !gameId) {
            socket.emit('error', { message: 'Sport and gameId required' });
            return;
        }

        const odds = this.oddsCache.get(sport) || [];
        const game = odds.find(o => o.gameId === gameId);

        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        const bestOdds = this.findBestOdds(game, market);

        socket.emit('best_odds', {
            sport,
            gameId,
            market,
            bestOdds,
            arbitrageOpportunity: this.detectArbitrage(bestOdds),
            timestamp: Date.now()
        });
    }

    handleTrackGame(socket, data) {
        const { sport, gameId } = data;

        if (!sport || !gameId) {
            socket.emit('error', { message: 'Sport and gameId required' });
            return;
        }

        // Join specific game room for targeted updates
        socket.join(`odds:${sport}:${gameId}`);
        console.log(`🎯 Socket ${socket.id} tracking game ${gameId}`);

        socket.emit('tracking_confirmed', {
            sport,
            gameId,
            timestamp: Date.now()
        });
    }

    handlePing(socket) {
        socket.emit('pong_odds', {
            serverTimestamp: Date.now(),
            activeSubscriptions: Array.from(this.subscriptions.values())
                .filter(sub => sub.socketId === socket.id)
                .map(sub => sub.sport)
        });
    }

    handleDisconnect(socket) {
        console.log(`🎰 Premium Odds WebSocket disconnected: ${socket.id}`);

        // Clean up subscriptions
        const socketSubs = Array.from(this.subscriptions.entries())
            .filter(([key]) => key.startsWith(socket.id))
            .map(([key]) => key);

        socketSubs.forEach(key => {
            this.subscriptions.delete(key);
        });

        // Stop updates if no subscribers
        const activeSports = new Set(
            Array.from(this.subscriptions.values()).map(sub => sub.sport)
        );

        Array.from(this.updateIntervals.keys()).forEach(sport => {
            if (!activeSports.has(sport)) {
                this.stopOddsUpdates(sport);
            }
        });
    }

    // ============================================
    // ODDS FETCHING & UPDATES
    // ============================================

    startOddsUpdates(sport) {
        console.log(`🔄 Starting premium odds updates for ${sport}`);

        // Fetch immediately
        this.fetchAndBroadcastOdds(sport);

        // Then fetch at intervals
        const interval = setInterval(async () => {
            await this.fetchAndBroadcastOdds(sport);
        }, this.updateFrequency);

        this.updateIntervals.set(sport, interval);
    }

    stopOddsUpdates(sport) {
        console.log(`🛑 Stopping odds updates for ${sport}`);

        if (this.updateIntervals.has(sport)) {
            clearInterval(this.updateIntervals.get(sport));
            this.updateIntervals.delete(sport);
        }

        // Keep cache for 5 minutes
        setTimeout(() => {
            this.oddsCache.delete(sport);
            this.lastUpdate.delete(sport);
        }, 5 * 60 * 1000);
    }

    async fetchAndBroadcastOdds(sport) {
        try {
            const odds = await this.fetchOdds(sport);

            if (!odds || odds.length === 0) return;

            // Get previous odds for comparison
            const previousOdds = this.oddsCache.get(sport) || [];

            // Detect line movements
            const movements = this.detectLineMovements(previousOdds, odds);

            // Update cache
            this.oddsCache.set(sport, odds);
            this.lastUpdate.set(sport, Date.now());

            // Store history
            odds.forEach(game => {
                const historyKey = `${sport}:${game.gameId}`;
                if (!this.oddsHistory.has(historyKey)) {
                    this.oddsHistory.set(historyKey, []);
                }
                const history = this.oddsHistory.get(historyKey);
                history.push({
                    ...game,
                    timestamp: Date.now()
                });
                // Keep only recent history
                if (history.length > this.historyDepth) {
                    history.shift();
                }
            });

            // Broadcast to all subscribers
            this.io.to(`odds:${sport}`).emit('odds_update', {
                type: 'odds_update',
                sport,
                odds,
                movements,
                count: odds.length,
                timestamp: Date.now()
            });

            // Send line movement alerts
            if (movements.length > 0) {
                this.broadcastLineMovementAlerts(sport, movements);
            }

            console.log(`📊 Broadcast odds for ${sport}: ${odds.length} games, ${movements.length} movements`);

        } catch (error) {
            console.error(`❌ Error fetching odds for ${sport}:`, error.message);

            this.io.to(`odds:${sport}`).emit('odds_error', {
                sport,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    async fetchOdds(sport) {
        try {
            if (!process.env.THE_ODDS_API_KEY) {
                throw new Error('THE_ODDS_API_KEY not configured');
            }

            const response = await axios.get(`${ODDS_API_BASE}/sports/${sport}/odds`, {
                params: {
                    apiKey: process.env.THE_ODDS_API_KEY,
                    regions: 'us',
                    markets: 'h2h,spreads,totals',
                    oddsFormat: 'american',
                    dateFormat: 'iso'
                },
                timeout: 10000
            });

            return this.transformOdds(response.data, sport);

        } catch (error) {
            if (error.response?.status === 401) {
                console.error('❌ Invalid Odds API key');
            } else if (error.response?.status === 429) {
                console.error('❌ Odds API rate limit exceeded');
            }
            throw error;
        }
    }

    async fetchAndSendOdds(socket, sport, gameId = null) {
        try {
            const odds = await this.fetchOdds(sport);

            const filtered = gameId 
                ? odds.filter(o => o.gameId === gameId)
                : odds;

            socket.emit('live_odds', {
                sport,
                gameId,
                odds: filtered,
                cached: false,
                timestamp: Date.now()
            });

        } catch (error) {
            socket.emit('error', {
                message: `Failed to fetch odds: ${error.message}`,
                timestamp: Date.now()
            });
        }
    }

    transformOdds(data, sport) {
        return (data || []).map(game => {
            const bookmakers = (game.bookmakers || []).map(bm => {
                const markets = {};
                
                (bm.markets || []).forEach(market => {
                    markets[market.key] = {
                        lastUpdate: market.last_update,
                        outcomes: (market.outcomes || []).map(outcome => ({
                            name: outcome.name,
                            price: outcome.price,
                            point: outcome.point // For spreads/totals
                        }))
                    };
                });

                return {
                    name: bm.key,
                    title: bm.title,
                    lastUpdate: bm.last_update,
                    markets
                };
            });

            return {
                gameId: game.id,
                sport,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                commenceTime: game.commence_time,
                bookmakers,
                timestamp: Date.now()
            };
        });
    }

    // ============================================
    // LINE MOVEMENT DETECTION
    // ============================================

    detectLineMovements(previousOdds, currentOdds) {
        const movements = [];

        currentOdds.forEach(currentGame => {
            const previousGame = previousOdds.find(g => g.gameId === currentGame.gameId);
            if (!previousGame) return;

            currentGame.bookmakers.forEach(currentBook => {
                const previousBook = previousGame.bookmakers.find(b => b.name === currentBook.name);
                if (!previousBook) return;

                // Check each market
                ['h2h', 'spreads', 'totals'].forEach(marketKey => {
                    const currentMarket = currentBook.markets[marketKey];
                    const previousMarket = previousBook.markets[marketKey];

                    if (!currentMarket || !previousMarket) return;

                    const movement = this.compareMarkets(
                        previousMarket,
                        currentMarket,
                        currentGame,
                        currentBook.name,
                        marketKey
                    );

                    if (movement) {
                        movements.push(movement);
                    }
                });
            });
        });

        return movements;
    }

    compareMarkets(previousMarket, currentMarket, game, bookmaker, marketType) {
        const movements = [];

        currentMarket.outcomes.forEach(currentOutcome => {
            const previousOutcome = previousMarket.outcomes.find(o => o.name === currentOutcome.name);
            if (!previousOutcome) return;

            const priceDiff = currentOutcome.price - previousOutcome.price;
            const pointDiff = (currentOutcome.point || 0) - (previousOutcome.point || 0);

            // Significant movement detected
            if (Math.abs(priceDiff) >= this.movementThreshold || Math.abs(pointDiff) >= 0.5) {
                movements.push({
                    gameId: game.gameId,
                    homeTeam: game.homeTeam,
                    awayTeam: game.awayTeam,
                    bookmaker,
                    market: marketType,
                    team: currentOutcome.name,
                    previousPrice: previousOutcome.price,
                    currentPrice: currentOutcome.price,
                    priceDiff,
                    previousPoint: previousOutcome.point,
                    currentPoint: currentOutcome.point,
                    pointDiff,
                    direction: priceDiff > 0 ? 'up' : 'down',
                    magnitude: Math.abs(priceDiff),
                    isSteamMove: Math.abs(priceDiff) >= 20, // 20+ point move = steam
                    timestamp: Date.now()
                });
            }
        });

        return movements.length > 0 ? movements[0] : null;
    }

    calculateLineMovements(history, bookmaker = null) {
        if (history.length < 2) return [];

        const movements = [];
        
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1];
            const curr = history[i];

            curr.bookmakers.forEach(currentBook => {
                if (bookmaker && currentBook.name !== bookmaker) return;

                const prevBook = prev.bookmakers.find(b => b.name === currentBook.name);
                if (!prevBook) return;

                ['h2h', 'spreads', 'totals'].forEach(marketKey => {
                    const movement = this.compareMarkets(
                        prevBook.markets[marketKey],
                        currentBook.markets[marketKey],
                        curr,
                        currentBook.name,
                        marketKey
                    );

                    if (movement) {
                        movements.push({
                            ...movement,
                            previousTimestamp: prev.timestamp,
                            currentTimestamp: curr.timestamp
                        });
                    }
                });
            });
        }

        return movements;
    }

    broadcastLineMovementAlerts(sport, movements) {
        const significantMovements = movements.filter(m => m.magnitude >= 10);

        if (significantMovements.length === 0) return;

        // Alert subscribers who opted in
        const subscribers = Array.from(this.subscriptions.values())
            .filter(sub => sub.sport === sport && sub.alertOnMovement);

        subscribers.forEach(sub => {
            this.io.to(sub.socketId).emit('line_movement_alert', {
                sport,
                movements: significantMovements,
                count: significantMovements.length,
                timestamp: Date.now()
            });
        });

        console.log(`🚨 Sent ${significantMovements.length} line movement alerts for ${sport}`);
    }

    // ============================================
    // BEST ODDS & ARBITRAGE
    // ============================================

    findBestOdds(game, market) {
        const bestOdds = {
            homeTeam: { bookmaker: null, price: -Infinity, point: null },
            awayTeam: { bookmaker: null, price: -Infinity, point: null },
            over: { bookmaker: null, price: -Infinity, point: null },
            under: { bookmaker: null, price: -Infinity, point: null }
        };

        game.bookmakers.forEach(bookmaker => {
            const marketData = bookmaker.markets[market];
            if (!marketData) return;

            marketData.outcomes.forEach(outcome => {
                const key = outcome.name === game.homeTeam ? 'homeTeam' :
                            outcome.name === game.awayTeam ? 'awayTeam' :
                            outcome.name === 'Over' ? 'over' :
                            outcome.name === 'Under' ? 'under' : null;

                if (key && outcome.price > bestOdds[key].price) {
                    bestOdds[key] = {
                        bookmaker: bookmaker.title,
                        price: outcome.price,
                        point: outcome.point
                    };
                }
            });
        });

        return bestOdds;
    }

    detectArbitrage(bestOdds) {
        // Calculate implied probabilities
        const calc = (price) => {
            if (price > 0) return 100 / (price + 100);
            return (-price) / (-price + 100);
        };

        const homeImplied = calc(bestOdds.homeTeam.price);
        const awayImplied = calc(bestOdds.awayTeam.price);
        const totalImplied = homeImplied + awayImplied;

        // Arbitrage opportunity if total < 1
        const hasArbitrage = totalImplied < 1;
        const profitMargin = hasArbitrage ? ((1 / totalImplied) - 1) * 100 : 0;

        return {
            hasArbitrage,
            profitMargin: profitMargin.toFixed(2),
            homeImpliedProb: (homeImplied * 100).toFixed(2),
            awayImpliedProb: (awayImplied * 100).toFixed(2),
            totalImpliedProb: (totalImplied * 100).toFixed(2)
        };
    }
}

module.exports = PremiumOddsHandler;
