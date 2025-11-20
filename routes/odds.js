// Odds routes - proxy to The Odds API
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { optionalAuth } = require('../middleware/auth');

router.get('/live', optionalAuth, async (req, res, next) => {
    try {
        const { sport = 'basketball_nba' } = req.query;
        
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
        
        res.json({ odds: response.data });
    } catch (error) {
        next(error);
    }
});

router.get('/sports', async (req, res, next) => {
    try {
        const response = await axios.get(
            'https://api.the-odds-api.com/v4/sports',
            {
                params: {
                    apiKey: process.env.THE_ODDS_API_KEY
                }
            }
        );
        
        res.json({ sports: response.data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
