// Analytics routes - stub
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/summary', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT 
                COUNT(*) as total_picks,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as losses,
                AVG(total_odds) as avg_odds,
                SUM(CASE WHEN status = 'won' THEN potential_payout - wager ELSE -wager END) as net_profit
             FROM picks
             WHERE user_id = $1`,
            [req.user.id]
        );
        res.json({ summary: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
