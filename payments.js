/**
 * Payment Routes for Ultimate Sports AI
 * Handles PayPal coin purchases
 * Version: 2.5.1
 */

const express = require('express');
const router = express.Router();

// Import your authentication middleware
// Adjust path based on your project structure
let authenticateToken;
try {
    authenticateToken = require('../middleware/auth');
} catch (e) {
    try {
        authenticateToken = require('../../middleware/auth');
    } catch (e) {
        console.warn('⚠️  Auth middleware not found, using placeholder');
        authenticateToken = (req, res, next) => {
            // Placeholder - replace with your actual auth
            req.user = { id: 1 }; // TODO: Implement proper auth
            next();
        };
    }
}

// Import database connection
// Adjust based on your setup
let db;
try {
    db = require('../config/database');
} catch (e) {
    try {
        db = require('../../config/database');
    } catch (e) {
        console.warn('⚠️  Database config not found, using direct connection');
        const { Pool } = require('pg');
        db = {
            query: async (text, params) => {
                const pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false }
                });
                const result = await pool.query(text, params);
                await pool.end();
                return result;
            }
        };
    }
}

/**
 * POST /api/transactions/paypal-purchase
 * Record a PayPal coin purchase and credit user balance
 */
router.post('/transactions/paypal-purchase', authenticateToken, async (req, res) => {
    const { type, amount, reason, metadata } = req.body;
    const userId = req.user.id;

    // Validation
    if (!type || type !== 'credit') {
        return res.status(400).json({
            success: false,
            error: 'Invalid transaction type',
            message: 'Type must be "credit"'
        });
    }

    if (!amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid amount',
            message: 'Amount must be positive'
        });
    }

    if (!metadata || !metadata.paypalTransactionId) {
        return res.status(400).json({
            success: false,
            error: 'Missing PayPal transaction ID',
            message: 'metadata.paypalTransactionId is required'
        });
    }

    const { paypalTransactionId, bundleName } = metadata;

    try {
        // Check for duplicate transaction
        const existingTxn = await db.query(
            'SELECT id FROM transactions WHERE paypal_transaction_id = $1',
            [paypalTransactionId]
        );

        if (existingTxn.rows && existingTxn.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Duplicate transaction',
                message: 'This PayPal transaction has already been processed'
            });
        }

        // Start database transaction
        await db.query('BEGIN');

        // Update user balance
        const balanceResult = await db.query(
            `UPDATE users 
             SET balance = balance + $1, 
                 updated_at = NOW(),
                 last_balance_update = NOW()
             WHERE id = $2 
             RETURNING balance`,
            [amount, userId]
        );

        if (!balanceResult.rows || balanceResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'Could not find user to credit'
            });
        }

        const newBalance = balanceResult.rows[0].balance;

        // Insert transaction record
        const transactionResult = await db.query(
            `INSERT INTO transactions (
                user_id, 
                type, 
                amount, 
                reason, 
                method,
                paypal_transaction_id,
                metadata,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
            RETURNING *`,
            [
                userId,
                type,
                amount,
                reason,
                'paypal',
                paypalTransactionId,
                JSON.stringify(metadata)
            ]
        );

        // Commit transaction
        await db.query('COMMIT');

        const transaction = transactionResult.rows[0];

        console.log(`✅ PayPal purchase processed: User ${userId}, ${amount} coins, Balance: ${newBalance}`);

        // Return success
        res.json({
            success: true,
            balance: newBalance,
            transaction: {
                id: transaction.id,
                user_id: transaction.user_id,
                type: transaction.type,
                amount: transaction.amount,
                reason: transaction.reason,
                paypalTransactionId: transaction.paypal_transaction_id,
                timestamp: transaction.created_at
            }
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('❌ PayPal purchase error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to process purchase',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/transactions/history
 * Get user's transaction history
 */
router.get('/transactions/history', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const result = await db.query(
            `SELECT 
                id,
                type,
                amount,
                reason,
                method,
                paypal_transaction_id,
                metadata,
                created_at
             FROM transactions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM transactions WHERE user_id = $1',
            [userId]
        );

        res.json({
            success: true,
            transactions: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        });

    } catch (error) {
        console.error('❌ Transaction history error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to fetch transaction history'
        });
    }
});

/**
 * GET /api/transactions/stats
 * Get user's transaction statistics
 */
router.get('/transactions/stats', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
                COALESCE(SUM(CASE WHEN method = 'paypal' THEN amount ELSE 0 END), 0) as paypal_purchases
             FROM transactions
             WHERE user_id = $1`,
            [userId]
        );

        res.json({
            success: true,
            stats: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Transaction stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            message: 'Failed to fetch transaction statistics'
        });
    }
});

module.exports = router;
