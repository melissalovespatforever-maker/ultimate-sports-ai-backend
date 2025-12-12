// ============================================
// OAUTH ROUTES (BACKEND)
// Google OAuth & Apple Sign-In handlers
// ============================================

const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://play.rosebud.ai/oauth/google/callback';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY; // PEM format
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || 'https://play.rosebud.ai/oauth/apple/callback';

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * POST /api/oauth/google/callback
 * Exchange Google authorization code for user info
 */
router.post('/google/callback', async (req, res, next) => {
    try {
        const { code, codeVerifier, redirectUri } = req.body;
        
        if (!code) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code required'
            });
        }
        
        // Exchange code for access token
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
        });
        
        const { access_token, id_token } = tokenResponse.data;
        
        // Get user info from Google
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });
        
        const googleUser = userInfoResponse.data;
        
        // Find or create user in database
        const user = await findOrCreateOAuthUser({
            provider: 'google',
            providerId: googleUser.id,
            email: googleUser.email,
            username: googleUser.name || googleUser.email.split('@')[0],
            avatar: googleUser.picture,
            verifiedEmail: googleUser.verified_email
        });
        
        // Generate JWT tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        
        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );
        
        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        res.json({
            message: 'Google authentication successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                subscription: user.subscription_tier,
                level: user.level,
                xp: user.xp,
                coins: user.coins
            },
            accessToken,
            refreshToken
        });
        
    } catch (error) {
        console.error('Google OAuth error:', error);
        next(error);
    }
});

// ============================================
// APPLE SIGN-IN
// ============================================

/**
 * POST /api/oauth/apple/callback
 * Exchange Apple authorization code for user info
 */
router.post('/apple/callback', async (req, res, next) => {
    try {
        const { code, idToken, nonce, user, redirectUri } = req.body;
        
        if (!code || !idToken) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code and ID token required'
            });
        }
        
        // Verify ID token (Apple's response includes user data in ID token)
        const decodedToken = jwt.decode(idToken, { complete: true });
        
        if (!decodedToken) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid ID token'
            });
        }
        
        // Verify nonce if provided
        if (nonce && decodedToken.payload.nonce !== crypto.createHash('sha256').update(nonce).digest('hex')) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid nonce'
            });
        }
        
        const appleUser = decodedToken.payload;
        
        // Apple only sends user info on first authorization
        let userData = {
            provider: 'apple',
            providerId: appleUser.sub,
            email: appleUser.email,
            verifiedEmail: appleUser.email_verified === 'true'
        };
        
        // If user data is provided (first-time auth), use it
        if (user) {
            const parsedUser = typeof user === 'string' ? JSON.parse(user) : user;
            userData.username = `${parsedUser.name?.firstName || ''} ${parsedUser.name?.lastName || ''}`.trim() || userData.email.split('@')[0];
        } else {
            userData.username = userData.email.split('@')[0];
        }
        
        // Find or create user in database
        const dbUser = await findOrCreateOAuthUser(userData);
        
        // Generate JWT tokens
        const { accessToken, refreshToken } = generateTokens(dbUser.id);
        
        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [dbUser.id, refreshToken, expiresAt]
        );
        
        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [dbUser.id]
        );
        
        res.json({
            message: 'Apple authentication successful',
            user: {
                id: dbUser.id,
                username: dbUser.username,
                email: dbUser.email,
                avatar: dbUser.avatar,
                subscription: dbUser.subscription_tier,
                level: dbUser.level,
                xp: dbUser.xp,
                coins: dbUser.coins
            },
            accessToken,
            refreshToken
        });
        
    } catch (error) {
        console.error('Apple OAuth error:', error);
        next(error);
    }
});

// ============================================
// LINK OAUTH ACCOUNTS
// ============================================

/**
 * POST /api/oauth/link/:provider
 * Link OAuth provider to existing account
 */
