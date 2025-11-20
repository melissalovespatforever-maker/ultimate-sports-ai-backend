// Achievements routes - stub
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/', async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM achievements ORDER BY rarity, name');
        res.json({ achievements: result.rows });
    } catch (error) {
        next(error);
    }
});

router.get('/user', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT a.*, ua.unlocked_at
             FROM achievements a
             JOIN user_achievements ua ON a.id = ua.achievement_id
             WHERE ua.user_id = $1
             ORDER BY ua.unlocked_at DESC`,
            [req.user.id]
        );
        res.json({ achievements: result.rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
