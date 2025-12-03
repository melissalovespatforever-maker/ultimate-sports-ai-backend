// Shop routes
const express = require('express');
const router = express.Router();

router.get('/items', async (req, res) => {
    try {
        res.json({ items: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/purchase', async (req, res) => {
    try {
        res.json({ message: 'Purchase not yet implemented' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
