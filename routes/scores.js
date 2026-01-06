// ============================================
// LIVE SCORES ROUTES - ESPN DATA PROXY
// Real-time game scores with caching
// ============================================

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { optionalAuth } = require('../middleware/auth');

// Cache for ESPN data
const cache = new Map();
const CACHE_DURATION = 15000; // 15 seconds for live scores

// Sport endpoints mapping
const ESPN_ENDPOINTS = {
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

/**
 * Helper: Get cached data or fetch fresh
 */
async function getCachedOrFetch(key, fetchFn, duration = CACHE_DURATION) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < duration) {
        console.log(`📦 Using cached scores for ${key}`);
        return cached.data;
    }
    
    try {
        const data = await fetchFn();
        cache.set(key, { data, timestamp: Date.now() });
        console.log(`✅ Fetched fresh scores for ${key}`);
        return data;
    } catch (error) {
        console.error(`❌ Fetch error for ${key}:`, error.message);
        // Return stale cache if available
        if (cached) {
            console.warn(`⚠️ Returning stale cache for ${key}`);
            return cached.data;
        }
        throw error;
    }
}

/**
 * GET /api/scores/sports
 * Get list of available sports
 */
router.get('/sports', optionalAuth, async (req, res) => {
    try {
        const sports = Object.keys(ESPN_ENDPOINTS).map(key => ({
            name: key,
            label: key.charAt(0).toUpperCase() + key.slice(1)
        }));

        res.json({
            success: true,
            sports: sports,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error fetching sports list:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sports list',
            details: error.message
        });
    }
});

/**
 * GET /api/scores/:sport
 * Get live scores for a specific sport
 */
router.get('/:sport', optionalAuth, async (req, res) => {
    try {
        const sport = req.params.sport.toLowerCase();
        const endpoint = ESPN_ENDPOINTS[sport];

        if (!endpoint) {
            return res.status(400).json({
                success: false,
                error: 'Invalid sport',
                details: `Sport '${sport}' not found. Available: ${Object.keys(ESPN_ENDPOINTS).join(', ')}`
            });
        }

        console.log(`📊 Fetching scores for ${sport}...`);

        const data = await getCachedOrFetch(
            `scores_${sport}`,
            async () => {
                const response = await axios.get(endpoint, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Ultimate-Sports-AI/1.0'
                    }
                });

                if (!response.data || !response.data.events) {
                    throw new Error('Invalid ESPN response');
                }

                return response.data.events;
            }
        );

        // Process events
        const games = data.map(event => parseGame(event, sport)).filter(Boolean);

        res.json({
            success: true,
            sport: sport,
            count: games.length,
            games: games,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error fetching scores for ${req.params.sport}:`, error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch scores',
            details: error.message
        });
    }
});

/**
 * GET /api/scores/team/:teamId
 * Get upcoming and recent games for a team
 */
router.get('/team/:teamId', optionalAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        console.log(`🔍 Searching for team: ${teamId}`);

        // Search across all sports
        const sports = Object.keys(ESPN_ENDPOINTS);
        const teamGames = [];

        for (const sport of sports) {
            try {
                const endpoint = ESPN_ENDPOINTS[sport];
                const data = await axios.get(endpoint, { timeout: 5000 });
                
                if (data.data.events) {
                    const matches = data.data.events.filter(event => {
                        const competitors = event.competitions?.[0]?.competitors || [];
                        return competitors.some(c => 
                            c.id === teamId || c.uid === teamId || c.displayName.toLowerCase().includes(teamId.toLowerCase())
                        );
                    });

                    matches.forEach(event => {
                        const game = parseGame(event, sport);
                        if (game) teamGames.push(game);
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Error searching ${sport}:`, error.message);
            }
        }

        res.json({
            success: true,
            teamId: teamId,
            count: teamGames.length,
            games: teamGames,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching team games:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team games',
            details: error.message
        });
    }
});

/**
 * GET /api/scores/live
 * Get all currently live games across all sports
 */
router.get('/live/all', optionalAuth, async (req, res) => {
    try {
        console.log('🔴 Fetching all live games...');

        const sports = Object.keys(ESPN_ENDPOINTS);
        const liveGames = [];

        const results = await Promise.all(
            sports.map(sport => 
                getCachedOrFetch(
                    `scores_${sport}`,
                    async () => {
                        const response = await axios.get(ESPN_ENDPOINTS[sport], {
                            timeout: 5000
                        });
                        return response.data.events || [];
                    }
                ).catch(() => [])
            )
        );

        // Flatten and filter for live games
        results.forEach((events, idx) => {
            const sport = sports[idx];
            events.forEach(event => {
                if (event.status?.type === 'in') {
                    const game = parseGame(event, sport);
                    if (game) liveGames.push(game);
                }
            });
        });

        res.json({
            success: true,
            liveCount: liveGames.length,
            games: liveGames,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching live games:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch live games',
            details: error.message
        });
    }
});

/**
 * Parse ESPN game event into standardized format
 */
function parseGame(event, sport) {
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
            status: event.status?.type || 'unknown',
            statusDescription: event.status?.description || '',
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
 * Clear cache endpoint (admin only in production)
 */
router.delete('/cache/clear', (req, res) => {
    cache.clear();
    console.log('🗑️ Scores cache cleared');
    res.json({
        success: true,
        message: 'Cache cleared'
    });
});

module.exports = router;
