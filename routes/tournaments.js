// ============================================
// TOURNAMENT ROUTES
// Secure tournament management with coin validation
// ============================================

const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// ============================================
// GET ALL TOURNAMENTS
// ============================================

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, name, type, entry_fee, prize_pool, max_players, 
                    COALESCE(array_length(players, 1), 0) as current_players,
                    format, status, tier, start_time, duration, created_at
             FROM tournaments 
             WHERE status IN ('registering', 'upcoming', 'active')
             ORDER BY start_time ASC`
        );
        
        res.json({ 
            tournaments: result.rows,
            total: result.rows.length 
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// GET USER'S TOURNAMENTS (MUST BE BEFORE /:tournamentId!)
// ============================================

router.get('/user/registered', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            `SELECT id, name, type, entry_fee, prize_pool, format, status, 
                    start_time, duration, created_at
             FROM tournaments 
             WHERE players @> $1::jsonb
             ORDER BY start_time DESC`,
            [JSON.stringify([userId])]
        );
        
        res.json({ tournaments: result.rows });
    } catch (error) {
        next(error);
    }
});

// ============================================
// GET TOURNAMENT DETAILS
// ============================================

router.get('/:tournamentId', authenticateToken, async (req, res, next) => {
    try {
        const { tournamentId } = req.params;
        
        const result = await pool.query(
            `SELECT * FROM tournaments WHERE id = $1`,
            [tournamentId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Tournament not found'
            });
        }
        
        res.json({ tournament: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ============================================
// JOIN TOURNAMENT
// ============================================

router.post('/:tournamentId/join', authenticateToken, async (req, res, next) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user.id;
        
        // Validate input
        if (!tournamentId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Tournament ID required'
            });
        }
        
        // Get tournament details
        const tournamentResult = await pool.query(
            `SELECT id, entry_fee, max_players, players, status 
             FROM tournaments 
             WHERE id = $1`,
            [tournamentId]
        );
        
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Tournament not found'
            });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Check tournament status
        if (tournament.status !== 'registering') {
            return res.status(400).json({
                error: 'Invalid Status',
                message: 'Tournament is not accepting entries'
            });
        }
        
        // Check max players
        const currentPlayers = tournament.players ? tournament.players.length : 0;
        if (currentPlayers >= tournament.max_players) {
            return res.status(400).json({
                error: 'Tournament Full',
                message: 'This tournament is at maximum capacity'
            });
        }
        
        // Check if already joined
        if (tournament.players && tournament.players.includes(userId)) {
            return res.status(400).json({
                error: 'Already Joined',
                message: 'You are already registered for this tournament'
            });
        }
        
        // Get user balance
        const userResult = await pool.query(
            `SELECT coins FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User Not Found',
                message: 'User profile not found'
            });
        }
        
        const userCoins = userResult.rows[0].coins;
        
        // Check sufficient balance
        if (userCoins < tournament.entry_fee) {
            return res.status(400).json({
                error: 'Insufficient Balance',
                message: `You need ${tournament.entry_fee} coins. You have ${userCoins}`,
                required: tournament.entry_fee,
                available: userCoins
            });
        }
        
        // Deduct entry fee
        await pool.query(
            `UPDATE users 
             SET coins = coins - $1
             WHERE id = $2`,
            [tournament.entry_fee, userId]
        );
        
        // Add player to tournament
        const updatedPlayers = tournament.players ? [...tournament.players, userId] : [userId];
        await pool.query(
            `UPDATE tournaments 
             SET players = $1
             WHERE id = $2`,
            [JSON.stringify(updatedPlayers), tournamentId]
        );
        
        // Log transaction
        await pool.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, tournament_id, description)
             VALUES ($1, 'tournament_entry', $2, $3, $4)`,
            [userId, tournament.entry_fee, tournamentId, `Joined tournament: ${tournament.name}`]
        );
        
        res.json({
            message: 'Successfully joined tournament',
            tournament_id: tournamentId,
            entry_fee_deducted: tournament.entry_fee,
            new_balance: userCoins - tournament.entry_fee
        });
        
    } catch (error) {
        next(error);
    }
});

// ============================================
// LEAVE TOURNAMENT
// ============================================

router.post('/:tournamentId/leave', authenticateToken, async (req, res, next) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user.id;
        
        // Get tournament details
        const tournamentResult = await pool.query(
            `SELECT id, entry_fee, players, status 
             FROM tournaments 
             WHERE id = $1`,
            [tournamentId]
        );
        
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Tournament not found'
            });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Check if user is in tournament
        if (!tournament.players || !tournament.players.includes(userId)) {
            return res.status(400).json({
                error: 'Not Registered',
                message: 'You are not registered for this tournament'
            });
        }
        
        // Only allow leaving if tournament hasn't started
        if (tournament.status !== 'registering') {
            return res.status(400).json({
                error: 'Cannot Leave',
                message: 'Cannot leave a tournament that has already started'
            });
        }
        
        // Refund entry fee
        await pool.query(
            `UPDATE users 
             SET coins = coins + $1
             WHERE id = $2`,
            [tournament.entry_fee, userId]
        );
        
        // Remove player from tournament
        const updatedPlayers = tournament.players.filter(id => id !== userId);
        await pool.query(
            `UPDATE tournaments 
             SET players = $1
             WHERE id = $2`,
            [JSON.stringify(updatedPlayers), tournamentId]
        );
        
        // Log refund
        await pool.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, tournament_id, description)
             VALUES ($1, 'tournament_refund', $2, $3, $4)`,
            [userId, tournament.entry_fee, tournamentId, `Left tournament: ${tournament.name}`]
        );
        
        res.json({
            message: 'Successfully left tournament',
            tournament_id: tournamentId,
            refund_amount: tournament.entry_fee
        });
        
    } catch (error) {
        next(error);
    }
});

// ============================================
// SUBMIT TOURNAMENT RESULT
// ============================================

router.post('/:tournamentId/result', authenticateToken, async (req, res, next) => {
    try {
        const { tournamentId } = req.params;
        const { placement, winnings } = req.body;
        const userId = req.user.id;
        
        // Validate input
        const schema = Joi.object({
            placement: Joi.number().integer().min(1).required(),
            winnings: Joi.number().integer().min(0).required()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }
        
        // Get tournament
        const tournamentResult = await pool.query(
            `SELECT id, name, players 
             FROM tournaments 
             WHERE id = $1`,
            [tournamentId]
        );
        
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Tournament not found'
            });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Award winnings
        if (value.winnings > 0) {
            await pool.query(
                `UPDATE users 
                 SET coins = coins + $1
                 WHERE id = $2`,
                [value.winnings, userId]
            );
            
            // Log winning
            await pool.query(
                `INSERT INTO wallet_transactions (user_id, type, amount, tournament_id, description)
                 VALUES ($1, 'tournament_win', $2, $3, $4)`,
                [userId, value.winnings, tournamentId, `Won tournament: ${tournament.name} (Place: ${value.placement})`]
            );
        }
        
        res.json({
            message: 'Tournament result recorded',
            placement: value.placement,
            winnings: value.winnings,
            tournament_id: tournamentId
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
