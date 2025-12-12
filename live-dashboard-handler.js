// ============================================
// LIVE DASHBOARD WEBSOCKET HANDLER
// Real-time sports data streaming
// ============================================

const axios = require('axios');

// Configuration
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const UPDATE_INTERVAL = 30000; // 30 seconds

// In-memory cache
let gamesCache = {
    basketball: [],
    americanfootball: [],
    baseball: [],
    icehockey: [],
    soccer: [],
    lastUpdate: null
};

// Connected clients
let connectedClients = new Set();

/**
 * Initialize Live Dashboard WebSocket Handler
 */
function initializeLiveDashboard(io) {
    console.log('📊 Initializing Live Dashboard WebSocket handler...');

    // Namespace for live dashboard
    const dashboardNamespace = io.of('/live-dashboard');

    dashboardNamespace.on('connection', (socket) => {
        console.log(`✅ Dashboard client connected: ${socket.id}`);
        connectedClients.add(socket);

        // Send initial data
        socket.emit('initial-data', {
            games: getAllGames(),
            timestamp: Date.now()
        });

        // Handle sport filter requests
        socket.on('filter-sport', (sport) => {
            const games = sport === 'all' 
                ? getAllGames() 
                : gamesCache[sport] || [];
            
            socket.emit('filtered-games', {
                sport,
                games,
                timestamp: Date.now()
            });
        });

        // Handle refresh requests
        socket.on('refresh', async () => {
            await fetchLiveGames();
            socket.emit('games-update', {
                games: getAllGames(),
                timestamp: Date.now()
            });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`❌ Dashboard client disconnected: ${socket.id}`);
            connectedClients.delete(socket);
        });
    });

    // Start periodic updates
    startPeriodicUpdates(dashboardNamespace);

    return dashboardNamespace;
}

/**
 * Start periodic game updates
 */
