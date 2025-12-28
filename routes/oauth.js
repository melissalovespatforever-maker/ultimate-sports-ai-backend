// ============================================
// FIX FOR OAUTH.JS - GOOGLE & APPLE SIGN-IN
// COPY THIS ENTIRE FILE TO /backend/routes/oauth.js
// ============================================

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://play.rosebud.ai/oauth/google/callback';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || 'https://play.rosebud.ai/oauth/apple/callback';

// ============================================
// NATIVE FETCH HELPERS (NO AXIOS NEEDED)
// ============================================

async function fetchPost(url, data, headers = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json();
}

async function fetchGet(url, headers = {}) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * POST /api/oauth/google/callback
 * Exchange Google authorization code for user info
 */
router.post('/google/callback', async (req, res) => {
    try {
        const { code, codeVerifier, redirectUri } = req.body;
        
        if (!code) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code required'
            });
        }

        console.log('🔐 Google OAuth callback - exchanging code');
        
        // Exchange code for access token (using native fetch, not axios)
        const tokenResponse = await fetchPost('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
        });
        
        const { access_token } = tokenResponse;
        console.log('✅ Got Google access token');
        
        // Get user info from Google
        const googleUser = await fetchGet('https://www.googleapis.com/oauth2/v2/userinfo', {
            Authorization: `Bearer ${access_token}`
        });
        
        console.log(`✅ Got Google user: ${googleUser.email}`);
        
        // Find or create user
        const user = await findOrCreateOAuthUser({
            provider: 'google',
            providerId: googleUser.id,
            email: googleUser.email,
            username: googleUser.name || googleUser.email.split('@')[0],
            avatar: googleUser.picture,
            verifiedEmail: googleUser.verified_email
        });
        
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        
        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [user.id, refreshToken, expiresAt]
        );
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        console.log(`✅ Google auth successful for user ${user.id}`);
        
        res.json({
            message: 'Google authentication successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                subscription_tier: user.subscription_tier
            },
            accessToken,
            refreshToken,
            expiresIn: 3600
        });
        
    } catch (error) {
        console.error('❌ Google OAuth error:', error.message);
        res.status(400).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
});

// ============================================
// APPLE OAUTH
// ============================================

/**
 * POST /api/oauth/apple/callback
 * Exchange Apple authorization code for user info
 */
router.post('/apple/callback', async (req, res) => {
    try {
        const { code, redirectUri, id_token, user } = req.body;
        
        if (!code) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code required'
            });
        }

        console.log('🔐 Apple OAuth callback - exchanging code');
        
        // Generate Apple client secret (required for Apple)
        const clientSecret = generateAppleClientSecret();
        
        // Exchange code for access token (using native fetch, not axios)
        const tokenResponse = await fetchPost('https://appleid.apple.com/auth/token', {
            code,
            client_id: APPLE_CLIENT_ID,
            client_secret: clientSecret,
            redirect_uri: redirectUri || APPLE_REDIRECT_URI,
            grant_type: 'authorization_code'
        });
        
        console.log('✅ Got Apple access token');
        
        // Decode ID token to get user info
        let appleUser = {
            id: null,
            email: null,
            name: null
        };
        
        if (id_token) {
            const decoded = jwt.decode(id_token);
            appleUser = {
                id: decoded.sub,
                email: decoded.email,
                name: user?.name?.firstName || decoded.email.split('@')[0]
            };
            console.log(`✅ Decoded Apple user: ${appleUser.email}`);
        }
        
        // Find or create user
        const dbUser = await findOrCreateOAuthUser({
            provider: 'apple',
            providerId: appleUser.id,
            email: appleUser.email,
            username: appleUser.name,
            avatar: null,
            verifiedEmail: true
        });
        
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(dbUser.id);
        
        // Store refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [dbUser.id, refreshToken, expiresAt]
        );
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [dbUser.id]
        );
        
        console.log(`✅ Apple auth successful for user ${dbUser.id}`);
        
        res.json({
            message: 'Apple authentication successful',
            user: {
                id: dbUser.id,
                username: dbUser.username,
                email: dbUser.email,
                subscription_tier: dbUser.subscription_tier
            },
            accessToken,
            refreshToken,
            expiresIn: 3600
        });
        
    } catch (error) {
        console.error('❌ Apple OAuth error:', error.message);
        res.status(400).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find existing OAuth user or create new one
 */
async function findOrCreateOAuthUser(oauthData) {
    try {
        // Check if user exists by email
        let result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [oauthData.email]
        );
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            // Update OAuth provider info
            await pool.query(
                'UPDATE users SET oauth_provider = $1, oauth_id = $2, avatar = $3 WHERE id = $4',
                [oauthData.provider, oauthData.providerId, oauthData.avatar, user.id]
            );
            
            console.log(`✅ Updated existing OAuth user: ${user.email}`);
            return user;
        }
        
        // Create new user if doesn't exist
        result = await pool.query(
            `INSERT INTO users (email, username, avatar, oauth_provider, oauth_id, email_verified, subscription_tier, level)
             VALUES ($1, $2, $3, $4, $5, $6, 'free', 1)
             RETURNING *`,
            [
                oauthData.email, 
                oauthData.username, 
                oauthData.avatar, 
                oauthData.provider, 
                oauthData.providerId, 
                oauthData.verifiedEmail || true
            ]
        );
        
        console.log(`✅ Created new OAuth user: ${oauthData.email}`);
        return result.rows[0];
        
    } catch (error) {
        console.error('❌ Error in findOrCreateOAuthUser:', error.message);
        throw error;
    }
}

/**
 * Generate JWT access and refresh tokens
 */
function generateTokens(userId) {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' }
    );
    
    return { accessToken, refreshToken };
}

/**
 * Generate Apple client secret (required for Apple OAuth)
 */
function generateAppleClientSecret() {
    if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
        throw new Error('Apple OAuth configuration incomplete');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
        {
            iss: APPLE_TEAM_ID,
            aud: 'https://appleid.apple.com',
            sub: APPLE_CLIENT_ID,
            iat: now,
            exp: now + 3600
        },
        APPLE_PRIVATE_KEY,
        { algorithm: 'ES256', keyid: APPLE_KEY_ID }
    );
    
    return token;
}

// ============================================
// REDIRECT ENDPOINTS
// ============================================

/**
 * GET /api/oauth/google/signin
 * Redirect to Google OAuth page
 */
router.get('/google/signin', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('openid email profile')}` +
        `&state=${state}`;
    
    console.log('🔗 Redirecting to Google OAuth');
    res.redirect(url);
});

/**
 * GET /api/oauth/apple/signin
 * Redirect to Apple OAuth page
 */
router.get('/apple/signin', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    
    const url = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${APPLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(APPLE_REDIRECT_URI)}` +
        `&response_type=code` +
        `&response_mode=form_post` +
        `&scope=openid email` +
        `&state=${state}`;
    
    console.log('🔗 Redirecting to Apple OAuth');
    res.redirect(url);
});

// ============================================
// REFRESH TOKEN ENDPOINT
// ============================================

/**
 * POST /api/oauth/refresh
 * Refresh expired access token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Refresh token required'
            });
        }
        
        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_SECRET || 'your-secret-key'
        );
        
        // Generate new access token
        const accessToken = jwt.sign(
            { userId: decoded.userId },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );
        
        res.json({
            accessToken,
            expiresIn: 3600
        });
        
    } catch (error) {
        console.error('❌ Token refresh error:', error.message);
        res.status(400).json({
            error: 'Invalid refresh token',
            message: error.message
        });
    }
});

module.exports = router;
