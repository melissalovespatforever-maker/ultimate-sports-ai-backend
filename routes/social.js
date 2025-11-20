// Social routes - stub
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.post('/follow', async (req, res, next) => {
    try {
        const { user_id } = req.body;
        await query(
            'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
            [req.user.id, user_id]
        );
        res.json({ message: 'Followed successfully' });
    } catch (error) {
        next(error);
    }
});

router.get('/feed', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT af.*, u.username, u.avatar
             FROM activity_feed af
             JOIN users u ON af.user_id = u.id
             WHERE af.visibility = 'public'
             ORDER BY af.created_at DESC
             LIMIT 50`
        );
        res.json({ feed: result.rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
