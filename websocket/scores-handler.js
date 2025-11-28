// ============================================
// SCORES WEBSOCKET HANDLER
// Real-time score updates via WebSocket
// ============================================

const axios = require('axios');

class ScoresHandler {
    constructor(io) {
        this.io = io;
        this.scoresNamespace = io.of('/scores');
        this.subscribers = new Map(); // sport -> Set of socket IDs
        this.updateIntervals = new Map(); // sport -> interval ID
        this.cache = new Map(); // sport -> { data, timestamp }
        this.CACHE_DURATION = 15000; // 15 seconds
        this.UPDATE_INTERVAL = 15000; // 15 seconds for live updates
        
        // ESPN endpoints
        this.ESPN_ENDPOINTS = {
            'basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/events',
            'nba': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/events',
            'football': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/events',
            'nfl': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/events',
            'baseball': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/events',
            'mlb': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/events',
            'hockey': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/events',
            'nhl': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/events',
            'soccer': 'https://site.api.espn.com/apis/site/v2/sports/soccer/mls/events',
            'mls': 'https://site.api.espn.com/apis/site/v2/sports/soccer/mls/events',
            'college-football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/events',
            'college-basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/college-basketball/events'
        };
        
        this.setupNamespace();
    }
    
    setupNamespace() {
        this.scoresNamespace.on('connection', (socket) => {
            console.log(`🏈 Scores WebSocket connected: ${socket.id}`);
            
            // Subscribe to sport scores
            socket.on('subscribe:sport', async (sport) => {
                await this.handleSportSubscription(socket, sport);
            });
            
            // Unsubscribe from sport
            socket.on('unsubscribe:sport', (sport) => {
                this.handleSportUnsubscription(socket, sport);
            });
            
            // Subscribe to all live games
            socket.on('subscribe:live', async () => {
                await this.handleLiveSubscription(socket);
            });
            
            // Force refresh scores for a sport
            socket.on('refresh:sport', async (sport) => {
                await this.forceRefreshSport(socket, sport);
            });
            
            // Get initial scores immediately
            socket.on('get:scores', async (sport) => {
                await this.sendInitialScores(socket, sport);
            });
            
            // Disconnect cleanup
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
                console.log(`🏈 Scores WebSocket disconnected: ${socket.id}`);
            });
        });
    }
    
    /**
     * Handle sport subscription
     */
    async handleSportSubscription(socket, sport) {
        try {
            const normalizedSport = sport.toLowerCase();
            
            if (!this.ESPN_ENDPOINTS[normalizedSport]) {
                socket.emit('error', { 
                    message: `Invalid sport: ${sport}`,
                    sport: normalizedSport
                });
                return;
            }
            
            // Add to subscribers
            if (!this.subscribers.has(normalizedSport)) {
                this.subscribers.set(normalizedSport, new Set());
            }
            this.subscribers.get(normalizedSport).add(socket.id);
            
            // Join room for this sport
            socket.join(`sport:${normalizedSport}`);
            
            console.log(`✅ ${socket.id} subscribed to ${normalizedSport} scores`);
            
            // Send initial data immediately
            await this.sendInitialScores(socket, normalizedSport);
            
            // Start update interval if not already running
            if (!this.updateIntervals.has(normalizedSport)) {
                this.startSportUpdates(normalizedSport);
            }
        } catch (error) {
            console.error(`❌ Error in handleSportSubscription:`, error);
            socket.emit('error', { 
                message: 'Failed to subscribe to sport',
                details: error.message
            });
        }
    }
    
    /**
     * Handle sport unsubscription
     */
    handleSportUnsubscription(socket, sport) {
        const normalizedSport = sport.toLowerCase();
        
        if (this.subscribers.has(normalizedSport)) {
            this.subscribers.get(normalizedSport).delete(socket.id);
            
            // Stop updates if no more subscribers
            if (this.subscribers.get(normalizedSport).size === 0) {
                this.stopSportUpdates(normalizedSport);
                this.subscribers.delete(normalizedSport);
            }
        }
        
        socket.leave(`sport:${normalizedSport}`);
        console.log(`🚫 ${socket.id} unsubscribed from ${normalizedSport} scores`);
    }
    
    /**
     * Handle live games subscription
     */
    async handleLiveSubscription(socket) {
        try {
            socket.join('live:all');
            console.log(`🔴 ${socket.id} subscribed to all live games`);
            
            // Send initial live games
            await this.sendAllLiveGames(socket);
            
            // Start live games updates
            if (!this.updateIntervals.has('live:all')) {
                this.startLiveUpdates();
            }
        } catch (error) {
            console.error(`❌ Error in handleLiveSubscription:`, error);
            socket.emit('error', { 
                message: 'Failed to subscribe to live games',
                details: error.message
            });
        }
    }
    
    /**
     * Handle disconnect
     */
    handleDisconnect(socket) {
        // Remove from all sport subscriptions
        this.subscribers.forEach((subscribers, sport) => {
            if (subscribers.has(socket.id)) {
                subscribers.delete(socket.id);
                
                // Stop updates if no more subscribers
                if (subscribers.size === 0) {
                    this.stopSportUpdates(sport);
                    this.subscribers.delete(sport);
                }
            }
        });
    }
    
    /**
     * Send initial scores to a socket
     */
    async sendInitialScores(socket, sport) {
        try {
            const games = await this.fetchSportScores(sport);
            socket.emit('scores:initial', {
                sport: sport,
                games: games,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`❌ Error sending initial scores for ${sport}:`, error.message);
            socket.emit('error', {
                message: 'Failed to fetch initial scores',
                sport: sport
            });
        }
    }
    
    /**
     * Send all live games to a socket
     */
    async sendAllLiveGames(socket) {
        try {
            const liveGames = await this.fetchAllLiveGames();
            socket.emit('live:initial', {
                games: liveGames,
                count: liveGames.length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`❌ Error sending live games:`, error.message);
            socket.emit('error', {
                message: 'Failed to fetch live games'
            });
        }
    }
    
    /**
     * Force refresh for a sport
     */
    async forceRefreshSport(socket, sport) {
        const normalizedSport = sport.toLowerCase();
        
        try {
            // Clear cache
            this.cache.delete(`sport:${normalizedSport}`);
            
            // Fetch fresh data
            const games = await this.fetchSportScores(normalizedSport);
            
            // Broadcast to room
            this.scoresNamespace.to(`sport:${normalizedSport}`).emit('scores:update', {
                sport: normalizedSport,
                games: games,
                timestamp: new Date().toISOString(),
                forced: true
            });
            
            console.log(`🔄 Force refreshed ${normalizedSport} scores`);
        } catch (error) {
            console.error(`❌ Error force refreshing ${sport}:`, error.message);
            socket.emit('error', {
                message: 'Failed to refresh scores',
                sport: normalizedSport
            });
        }
    }
    
    /**
     * Start periodic updates for a sport
     */
    startSportUpdates(sport) {
        const intervalId = setInterval(async () => {
            try {
                const games = await this.fetchSportScores(sport);
                
                // Broadcast to all subscribers
                this.scoresNamespace.to(`sport:${sport}`).emit('scores:update', {
                    sport: sport,
                    games: games,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`📊 Updated ${sport} scores for ${this.subscribers.get(sport)?.size || 0} clients`);
            } catch (error) {
                console.error(`❌ Error updating ${sport} scores:`, error.message);
            }
        }, this.UPDATE_INTERVAL);
        
        this.updateIntervals.set(sport, intervalId);
        console.log(`▶️ Started updates for ${sport}`);
    }
    
    /**
     * Stop updates for a sport
     */
    stopSportUpdates(sport) {
        if (this.updateIntervals.has(sport)) {
            clearInterval(this.updateIntervals.get(sport));
            this.updateIntervals.delete(sport);
            console.log(`⏹️ Stopped updates for ${sport}`);
        }
    }
    
    /**
     * Start live games updates
     */
    startLiveUpdates() {
        const intervalId = setInterval(async () => {
            try {
                const liveGames = await this.fetchAllLiveGames();
                
                // Broadcast to all live subscribers
                this.scoresNamespace.to('live:all').emit('live:update', {
                    games: liveGames,
                    count: liveGames.length,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`🔴 Updated live games (${liveGames.length} games)`);
            } catch (error) {
                console.error(`❌ Error updating live games:`, error.message);
            }
        }, this.UPDATE_INTERVAL);
        
        this.updateIntervals.set('live:all', intervalId);
        console.log(`▶️ Started live games updates`);
    }
    
    /**
     * Fetch scores for a sport with caching
     */
    async fetchSportScores(sport) {
        const cacheKey = `sport:${sport}`;
        const cached = this.cache.get(cacheKey);
        
        // Return cached if fresh
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.games;
        }
        
        // Fetch fresh data
        const endpoint = this.ESPN_ENDPOINTS[sport];
        if (!endpoint) {
            throw new Error(`Invalid sport: ${sport}`);
        }
        
        try {
            const response = await axios.get(endpoint, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Ultimate-Sports-AI/1.0'
                }
            });
            
            if (!response.data || !response.data.events) {
                throw new Error('Invalid ESPN response');
            }
            
            const games = response.data.events.map(event => this.parseGame(event, sport)).filter(Boolean);
            
            // Cache it
            this.cache.set(cacheKey, {
                games: games,
                timestamp: Date.now()
            });
            
            return games;
            
        } catch (error) {
            // Return stale cache if available
            if (cached) {
                console.warn(`⚠️ Returning stale cache for ${sport}`);
                return cached.games;
            }
            throw error;
        }
    }
    
    /**
     * Fetch all live games across sports
     */
    async fetchAllLiveGames() {
        const sports = Object.keys(this.ESPN_ENDPOINTS).filter(s => !s.includes('-'));
        const liveGames = [];
        
        await Promise.all(
            sports.map(async (sport) => {
                try {
                    const games = await this.fetchSportScores(sport);
                    // ESPN uses 'in' for live games
                    const live = games.filter(g => g.status === 'in' || g.status === 'live' || g.statusDescription?.toLowerCase().includes('live'));
                    liveGames.push(...live);
                } catch (error) {
                    console.warn(`⚠️ Error fetching ${sport} for live games:`, error.message);
                }
            })
        );
        
        return liveGames;
    }
    
    /**
     * Parse ESPN game event into standardized format
     */
    parseGame(event, sport) {
        try {
            const competition = event.competitions?.[0];
            if (!competition) return null;

            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');

            if (!homeTeam || !awayTeam) return null;

            return {
                id: event.id,
                uid: event.uid,
                name: event.name,
                sport: sport,
                
                // Teams
                homeTeam: {
                    id: homeTeam.id,
                    name: homeTeam.displayName,
                    abbreviation: homeTeam.abbreviation,
                    logo: homeTeam.logo,
                    score: parseInt(homeTeam.score) || 0,
                    wins: homeTeam.record?.[0]?.summary || '',
                    losses: homeTeam.record?.[1]?.summary || ''
                },
                awayTeam: {
                    id: awayTeam.id,
                    name: awayTeam.displayName,
                    abbreviation: awayTeam.abbreviation,
                    logo: awayTeam.logo,
                    score: parseInt(awayTeam.score) || 0,
                    wins: awayTeam.record?.[0]?.summary || '',
                    losses: awayTeam.record?.[1]?.summary || ''
                },

                // Game info
                status: event.status?.type?.state || event.status?.type || 'unknown',
                statusDescription: event.status?.type?.description || event.status?.type?.detail || '',
                dateTime: event.date,
                venue: competition.venue?.fullName || 'TBA',
                
                // Game details
                period: competition.status?.period || 0,
                clock: competition.status?.displayClock || '0:00',
                broadcast: competition.broadcasts?.[0]?.names?.[0] || null,
                
                // Links
                espnLink: event.links?.find(l => l.text === 'Gamecast')?.href || event.links?.[0]?.href
            };
        } catch (error) {
            console.warn('⚠️ Error parsing game:', error);
            return null;
        }
    }
    
    /**
     * Cleanup - stop all intervals
     */
    cleanup() {
        this.updateIntervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.updateIntervals.clear();
        this.subscribers.clear();
        this.cache.clear();
        console.log('🧹 Scores handler cleaned up');
    }
}

module.exports = ScoresHandler;
