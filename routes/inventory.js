// ============================================
// INVENTORY ROUTES
// Handles user items, boosters, and consumables
// ============================================

const express = require('express');
const router = express.Router();

// Safely require database with fallback
let pool;
try {
    pool = require('../config/database').pool;
} catch (err) {
    console.warn('⚠️ Warning: Could not load database pool in inventory router:', err.message);
}

const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

// GET /api/inventory - Get user inventory
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const result = await pool.query(
            `SELECT id, item_id, item_name, item_type, quantity, metadata, expires_at, purchased_at
             FROM user_inventory
             WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY purchased_at DESC`,
            [req.user.id]
        );

        // Organize by type
        const inventory = {
            boosters: [],
            avatars: [],
            cosmetics: [],
            consumables: [],
            protections: []
        };

        result.rows.forEach(item => {
            const type = item.item_type + 's'; // pluralize
            if (inventory[type]) {
                inventory[type].push({
                    id: item.item_id,
                    name: item.item_name,
                    quantity: item.quantity,
                    metadata: item.metadata,
                    expiresAt: item.expires_at,
                    purchasedAt: item.purchased_at
                });
            }
        });

        res.json({ inventory });

    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/inventory/add - Add item to inventory
router.post('/add', authenticateToken, async (req, res, next) => {
    try {
        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const schema = Joi.object({
            item_id: Joi.string().required(),
            item_name: Joi.string().required(),
            item_type: Joi.string().valid('booster', 'avatar', 'cosmetic', 'consumable', 'protection').required(),
            quantity: Joi.number().integer().min(1).default(1),
            metadata: Joi.object().default({}),
            expires_at: Joi.date().allow(null).default(null)
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }

        const { item_id, item_name, item_type, quantity, metadata, expires_at } = value;

        // Check if item already exists
        const existingItem = await pool.query(
            `SELECT id, quantity FROM user_inventory
             WHERE user_id = $1 AND item_id = $2`,
            [req.user.id, item_id]
        );

        if (existingItem.rows.length > 0) {
            // Update quantity
            await pool.query(
                `UPDATE user_inventory
                 SET quantity = quantity + $1, metadata = $2
                 WHERE user_id = $3 AND item_id = $4`,
                [quantity, JSON.stringify(metadata), req.user.id, item_id]
            );
        } else {
            // Insert new item
            await pool.query(
                `INSERT INTO user_inventory
                 (user_id, item_id, item_name, item_type, quantity, metadata, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [req.user.id, item_id, item_name, item_type, quantity, JSON.stringify(metadata), expires_at]
            );
        }

        res.json({
            success: true,
            message: 'Item added to inventory',
            item: { item_id, item_name, item_type, quantity }
        });

    } catch (error) {
        console.error('Error adding to inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
