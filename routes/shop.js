// ============================================
// SHOP & DAILY DEALS ROUTES
// Handles shop items, daily deals, boosters, and avatars
// ============================================

const express = require('express');
const router = express.Router();

// Safely require database with fallback
let pool;
try {
    pool = require('../config/database').pool;
} catch (err) {
    console.warn('⚠️ Warning: Could not load database pool:', err.message);
}

const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

// ============================================
// LEGACY INVENTORY ROUTES (For Backward Compatibility)
// Primary routes now at /api/inventory
// ============================================

// GET /api/shop/inventory - Get user inventory (LEGACY - redirects to new location)
router.get('/inventory', authenticateToken, async (req, res, next) => {
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

// POST /api/shop/inventory/add - Add item to inventory (LEGACY)
router.post('/inventory/add', authenticateToken, async (req, res, next) => {
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

// ============================================
// GET SHOP ITEMS
// ============================================
router.get('/items', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: 'Database not available',
                message: 'Shop service temporarily unavailable'
            });
        }
        
        const result = await pool.query(`
            SELECT * FROM shop_inventory
            ORDER BY 
                CASE category 
                    WHEN 'boosters' THEN 1 
                    WHEN 'avatars' THEN 2 
                    WHEN 'exclusive' THEN 3 
                END,
                price ASC
        `);
        
        res.json({ 
            success: true,
            items: result.rows 
        });
    } catch (error) {
        console.error('Error fetching shop items:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ============================================
// GET DAILY DEAL STOCK
// ============================================
router.get('/deals/stock', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: 'Database not available'
            });
        }
        
        // First reset any expired stock
        await pool.query('SELECT reset_daily_deal_stock()');
        
        // Get current stock levels
        const result = await pool.query(`
            SELECT deal_id, stock_remaining, max_stock, last_reset_date
            FROM daily_deal_stock
        `);
        
        res.json({ 
            success: true,
            stock: result.rows.reduce((acc, row) => {
                acc[row.deal_id] = row.stock_remaining;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Error fetching deal stock:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ============================================
// PURCHASE SHOP ITEM
// ============================================
router.post('/purchase', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { itemId, itemName, price, category } = req.body;
        const userId = req.user.id;
        
        await client.query('BEGIN');
        
        // Get user's current balance
        const userResult = await client.query(
            'SELECT coins FROM users WHERE id = $1',
            [userId]
        );
        
        if (!userResult.rows[0]) {
            throw new Error('User not found');
        }
        
        const currentBalance = userResult.rows[0].coins;
        
        // Check if user has enough coins
        if (currentBalance < price) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false,
                error: 'Insufficient coins',
                required: price,
                current: currentBalance
            });
        }
        
        // Check if item already owned (for permanent items)
        if (category === 'avatars' || category === 'exclusive') {
            const existingPurchase = await client.query(
                'SELECT id FROM user_shop_purchases WHERE user_id = $1 AND item_id = $2',
                [userId, itemId]
            );
            
            if (existingPurchase.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    error: 'Item already owned'
                });
            }
        }
        
        // Deduct coins from user
        await client.query(
            'UPDATE users SET coins = coins - $1 WHERE id = $2',
            [price, userId]
        );
        
        // Record purchase
        await client.query(
            `INSERT INTO user_shop_purchases (user_id, item_id, item_name, price_paid, category)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, itemId, itemName, price, category]
        );
        
        // If it's a booster, activate it
        if (category === 'boosters') {
            const boosterConfig = {
                'coin-2x': { multiplier: 2.0, duration: 24 },
                'xp-2x': { multiplier: 2.0, duration: 24 },
                'mega-pack': { multiplier: 2.0, duration: 24 },
                'luck-charm': { multiplier: 3.0, duration: 12 }
            };
            
            const config = boosterConfig[itemId] || { multiplier: 2.0, duration: 24 };
            
            await client.query(
                `INSERT INTO active_boosters (user_id, booster_type, multiplier, duration_hours, expires_at)
                 VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${config.duration} hours')
                 ON CONFLICT (user_id, booster_type) 
                 DO UPDATE SET 
                    activated_at = NOW(),
                    expires_at = NOW() + INTERVAL '${config.duration} hours',
                    multiplier = $3`,
                [userId, itemId, config.multiplier, config.duration]
            );
        }
        
        await client.query('COMMIT');
        
        // Get updated balance
        const updatedUser = await client.query(
            'SELECT coins FROM users WHERE id = $1',
            [userId]
        );
        
        res.json({ 
            success: true,
            message: 'Purchase successful!',
            newBalance: updatedUser.rows[0].coins,
            item: { itemId, itemName, price, category }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Purchase error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    } finally {
        client.release();
    }
});

// ============================================
// PURCHASE DAILY DEAL
// ============================================
router.post('/deals/purchase', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { dealId, dealName, normalPrice, dealPrice, discount, category } = req.body;
        const userId = req.user.id;
        
        await client.query('BEGIN');
        
        // Reset stock if needed
        await client.query('SELECT reset_daily_deal_stock()');
        
        // Check stock availability
        const stockResult = await client.query(
            'SELECT stock_remaining FROM daily_deal_stock WHERE deal_id = $1 FOR UPDATE',
            [dealId]
        );
        
        if (!stockResult.rows[0] || stockResult.rows[0].stock_remaining <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false,
                error: 'Deal sold out'
            });
        }
        
        // Get user's current balance
        const userResult = await client.query(
            'SELECT coins FROM users WHERE id = $1',
            [userId]
        );
        
        if (!userResult.rows[0]) {
            throw new Error('User not found');
        }
        
        const currentBalance = userResult.rows[0].coins;
        
        // Check if user has enough coins
        if (currentBalance < dealPrice) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false,
                error: 'Insufficient coins',
                required: dealPrice,
                current: currentBalance
            });
        }
        
        // Deduct coins from user
        await client.query(
            'UPDATE users SET coins = coins - $1 WHERE id = $2',
            [dealPrice, userId]
        );
        
        // Decrease stock
        await client.query(
            'UPDATE daily_deal_stock SET stock_remaining = stock_remaining - 1, updated_at = NOW() WHERE deal_id = $1',
            [dealId]
        );
        
        // Record purchase
        const savings = normalPrice - dealPrice;
        await client.query(
            `INSERT INTO daily_deal_purchases (user_id, deal_id, deal_name, normal_price, deal_price, discount_percent, savings)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, dealId, dealName, normalPrice, dealPrice, discount, savings]
        );
        
        // If it's a booster, activate it
        if (category === 'boosters') {
            const boosterType = dealId.replace('-deal', '');
            const boosterConfig = {
                'coin-2x': { multiplier: 2.0, duration: 24 },
                'xp-2x': { multiplier: 2.0, duration: 24 },
                'mega-pack': { multiplier: 2.0, duration: 24 },
                'luck-charm': { multiplier: 3.0, duration: 12 }
            };
            
            const config = boosterConfig[boosterType] || { multiplier: 2.0, duration: 24 };
            
            await client.query(
                `INSERT INTO active_boosters (user_id, booster_type, multiplier, duration_hours, expires_at)
                 VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${config.duration} hours')
                 ON CONFLICT (user_id, booster_type) 
                 DO UPDATE SET 
                    activated_at = NOW(),
                    expires_at = NOW() + INTERVAL '${config.duration} hours',
                    multiplier = $3`,
                [userId, boosterType, config.multiplier, config.duration]
            );
        }
        
        // For permanent items, add to user's inventory
        if (category === 'avatars' || category === 'exclusive') {
            const itemId = dealId.replace('-deal', '');
            await client.query(
                `INSERT INTO user_shop_purchases (user_id, item_id, item_name, price_paid, category)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, item_id) DO NOTHING`,
                [userId, itemId, dealName, dealPrice, category]
            );
        }
        
        await client.query('COMMIT');
        
        // Get updated balance and stock
        const updatedUser = await client.query(
            'SELECT coins FROM users WHERE id = $1',
            [userId]
        );
        
        const updatedStock = await client.query(
            'SELECT stock_remaining FROM daily_deal_stock WHERE deal_id = $1',
            [dealId]
        );
        
        res.json({ 
            success: true,
            message: 'Deal purchased successfully!',
            newBalance: updatedUser.rows[0].coins,
            savings: savings,
            stockRemaining: updatedStock.rows[0].stock_remaining
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Deal purchase error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    } finally {
        client.release();
    }
});

