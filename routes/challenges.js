// Challenges routes - stub
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT c.*, uc.progress, uc.completed, uc.reward_claimed
             FROM challenges c
             LEFT JOIN user_challenges uc ON c.id = uc.challenge_id AND uc.user_id = $1
             WHERE c.end_date >= CURRENT_DATE
             ORDER BY c.type, c.end_date`,
            [req.user.id]
        );
        res.json({ challenges: result.rows });
    } catch (error) {
        next(error);
    }
});

router.post('/claim', async (req, res, next) => {
    try {
        const { challenge_id } = req.body;
        
        const result = await query(
            `UPDATE user_challenges 
             SET reward_claimed = true
             WHERE user_id = $1 AND challenge_id = $2 AND completed = true
             RETURNING *`,
            [req.user.id, challenge_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Challenge not completed or already claimed' });
        }
        
        res.json({ message: 'Reward claimed' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
