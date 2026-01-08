// ============================================
// AUTHENTICATION MIDDLEWARE
// JWT token verification and user authorization
// ============================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded || !decoded.userId) {
            throw new Error('Invalid token payload');
        }

        // Get user from database
        let result;
        try {
            result = await query(
                'SELECT id, username, email, subscription_tier, level, coins, xp, is_admin FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );
        } catch (dbError) {
            console.error('Auth DB error:', dbError.message);
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'Database connection failed during authentication'
            });
        }
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found or inactive'
            });
        }
        
        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token expired'
            });
        }
        
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
};

// Check if user has required subscription tier
const requireSubscription = (minTier) => {
    const tierLevels = {
        'FREE': 0,
        'PRO': 1,
        'VIP': 2
    };
    
    return (req, res, next) => {
        const userTier = req.user.subscription_tier || 'FREE';
        const userLevel = tierLevels[userTier] || 0;
        const requiredLevel = tierLevels[minTier] || 0;
        
        if (userLevel < requiredLevel) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This feature requires ${minTier} subscription`,
                requiredTier: minTier,
                currentTier: userTier
            });
        }
        
        next();
    };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await query(
                'SELECT id, username, email, subscription_tier FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );
            
            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
        }
        
        next();
    } catch (error) {
        // Continue without user
        next();
    }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin privileges required'
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireSubscription,
    requireAdmin,
    optionalAuth
};
