// ============================================
// TRANSACTION ROUTES
// Unified coin transaction handling
// ============================================

const express = require('express');
const { query, pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// GET /api/transactions - PUBLIC
// Basic status for this route
router.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Transactions API root. Use POST to record transactions or GET /history for logs.',
        endpoints: ['POST /', 'GET /status', 'GET /history']
    });
});

// GET /api/transactions/status - PUBLIC

// POST /api/transactions - REQUIRES AUTH
// Record a coin transaction (win, loss, purchase, etc.)
router.post('/', authenticateToken, async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const schema = Joi.object({
            type: Joi.string().valid('credit', 'debit', 'win', 'loss', 'bet', 'purchase', 'reward').required(),
            amount: Joi.number().integer().min(0).required(),
            reason: Joi.string().max(255).required(),
            metadata: Joi.object().default({})
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }

        const { type, amount, reason, metadata } = value;

        // Start transaction
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Get current user balance
            const userResult = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
            
            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const currentBalance = userResult.rows[0].coins;

            // Calculate new balance based on transaction type
            let newBalance = currentBalance;
            let balanceChange = 0;

            if (type === 'credit' || type === 'win' || type === 'reward') {
                balanceChange = amount;
                newBalance = currentBalance + amount;
            } else if (type === 'debit' || type === 'loss' || type === 'bet' || type === 'purchase') {
                balanceChange = -amount;
                newBalance = Math.max(0, currentBalance - amount);
                
                // Prevent overdraft
                if (currentBalance < amount) {
                    throw new Error(`Insufficient funds: have ${currentBalance}, need ${amount}`);
                }
            }

            // Update user balance
            await client.query('UPDATE users SET coins = $1 WHERE id = $2', [newBalance, req.user.id]);

            // Record transaction
            const txnResult = await client.query(
                `INSERT INTO coin_transactions 
                 (user_id, type, amount, balance_before, balance_after, reason, metadata, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 RETURNING id, created_at`,
                [req.user.id, type, balanceChange, currentBalance, newBalance, reason, JSON.stringify(metadata)]
            );

            // Update game stats if applicable
            if (metadata.game && (type === 'win' || type === 'loss')) {
                if (type === 'win') {
                    await client.query(
                        `UPDATE users SET 
                            wins = wins + 1, 
                            current_streak = current_streak + 1,
                            best_streak = GREATEST(best_streak, current_streak + 1),
                            total_picks = total_picks + 1
                         WHERE id = $1`, 
                        [req.user.id]
                    );
                } else if (type === 'loss') {
                    await client.query(
                        `UPDATE users SET 
                            losses = losses + 1, 
                            current_streak = 0,
                            total_picks = total_picks + 1
                         WHERE id = $1`, 
                        [req.user.id]
                    );
                }
            }

            await client.query('COMMIT');

            console.log(`✅ Transaction recorded: ${type} ${balanceChange} coins for user ${req.user.id}`);

            res.json({
                success: true,
                transaction: {
                    id: txnResult.rows[0].id,
                    type,
                    amount: balanceChange,
                    balance: newBalance,
                    reason,
                    created_at: txnResult.rows[0].created_at
                }
            });

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error recording transaction:', error);
        next(error);
    }
});

// GET /api/transactions/history - REQUIRES AUTH
router.get('/history', authenticateToken, async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const { limit = 50, offset = 0 } = req.query;

        const result = await query(
            `SELECT id, type, amount, balance_before, balance_after, reason, metadata, created_at
             FROM coin_transactions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.user.id, parseInt(limit), parseInt(offset)]
        );

        const countResult = await query(
            'SELECT COUNT(*) FROM coin_transactions WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            transactions: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        next(error);
    }
});

module.exports = router;