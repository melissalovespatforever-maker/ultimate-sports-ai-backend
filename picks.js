// Picks routes - stub (implement full CRUD)
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT p.*, 
                    (SELECT json_agg(pl) FROM pick_legs pl WHERE pl.pick_id = p.id) as legs
             FROM picks p 
             WHERE p.user_id = $1 
             ORDER BY p.created_at DESC 
             LIMIT 50`,
            [req.user.id]
        );
        res.json({ picks: result.rows });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const { pick_type, sport, legs, total_odds, wager } = req.body;
        
        const result = await query(
            `INSERT INTO picks (user_id, pick_type, sport, total_odds, wager, potential_payout)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, pick_type, sport, total_odds, wager, wager * (total_odds / 100 + 1)]
        );
        
        const pick = result.rows[0];
        
        // Insert legs
        for (const leg of legs) {
            await query(
                `INSERT INTO pick_legs (pick_id, game_id, sport, home_team, away_team, game_time, bet_type, selection, odds, line)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [pick.id, leg.game_id, leg.sport, leg.home_team, leg.away_team, leg.game_time, 
                 leg.bet_type, leg.selection, leg.odds, leg.line]
            );
        }
        
        res.status(201).json({ pick });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