// ============================================
// GET USER'S ACTIVE BOOSTERS
// ============================================
router.get('/boosters/active', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Clean up expired boosters first
        await pool.query('SELECT cleanup_expired_boosters()');
        
        // Get active boosters
        const result = await pool.query(
            `SELECT booster_type, multiplier, duration_hours, activated_at, expires_at
             FROM active_boosters
             WHERE user_id = $1 AND expires_at > NOW()
             ORDER BY expires_at DESC`,
            [userId]
        );
        
        res.json({ 
            success: true,
            boosters: result.rows 
        });
    } catch (error) {
        console.error('Error fetching active boosters:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET USER'S PURCHASED ITEMS
// ============================================
router.get('/purchases', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            `SELECT item_id, item_name, price_paid, category, purchased_at
             FROM user_shop_purchases
             WHERE user_id = $1
             ORDER BY purchased_at DESC`,
            [userId]
        );
        
        res.json({ 
            success: true,
            purchases: result.rows 
        });
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET USER'S DEAL PURCHASE HISTORY
// ============================================
router.get('/deals/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            `SELECT deal_id, deal_name, normal_price, deal_price, discount_percent, 
                    savings, purchase_date, created_at
             FROM daily_deal_purchases
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );
        
        // Calculate total savings
        const savingsResult = await pool.query(
            'SELECT COALESCE(SUM(savings), 0) as total_savings FROM daily_deal_purchases WHERE user_id = $1',
            [userId]
        );
        
        res.json({ 
            success: true,
            history: result.rows,
            totalSavings: parseInt(savingsResult.rows[0].total_savings)
        });
    } catch (error) {
        console.error('Error fetching deal history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
