// ============================================
// WEBSOCKET ODDS HANDLER
// Real-time odds updates via WebSocket
// ============================================

const axios = require('axios');

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORTS_MAP = {
    'basketball_nba': 'nba',
    'americanfootball_nfl': 'nfl',
    'baseball_mlb': 'mlb',
    'soccer_epl': 'epl',
    'soccer_fifa_world_cup': 'world_cup'
};

class OddsHandler {
    constructor(io) {
        this.io = io;
        this.subscriptions = new Map();
        this.updateIntervals = new Map();
        this.updateFrequency = 5000; // 5 seconds
        this.oddsCache = new Map();
        this.lastUpdate = new Map();
    }

    handleConnection(socket) {
        console.log(`🎮 Odds WebSocket connected: ${socket.id}`);

        socket.on('subscribe', (data) => this.handleSubscribe(socket, data));
        socket.on('unsubscribe', (data) => this.handleUnsubscribe(socket, data));
        socket.on('ping', (data) => this.handlePing(socket, data));
        socket.on('get_odds', (data) => this.handleGetOdds(socket, data));
        socket.on('disconnect', () => this.handleDisconnect(socket));
    }

    handleSubscribe(socket, data) {
        const { sport, markets = ['h2h', 'spreads', 'totals'], regions = ['us'] } = data;

        if (!sport) {
            socket.emit('error', { message: 'Sport is required' });
            return;
        }

        // Add to subscription tracking
        const subscriptionKey = `${socket.id}:${sport}`;
        this.subscriptions.set(subscriptionKey, {
            socketId: socket.id,
            sport,
            markets,
            regions,
            subscribedAt: Date.now()
        });

        // Join a room for this sport
        socket.join(`odds:${sport}`);

        console.log(`📊 Socket ${socket.id} subscribed to ${sport}`);

        // Send subscription acknowledgment
        socket.emit('subscription_ack', {
            sport,
            status: 'active',
            timestamp: Date.now()
        });

        // Start updates if not already running for this sport
        if (!this.updateIntervals.has(sport)) {
            this.startOddsUpdates(sport);
        }
    }

    handleUnsubscribe(socket, data) {
        const { sport } = data;

        if (!sport) return;

        const subscriptionKey = `${socket.id}:${sport}`;
        this.subscriptions.delete(subscriptionKey);

        socket.leave(`odds:${sport}`);

        console.log(`📊 Socket ${socket.id} unsubscribed from ${sport}`);

        // Stop updates if no more subscribers
        const sportSubscribers = Array.from(this.subscriptions.values()).filter(
            sub => sub.sport === sport
        );

        if (sportSubscribers.length === 0) {
            this.stopOddsUpdates(sport);
        }
    }

    handlePing(socket, data) {
        socket.emit('pong', {
            clientTimestamp: data.timestamp,
            serverTimestamp: Date.now()
        });
    }

    handleGetOdds(socket, data) {
        const { sport, gameId } = data;

        if (!sport) {
            socket.emit('error', { message: 'Sport is required' });
            return;
        }

        this.fetchAndSendOdds(socket, sport, gameId);
    }

    handleDisconnect(socket) {
        console.log(`🎮 Odds WebSocket disconnected: ${socket.id}`);

        // Clean up subscriptions for this socket
        const socketsSubscriptions = Array.from(this.subscriptions.entries())
            .filter(([key]) => key.startsWith(socket.id))
            .map(([key]) => key);

        socketsSubscriptions.forEach(key => {
            this.subscriptions.delete(key);
        });

        // Stop updates if no more subscribers for any sport
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
    // ODDS FETCHING AND UPDATES
    // ============================================

    startOddsUpdates(sport) {
        console.log(`🔄 Starting odds updates for ${sport}`);

        const interval = setInterval(async () => {
            try {
                const odds = await this.fetchOdds(sport);

                if (odds && odds.length > 0) {
                    this.oddsCache.set(sport, odds);
                    this.lastUpdate.set(sport, Date.now());

                    // Broadcast to all subscribers
                    this.io.to(`odds:${sport}`).emit('odds_update', {
                        type: 'odds_update',
                        sport,
                        odds,
                        count: odds.length,
                        timestamp: Date.now()
                    });

                    console.log(`📊 Sent odds update for ${sport}: ${odds.length} games`);
                }
            } catch (error) {
                console.error(`Error fetching odds for ${sport}:`, error.message);

                this.io.to(`odds:${sport}`).emit('error', {
                    type: 'error',
                    sport,
                    message: `Failed to fetch odds: ${error.message}`,
                    timestamp: Date.now()
                });
            }
        }, this.updateFrequency);

        this.updateIntervals.set(sport, interval);
    }

    stopOddsUpdates(sport) {
        console.log(`🛑 Stopping odds updates for ${sport}`);

        if (this.updateIntervals.has(sport)) {
            clearInterval(this.updateIntervals.get(sport));
            this.updateIntervals.delete(sport);
        }

        this.oddsCache.delete(sport);
        this.lastUpdate.delete(sport);
    }

    async fetchOdds(sport) {
        try {
            const response = await axios.get(`${ODDS_API_BASE}/sports/${sport}/odds`, {
                params: {
                    apiKey: process.env.THE_ODDS_API_KEY,
                    regions: 'us',
                    markets: 'h2h,spreads,totals',
                    oddsFormat: 'american'
                },
                timeout: 10000
            });

            return this.transformOdds(response.data, sport);
        } catch (error) {
            console.error(`Error fetching odds for ${sport}:`, error.message);
            throw error;
        }
    }

    async fetchAndSendOdds(socket, sport, gameId = null) {
        try {
            const odds = await this.fetchOdds(sport);

            if (gameId) {
                const filtered = odds.filter(o => o.gameId === gameId);
                socket.emit('odds_update', {
                    type: 'odds_update',
                    sport,
                    gameId,
                    odds: filtered,
                    timestamp: Date.now()
                });
            } else {
                socket.emit('odds_update', {
                    type: 'odds_update',
                    sport,
                    odds,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            socket.emit('error', {
                message: `Failed to fetch odds: ${error.message}`,
                timestamp: Date.now()
            });
        }
    }

    transformOdds(data, sport) {
        return (data || []).map(game => ({
            gameId: game.id,
            sport,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commenceTime: game.commence_time,
            status: game.status,
            bookmakers: (game.bookmakers || []).map(bm => ({
                name: bm.key,
                title: bm.title,
                markets: (bm.markets || []).reduce((acc, market) => {
                    acc[market.key] = {
                        outcomes: (market.outcomes || []).map(outcome => ({
                            name: outcome.name,
                            price: outcome.price
                        }))
                    };
                    return acc;
                }, {})
            })),
            timestamp: Date.now()
        }));
    }
}

module.exports = OddsHandler;
