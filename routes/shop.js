// Shop routes - stub
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');

router.get('/items', async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM shop_items WHERE is_available = true ORDER BY category, coin_price'
        );
        res.json({ items: result.rows });
    } catch (error) {
        next(error);
    }
});

router.post('/purchase', async (req, res, next) => {
    try {
        const { item_id } = req.body;
        
        await transaction(async (client) => {
            // Get item
            const itemResult = await client.query(
                'SELECT * FROM shop_items WHERE id = $1',
                [item_id]
            );
            
            if (itemResult.rows.length === 0) {
                throw new Error('Item not found');
            }
            
            const item = itemResult.rows[0];
            
            // Check user balance
            const userResult = await client.query(
                'SELECT coins FROM users WHERE id = $1',
                [req.user.id]
            );
            
            const user = userResult.rows[0];
            
            if (user.coins < item.coin_price) {
                throw new Error('Insufficient coins');
            }
            
            // Deduct coins
            await client.query(
                'UPDATE users SET coins = coins - $1 WHERE id = $2',
                [item.coin_price, req.user.id]
            );
            
            // Add to inventory
            await client.query(
                `INSERT INTO user_inventory (user_id, item_id, expires_at)
                 VALUES ($1, $2, $3)`,
                [req.user.id, item_id, item.duration_hours ? 
                    new Date(Date.now() + item.duration_hours * 60 * 60 * 1000) : null]
            );
            
            // Record transaction
            await client.query(
                `INSERT INTO coin_transactions (user_id, amount, transaction_type, source, description, balance_after)
                 VALUES ($1, $2, 'spend', 'shop', $3, $4)`,
                [req.user.id, -item.coin_price, `Purchased ${item.name}`, user.coins - item.coin_price]
            );
        });
        
        res.json({ message: 'Purchase successful' });
    } catch (error) {
        next(error);
    }
});

router.get('/inventory', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT i.*, s.name, s.description, s.icon, s.item_type, s.boost_type, s.boost_multiplier
             FROM user_inventory i
             JOIN shop_items s ON i.item_id = s.id
             WHERE i.user_id = $1 AND (i.expires_at IS NULL OR i.expires_at > NOW())
             ORDER BY i.purchased_at DESC`,
            [req.user.id]
        );
        res.json({ inventory: result.rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
