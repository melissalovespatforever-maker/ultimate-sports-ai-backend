// Odds routes - proxy to The Odds API
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { optionalAuth } = require('../middleware/auth');

// Cache to reduce API calls
const cache = new Map();
const CACHE_DURATION = 30000;

async function getCachedOrFetch(key, fetchFn, duration = CACHE_DURATION) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < duration) {
        return cached.data;
    }
    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
}

router.get('/live', optionalAuth, async (req, res, next) => {
    try {
        const { sport = 'basketball_nba' } = req.query;
        const cacheKey = `odds_live_${sport}`;
        const odds = await getCachedOrFetch(cacheKey, async () => {
            const response = await axios.get(
                `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
                { params: { apiKey: process.env.THE_ODDS_API_KEY, regions: 'us', markets: 'h2h,spreads,totals', oddsFormat: 'american' } }
            );
            return response.data;
        });
        res.json({ success: true, sport: sport, timestamp: new Date().toISOString(), odds: odds });
    } catch (error) {
        console.error('❌ Error fetching live odds:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch live odds', details: error.message });
    }
});

router.get('/sports', async (req, res, next) => {
    try {
        const cacheKey = 'odds_sports_list';
        const sports = await getCachedOrFetch(cacheKey, async () => {
            const response = await axios.get('https://api.the-odds-api.com/v4/sports', { params: { apiKey: process.env.THE_ODDS_API_KEY } });
            return response.data;
        });
        res.json({ success: true, timestamp: new Date().toISOString(), sports: sports });
    } catch (error) {
        console.error('❌ Error fetching sports list:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch sports', details: error.message });
    }
});

router.get('/:sport', optionalAuth, async (req, res, next) => {
    try {
        const sport = req.params.sport || 'basketball_nba';
        const markets = req.query.markets || 'h2h,spreads,totals';
        const cacheKey = `odds_${sport}_${markets}`;
        const odds = await getCachedOrFetch(cacheKey, async () => {
            const response = await axios.get(
                `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
                { params: { apiKey: process.env.THE_ODDS_API_KEY, regions: 'us', markets: markets, oddsFormat: 'american' } }
            );
            return response.data;
        });
        res.json({ success: true, sport: sport, timestamp: new Date().toISOString(), odds: odds });
    } catch (error) {
        console.error(`❌ Error fetching odds for ${req.params.sport}:`, error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch odds', details: error.message });
    }
});

module.exports = router;