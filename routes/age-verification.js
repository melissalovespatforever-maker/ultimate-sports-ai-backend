// ============================================
// AGE VERIFICATION ROUTES
// Log and manage age verification data
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

/**
 * POST /api/auth/verify-age
 * Log age verification to database
 * Requires: Valid JWT token
 */
router.post('/verify-age', auth, async (req, res) => {
    try {
        const { user_id, age_verified, age_verified_date, age_verification_method } = req.body;
        const token_user_id = req.user.id;
        
        // Security: Users can only verify their own age
        if (user_id !== token_user_id) {
            return res.status(403).json({ error: 'Unauthorized: Cannot verify age for another user' });
        }
        
        // Validate input
        if (!age_verified || !age_verified_date || !age_verification_method) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate method
        const validMethods = ['oauth', 'self-declaration', 'payment', 'id-verification'];
        if (!validMethods.includes(age_verification_method)) {
            return res.status(400).json({ error: 'Invalid verification method' });
        }
        
        // Update user record
        const query = `
            UPDATE users
            SET 
                age_verified = $1,
                age_verified_date = $2,
                age_verification_method = $3
            WHERE id = $4
            RETURNING id, age_verified, age_verified_date, age_verification_method
        `;
        
        const result = await db.query(query, [
            age_verified,
            new Date(age_verified_date),
            age_verification_method,
            user_id
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`✅ Age verified for user ${user_id} via ${age_verification_method}`);
        
        res.json({
            success: true,
            message: 'Age verification logged successfully',
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error logging age verification:', error);
        res.status(500).json({ 
            error: 'Failed to log age verification',
            message: error.message 
        });
    }
});

/**
 * GET /api/auth/age-status
 * Get user's age verification status
 * Requires: Valid JWT token
 */
router.get('/age-status', auth, async (req, res) => {
    try {
        const user_id = req.user.id;
        
        const query = `
            SELECT 
                id,
                age_verified,
                age_verified_date,
                age_verification_method
            FROM users
            WHERE id = $1
        `;
        
        const result = await db.query(query, [user_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        
        res.json({
            success: true,
            data: {
                age_verified: user.age_verified || false,
                age_verified_date: user.age_verified_date,
                age_verification_method: user.age_verification_method
            }
        });
        
    } catch (error) {
        console.error('Error fetching age status:', error);
        res.status(500).json({ 
            error: 'Failed to fetch age status',
            message: error.message 
        });
    }
});

/**
 * POST /api/admin/age-verification/block-user
 * Admin: Block user for age verification failure
 * Requires: Admin JWT token
 */
router.post('/admin/age-verification/block-user', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { user_id, reason } = req.body;
        
        if (!user_id || !reason) {
            return res.status(400).json({ error: 'Missing user_id or reason' });
        }
        
        // Deactivate user account
        const query = `
            UPDATE users
            SET 
                is_active = FALSE,
                deactivation_reason = $1,
                deactivated_at = NOW()
            WHERE id = $2
            RETURNING id, username, email, is_active
        `;
        
        const result = await db.query(query, [
            `Age verification failed: ${reason}`,
            user_id
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`🚫 User ${user_id} blocked: ${reason}`);
        
        res.json({
            success: true,
            message: 'User account deactivated',
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ 
            error: 'Failed to block user',
            message: error.message 
        });
    }
});

/**
 * GET /api/admin/age-verification/unverified-users
 * Admin: Get list of unverified users
 * Requires: Admin JWT token
 */
router.get('/admin/age-verification/unverified-users', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const query = `
            SELECT 
                id,
                username,
                email,
                created_at,
                last_login,
                age_verified,
                age_verified_date
            FROM users
            WHERE age_verified = FALSE OR age_verified IS NULL
            ORDER BY created_at DESC
            LIMIT 100
        `;
        
        const result = await db.query(query);
        
        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching unverified users:', error);
        res.status(500).json({ 
            error: 'Failed to fetch unverified users',
            message: error.message 
        });
    }
});

module.exports = router;