router.post('/link/:provider', authenticateToken, async (req, res, next) => {
    try {
        const { provider } = req.params;
        const { code, codeVerifier, redirectUri } = req.body;
        
        if (!['google', 'apple'].includes(provider)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid OAuth provider'
            });
        }
        
        let providerId, providerEmail;
        
        if (provider === 'google') {
            // Exchange code for access token
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
            });
            
            const { access_token } = tokenResponse.data;
            
            // Get user info
            const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${access_token}` }
            });
            
            providerId = userInfoResponse.data.id;
            providerEmail = userInfoResponse.data.email;
            
        } else if (provider === 'apple') {
            const { idToken } = req.body;
            const decodedToken = jwt.decode(idToken);
            
            providerId = decodedToken.sub;
            providerEmail = decodedToken.email;
        }
        
        // Check if provider is already linked to another account
        const existing = await query(
            'SELECT user_id FROM oauth_providers WHERE provider = $1 AND provider_id = $2',
            [provider, providerId]
        );
        
        if (existing.rows.length > 0 && existing.rows[0].user_id !== req.user.id) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'This account is already linked to another user'
            });
        }
        
        // Link provider to user
        await query(
            `INSERT INTO oauth_providers (user_id, provider, provider_id, provider_email)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, provider) 
             DO UPDATE SET provider_id = $3, provider_email = $4, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, provider, providerId, providerEmail]
        );
        
        res.json({
            message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`
        });
        
    } catch (error) {
        console.error('Link OAuth error:', error);
        next(error);
    }
});

/**
 * DELETE /api/oauth/unlink/:provider
 * Unlink OAuth provider from account
 */
router.delete('/unlink/:provider', authenticateToken, async (req, res, next) => {
    try {
        const { provider } = req.params;
        
        if (!['google', 'apple'].includes(provider)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid OAuth provider'
            });
        }
        
        // Check if user has a password (can't unlink if OAuth is only login method)
        const userResult = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const hasPassword = userResult.rows[0]?.password_hash;
        
        // Count linked OAuth providers
        const providersResult = await query(
            'SELECT COUNT(*) FROM oauth_providers WHERE user_id = $1',
            [req.user.id]
        );
        
        const providerCount = parseInt(providersResult.rows[0].count);
        
        // Don't allow unlinking if it's the only login method
        if (!hasPassword && providerCount === 1) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot unlink the only authentication method. Please set a password first.'
            });
        }
        
        // Unlink provider
        await query(
            'DELETE FROM oauth_providers WHERE user_id = $1 AND provider = $2',
            [req.user.id, provider]
        );
        
        res.json({
            message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`
        });
        
    } catch (error) {
        console.error('Unlink OAuth error:', error);
        next(error);
    }
});

/**
 * GET /api/oauth/linked
 * Get list of linked OAuth providers
 */
router.get('/linked', authenticateToken, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT provider, provider_email, created_at 
             FROM oauth_providers 
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        
        res.json({
            providers: result.rows
        });
        
    } catch (error) {
        console.error('Get linked providers error:', error);
        next(error);
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find or create user from OAuth data
 */
async function findOrCreateOAuthUser(oauthData) {
    const { provider, providerId, email, username, avatar, verifiedEmail } = oauthData;
    
    return await transaction(async (client) => {
        // Check if OAuth provider is already linked
        let result = await client.query(
            `SELECT u.* FROM users u
             INNER JOIN oauth_providers op ON u.id = op.user_id
             WHERE op.provider = $1 AND op.provider_id = $2`,
            [provider, providerId]
        );
        
        if (result.rows.length > 0) {
            // User exists, return it
            return result.rows[0];
        }
        
        // Check if email already exists
        result = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        let user;
        
        if (result.rows.length > 0) {
            // Email exists, link OAuth provider to existing user
            user = result.rows[0];
            
            await client.query(
                `INSERT INTO oauth_providers (user_id, provider, provider_id, provider_email)
                 VALUES ($1, $2, $3, $4)`,
                [user.id, provider, providerId, email]
            );
        } else {
            // Create new user
            result = await client.query(
                `INSERT INTO users (username, email, avatar, email_verified)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [username, email, avatar, verifiedEmail || false]
            );
            
            user = result.rows[0];
            
            // Link OAuth provider
            await client.query(
                `INSERT INTO oauth_providers (user_id, provider, provider_id, provider_email)
                 VALUES ($1, $2, $3, $4)`,
                [user.id, provider, providerId, email]
            );
        }
        
        return user;
    });
}

/**
 * Generate JWT access and refresh tokens
 */
function generateTokens(userId) {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
    
    return { accessToken, refreshToken };
}

module.exports = router;
