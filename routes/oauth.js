// ============================================
// OAUTH ROUTES (BACKEND) - FIXED VERSION
// Google OAuth & Apple Sign-In handlers
// USES: Native Node.js fetch (no axios needed)
// ============================================

const express = require('express');
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
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || 'https://play.rosebud.ai/oauth/apple/callback';

// ============================================
// GOOGLE OAUTH (using native fetch)
// ============================================

router.post('/google/callback', async (req, res, next) => {
    try {
        const { code, codeVerifier, redirectUri } = req.body;
        
        if (!code) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code required'
            });
        }
        
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });
        
        if (!tokenResponse.ok) {
            console.error('❌ Google token exchange failed');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Failed to exchange authorization code'
            });
        }
        
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!userInfoResponse.ok) {
            console.error('❌ Failed to get Google user info');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Failed to retrieve user information'
            });
        }
        
        const userInfo = await userInfoResponse.json();
        
        const { rows } = await query(
            `INSERT INTO users (
                email, name, picture, oauth_provider, oauth_id, 
                created_at, updated_at
            ) VALUES ($1, $2, $3, 'google', $4, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET
                name = $2,
                picture = $3,
                oauth_provider = 'google',
                oauth_id = $4,
                updated_at = NOW()
            RETURNING *`,
            [userInfo.email, userInfo.name || userInfo.email, userInfo.picture, userInfo.id]
        );
        
        const user = rows[0];
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );
        
        console.log(`✅ Google OAuth successful for user: ${user.email}`);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                picture: user.picture
            }
        });
        
    } catch (error) {
        console.error('❌ Google OAuth error:', error.message);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// APPLE SIGNIN (using native fetch)
// ============================================

router.post('/apple/callback', async (req, res, next) => {
    try {
        const { code, user, id_token } = req.body;
        
        if (!code) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code required'
            });
        }
        
        const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: APPLE_CLIENT_ID,
                client_secret: generateAppleClientSecret(),
                code,
                grant_type: 'authorization_code',
                redirect_uri: APPLE_REDIRECT_URI
            })
        });
        
        if (!tokenResponse.ok) {
            console.error('❌ Apple token exchange failed');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Failed to exchange authorization code'
            });
        }
        
        const tokenData = await tokenResponse.json();
        
        let userInfo;
        if (id_token) {
            try {
                const parts = id_token.split('.');
                const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                userInfo = {
                    id: decoded.sub,
                    email: decoded.email
                };
            } catch (e) {
                console.error('Failed to decode ID token');
                userInfo = { id: user?.user, email: user?.email };
            }
        }
        
        if (!userInfo?.email) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'User email required for Apple Sign-In'
            });
        }
        
        const { rows } = await query(
            `INSERT INTO users (
                email, name, oauth_provider, oauth_id, 
                created_at, updated_at
            ) VALUES ($1, $2, 'apple', $3, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET
                oauth_provider = 'apple',
                oauth_id = $3,
                updated_at = NOW()
            RETURNING *`,
            [userInfo.email, user?.name?.firstName || userInfo.email, userInfo.id]
        );
        
        const dbUser = rows[0];
        
        const token = jwt.sign(
            { userId: dbUser.id, email: dbUser.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );
        
        console.log(`✅ Apple Sign-In successful for user: ${dbUser.email}`);
        
        res.json({
            success: true,
            token,
            user: {
                id: dbUser.id,
                email: dbUser.email,
                name: dbUser.name
            }
        });
        
    } catch (error) {
        console.error('❌ Apple Sign-In error:', error.message);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// HELPER: Generate Apple Client Secret
// ============================================

function generateAppleClientSecret() {
    if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
        throw new Error('Missing Apple credentials');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const expiration = now + 15 * 60;
    
    const header = {
        alg: 'ES256',
        kid: APPLE_KEY_ID
    };
    
    const payload = {
        iss: APPLE_TEAM_ID,
        iat: now,
        exp: expiration,
        aud: 'https://appleid.apple.com',
        sub: APPLE_CLIENT_ID
    };
    
    const crypto = require('crypto');
    
    try {
        const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const message = `${headerB64}.${payloadB64}`;
        
        const sign = crypto.createSign('sha256');
        sign.update(message);
        sign.end();
        
        const signature = sign.sign(APPLE_PRIVATE_KEY, 'base64url');
        
        return `${message}.${signature}`;
    } catch (error) {
        console.error('❌ Error generating Apple client secret:', error.message);
        throw error;
    }
}

// ============================================
// REFRESH TOKEN ENDPOINT
// ============================================

router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const { rows } = await query(
            'SELECT id, email, name FROM users WHERE id = $1',
            [userId]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found'
            });
        }
        
        const user = rows[0];
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token
        });
        
    } catch (error) {
        console.error('❌ Token refresh error:', error.message);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// GET USER OAUTH STATUS
// ============================================

router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const { rows } = await query(
            'SELECT id, email, name, picture, oauth_provider FROM users WHERE id = $1',
            [userId]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: rows[0]
        });
        
    } catch (error) {
        console.error('❌ OAuth status error:', error.message);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;
                
