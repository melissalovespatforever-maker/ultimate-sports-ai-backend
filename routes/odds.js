// Odds routes - proxy to The Odds API
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { optionalAuth } = require('../middleware/auth');

// Cache to reduce API calls
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Helper: Get cached data or fetch fresh
 */
async function getCachedOrFetch(key, fetchFn, duration = CACHE_DURATION) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < duration) {
        return cached.data;
    }
    
    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
}

/**
 * GET /api/odds/live (legacy endpoint)
 * Get live odds for a specific sport via query parameter
 */
router.get('/live', optionalAuth, async (req, res, next) => {
    try {
        if (!process.env.THE_ODDS_API_KEY) {
            console.error('❌ THE_ODDS_API_KEY not configured in environment');
            return res.status(500).json({
                success: false,
                error: 'API configuration error',
                details: 'THE_ODDS_API_KEY is not configured'
            });
        }
        
        const { sport = 'basketball_nba' } = req.query;
        
        console.log(`📊 /live endpoint called with sport: ${sport}`);
        
        const cacheKey = `odds_live_${sport}`;
        
        const odds = await getCachedOrFetch(cacheKey, async () => {
            try {
                console.log(`🔗 Calling The Odds API for ${sport}...`);
                const response = await axios.get(
                    `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
                    {
                        params: {
                            apiKey: process.env.THE_ODDS_API_KEY,
                            regions: 'us',
                            markets: 'h2h,spreads,totals',
                            oddsFormat: 'american'
                        }
                    }
                );
                
                console.log(`✅ The Odds API returned ${response.data.length} games`);
                return response.data;
            } catch (axiosError) {
                console.error(`❌ The Odds API error:`, axiosError.response?.status, axiosError.response?.data?.msg);
                throw axiosError;
            }
        });
        
        res.json({ 
            success: true,
            sport: sport,
            timestamp: new Date().toISOString(),
            odds: odds 
        });
    } catch (error) {
        console.error('❌ Error fetching live odds:', error.message);
        const statusCode = error.response?.status === 404 ? 404 : 500;
        res.status(statusCode).json({ 
            success: false, 
            error: 'Failed to fetch live odds',
            details: error.message,
            apiStatus: error.response?.status
        });
    }
});

/**
 * GET /api/odds/sports
 * Get list of available sports
 */
router.get('/sports', async (req, res, next) => {
    try {
        const cacheKey = 'odds_sports_list';
        
        const sports = await getCachedOrFetch(cacheKey, async () => {
            const response = await axios.get(
                'https://api.the-odds-api.com/v4/sports',
                {
                    params: {
                        apiKey: process.env.THE_ODDS_API_KEY
                    }
                }
            );
            
            return response.data;
        });
        
        res.json({ 
            success: true,
            timestamp: new Date().toISOString(),
            sports: sports 
        });
    } catch (error) {
        console.error('❌ Error fetching sports list:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch sports',
            details: error.message 
        });
    }
});

/**
 * GET /api/odds/:sport
 * Get live odds for a specific sport (handles different endpoint formats)
 * NOTE: This must be AFTER /live and /sports to avoid route conflicts
 */
router.get('/:sport', optionalAuth, async (req, res, next) => {
    try {
        // Validate API key exists
        if (!process.env.THE_ODDS_API_KEY) {
            console.error('❌ THE_ODDS_API_KEY not configured in environment');
            return res.status(500).json({
                success: false,
                error: 'API configuration error',
                details: 'THE_ODDS_API_KEY is not configured'
            });
        }
        
        const sport = req.params.sport || 'basketball_nba';
        const markets = req.query.markets || 'h2h,spreads,totals';
        
        console.log(`📊 Fetching odds for sport: ${sport}, markets: ${markets}`);
        
        const cacheKey = `odds_${sport}_${markets}`;
        
        const odds = await getCachedOrFetch(cacheKey, async () => {
            try {
                console.log(`🔗 Calling The Odds API: https://api.the-odds-api.com/v4/sports/${sport}/odds`);
                const response = await axios.get(
                    `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
                    {
                        params: {
                            apiKey: process.env.THE_ODDS_API_KEY,
                            regions: 'us',
                            markets: markets,
                            oddsFormat: 'american'
                        }
                    }
                );
                
                console.log(`✅ The Odds API returned ${response.data.length} games for ${sport}`);
                return response.data;
            } catch (axiosError) {
                console.error(`❌ The Odds API error:`, axiosError.response?.status, axiosError.response?.data);
                throw axiosError;
            }
        });
        
        res.json({ 
            success: true,
            sport: sport,
            timestamp: new Date().toISOString(),
            odds: odds 
        });
    } catch (error) {
        console.error(`❌ Error fetching odds for ${req.params.sport}:`, error.message);
        const statusCode = error.response?.status === 404 ? 404 : 500;
        res.status(statusCode).json({ 
            success: false, 
            error: 'Failed to fetch odds',
            details: error.message,
            apiStatus: error.response?.status
        });
    }
});

module.exports = router;