function startPeriodicUpdates(namespace) {
    // Initial fetch
    fetchLiveGames();

    // Set up interval
    setInterval(async () => {
        try {
            const hasUpdates = await fetchLiveGames();
            
            if (hasUpdates) {
                // Broadcast to all connected clients
                namespace.emit('games-update', {
                    games: getAllGames(),
                    timestamp: Date.now()
                });

                console.log(`📡 Broadcasted updates to ${connectedClients.size} clients`);
            }
        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }, UPDATE_INTERVAL);
}

/**
 * Fetch live games from The Odds API
 */
async function fetchLiveGames() {
    try {
        console.log('🔄 Fetching live games...');

        const sports = [
            'basketball_nba',
            'americanfootball_nfl',
            'baseball_mlb',
            'icehockey_nhl',
            'soccer_epl'
        ];

        let hasUpdates = false;

        for (const sport of sports) {
            try {
                const response = await axios.get(`${ODDS_API_BASE}/sports/${sport}/scores`, {
                    params: {
                        apiKey: ODDS_API_KEY,
                        daysFrom: 0
                    }
                });

                const games = response.data;
                const sportKey = mapSportKey(sport);

                // Check if there are updates
                if (JSON.stringify(gamesCache[sportKey]) !== JSON.stringify(games)) {
                    hasUpdates = true;
                    gamesCache[sportKey] = games.map(game => ({
                        id: game.id,
                        sport: sportKey,
                        status: game.completed ? 'final' : 'live',
                        homeTeam: {
                            name: game.home_team,
                            score: game.scores?.find(s => s.name === game.home_team)?.score || 0,
                            record: '0-0' // Fetch from another API if needed
                        },
                        awayTeam: {
                            name: game.away_team,
                            score: game.scores?.find(s => s.name === game.away_team)?.score || 0,
                            record: '0-0'
                        },
                        time: game.commence_time,
                        spread: null, // Fetch from odds endpoint
                        total: null,
                        moneyline: null
                    }));

                    // Fetch odds for these games
                    await fetchOddsForGames(sport, sportKey);
                }

            } catch (error) {
                console.error(`Error fetching ${sport}:`, error.message);
            }
        }

        gamesCache.lastUpdate = Date.now();
        return hasUpdates;

    } catch (error) {
        console.error('Error fetching live games:', error);
        return false;
    }
}

/**
 * Fetch odds for games
 */
async function fetchOddsForGames(sport, sportKey) {
    try {
        const response = await axios.get(`${ODDS_API_BASE}/sports/${sport}/odds`, {
            params: {
                apiKey: ODDS_API_KEY,
                regions: 'us',
                markets: 'h2h,spreads,totals',
                oddsFormat: 'american'
            }
        });

        const odds = response.data;

        // Update games with odds
        gamesCache[sportKey] = gamesCache[sportKey].map(game => {
            const gameOdds = odds.find(o => o.id === game.id);
            
            if (gameOdds && gameOdds.bookmakers?.length > 0) {
                const bookmaker = gameOdds.bookmakers[0]; // Use first bookmaker
                
                // Find spreads
                const spreadsMarket = bookmaker.markets?.find(m => m.key === 'spreads');
                if (spreadsMarket) {
                    const homeSpread = spreadsMarket.outcomes?.find(o => o.name === game.homeTeam.name);
                    game.spread = homeSpread?.point || null;
                }

                // Find totals
                const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');
                if (totalsMarket) {
                    const overUnder = totalsMarket.outcomes?.[0];
                    game.total = overUnder?.point || null;
                }

                // Find moneyline
                const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
                if (h2hMarket) {
                    const homeML = h2hMarket.outcomes?.find(o => o.name === game.homeTeam.name);
                    game.moneyline = homeML?.price || null;
                }
            }

            return game;
        });

    } catch (error) {
        console.error(`Error fetching odds for ${sport}:`, error.message);
    }
}

/**
 * Get all games across all sports
 */
function getAllGames() {
    return Object.values(gamesCache)
        .filter(games => Array.isArray(games))
        .flat()
        .sort((a, b) => {
            // Sort by status (live first) then by time
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (a.status !== 'live' && b.status === 'live') return 1;
            return new Date(a.time) - new Date(b.time);
        });
}

/**
 * Map API sport key to internal sport key
 */
function mapSportKey(apiSport) {
    const mapping = {
        'basketball_nba': 'basketball',
        'americanfootball_nfl': 'americanfootball',
        'baseball_mlb': 'baseball',
        'icehockey_nhl': 'icehockey',
        'soccer_epl': 'soccer'
    };
    return mapping[apiSport] || apiSport;
}

/**
 * Generate game alert for significant events
 */
function generateGameAlert(game, eventType) {
    let message = '';
    
    switch (eventType) {
        case 'score_update':
            message = `Score update: ${game.awayTeam.name} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.name}`;
            break;
        case 'game_start':
            message = `${game.awayTeam.name} vs ${game.homeTeam.name} has started!`;
            break;
        case 'game_end':
            message = `Final: ${game.awayTeam.name} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.name}`;
            break;
        case 'close_game':
            const diff = Math.abs(game.homeTeam.score - game.awayTeam.score);
            if (diff <= 3) {
                message = `Close game alert! ${game.awayTeam.name} vs ${game.homeTeam.name} - ${diff} point difference`;
            }
            break;
        default:
            message = `Update for ${game.awayTeam.name} vs ${game.homeTeam.name}`;
    }

    return {
        id: `alert-${Date.now()}`,
        gameId: game.id,
        type: eventType,
        message,
        timestamp: Date.now()
    };
}

/**
 * Broadcast alert to all clients
 */
function broadcastAlert(namespace, alert) {
    namespace.emit('game-alert', alert);
    console.log(`🔔 Alert broadcasted: ${alert.message}`);
}

/**
 * Get dashboard statistics
 */
function getDashboardStats() {
    const allGames = getAllGames();
    
    return {
        liveGames: allGames.filter(g => g.status === 'live').length,
        upcomingGames: allGames.filter(g => g.status === 'upcoming').length,
        finalGames: allGames.filter(g => g.status === 'final').length,
        totalGames: allGames.length,
        connectedClients: connectedClients.size,
        lastUpdate: gamesCache.lastUpdate
    };
}

module.exports = {
    initializeLiveDashboard,
    getDashboardStats,
    broadcastAlert
};
