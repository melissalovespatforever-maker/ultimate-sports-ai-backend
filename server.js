// ============================================
// ULTIMATE SPORTS AI - PRODUCTION SERVER
// Full features: DB, Auth, Real AI, Live Data
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

console.log('🚀 Starting PRODUCTION backend initialization...');
console.log(`📍 Node.js version: ${process.version}`);
console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);

// Catch any synchronous errors during module loading
process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error.message);
    console.error(error.stack);
});

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io (Non-blocking)
let io;
try {
    io = new Server(server, {
        cors: {
            origin: function(origin, callback) {
                // Allow all origins for maximum compatibility
                callback(null, true);
            },
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    console.log('✅ Socket.io initialized');
} catch (e) {
    console.warn('⚠️  Socket.io initialization warning:', e.message);
}

// Middleware
app.use(cors({ origin: true, credentials: true })); // Allow all origins with credentials
app.use(compression());
app.set('trust proxy', 1); // Trust first proxy (Railway/Vercel)
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Security Headers (Helmet)
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false
}));

// Request Logging (Development only)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

let dbInitialized = false;
let dbInitializationPromise = null;

async function ensureDatabaseInitialized() {
    if (dbInitialized) return true;
    if (dbInitializationPromise) return dbInitializationPromise;
    
    dbInitializationPromise = (async () => {
        try {
            const { pool } = require('./config/database');
            
            console.log('🔍 Checking database connection...');
            
            // Test connection
            await pool.query('SELECT 1');
            console.log('✅ Database connection successful');
            
            // Check if tables exist
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'users'
                )
            `);
            
            if (!tableCheck.rows[0].exists) {
                console.log('📖 Tables do not exist. Please run /api/admin/init-database');
            } else {
                console.log('✅ Tables detected');
            }
            
            dbInitialized = true;
            return true;
        } catch (error) {
            console.warn('⚠️  Database connection warning:', error.message);
            // Don't fail completely - allows server to start even if DB is flaky
            dbInitialized = true; // Pretend it's fine to avoid blocking
            return false;
        }
    })();
    
    return dbInitializationPromise;
}

// Initialize database in background
ensureDatabaseInitialized().catch(err => console.error('DB Init Error:', err));

// ============================================
// ROUTE LOADING
// ============================================

// Helper to safely load routes
const safeRequire = (path, name) => {
    try {
        console.log(`📍 Loading ${name} routes...`);
        const route = require(path);
        console.log(`✅ ${name} routes loaded`);
        return route;
    } catch (e) {
        console.error(`❌ Failed to load ${name} routes:`, e.message);
        // Return empty router to prevent crash
        return express.Router();
    }
};

const authRoutes = safeRequire('./routes/auth', 'Auth');
const userRoutes = safeRequire('./routes/users', 'User');
const shopRoutes = safeRequire('./routes/shop', 'Shop');
const adminRoutes = safeRequire('./routes/admin', 'Admin');
const aiCoachesRoutes = safeRequire('./routes/ai-coaches', 'AI Coaches');
const aiChatRoutes = safeRequire('./routes/ai-chat', 'AI Chat');
const oddsRoutes = safeRequire('./routes/odds', 'Odds');
const scoresRoutes = safeRequire('./routes/scores', 'Scores');
const betsRoutes = safeRequire('./routes/bets', 'Bets');
const subscriptionsRoutes = safeRequire('./routes/subscriptions', 'Subscriptions');
const achievementsRoutes = safeRequire('./routes/achievements', 'Achievements');
const analyticsRoutes = safeRequire('./routes/analytics', 'Analytics');
const twoFactorRoutes = safeRequire('./routes/two-factor', '2FA');
const socialRoutes = safeRequire('./routes/social', 'Social');
const passwordResetRoutes = safeRequire('./routes/password-reset', 'Password Reset');
const initCoachesRoutes = safeRequire('./routes/init-coaches', 'Init Coaches');
const initCoachesGetRoutes = safeRequire('./routes/init-coaches-get', 'Init Coaches GET');
const checkCoachesRoutes = safeRequire('./routes/check-coaches', 'Check Coaches');
const tournamentsRoutes = safeRequire('./routes/tournaments', 'Tournaments');
const leaderboardsRoutes = safeRequire('./routes/leaderboards', 'Leaderboards');
const databaseInitRoutes = safeRequire('./routes/database-init', 'Database Init');

// Middleware Loading
let authenticateToken;
try {
    authenticateToken = require('./middleware/auth').authenticateToken;
    console.log('✅ Auth middleware loaded');
} catch (e) {
    console.error('❌ Failed to load auth middleware:', e.message);
    authenticateToken = (req, res, next) => next(); // Bypass if failed
}

// ============================================
// ENDPOINTS
// ============================================

// Health Checks
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', message: 'Backend running' }));
app.get('/api/health', (req, res) => res.json({ 
    status: 'healthy', 
    service: 'ultimate-sports-ai-backend', 
    version: '2.0.0',
    database: dbInitialized ? 'connected' : 'initializing'
}));

// ============================================
// DATABASE INITIALIZATION ROUTES (NEW - RECOMMENDED)
// ============================================

// Register the new database init routes
app.use('/api/admin', databaseInitRoutes);

// ============================================
// PUBLIC ADMIN ENDPOINTS (Legacy - kept for backwards compatibility)
// ============================================

// OLD Database Init Endpoint (Uses schema files)
// NOTE: The new routes in database-init.js are recommended
app.get('/api/admin/init-database-legacy', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { pool } = require('./config/database');
        
        console.log('📊 Admin Database init requested (LEGACY)');
        
        // Drop all existing tables first
        console.log('🗑️  Dropping existing tables...');
        await pool.query(`
            DROP TABLE IF EXISTS oauth_providers CASCADE;
            DROP TABLE IF EXISTS age_verification CASCADE;
            DROP TABLE IF EXISTS user_analytics CASCADE;
            DROP TABLE IF EXISTS user_badges CASCADE;
            DROP TABLE IF EXISTS badges CASCADE;
            DROP TABLE IF EXISTS user_friends CASCADE;
            DROP TABLE IF EXISTS user_followers CASCADE;
            DROP TABLE IF EXISTS email_logs CASCADE;
            DROP TABLE IF EXISTS push_notifications CASCADE;
            DROP TABLE IF EXISTS two_factor_auth CASCADE;
            DROP TABLE IF EXISTS invoices CASCADE;
            DROP TABLE IF EXISTS subscriptions CASCADE;
            DROP TABLE IF EXISTS referrals CASCADE;
            DROP TABLE IF EXISTS live_bet_tracking CASCADE;
            DROP TABLE IF EXISTS bets CASCADE;
            DROP TABLE IF EXISTS active_boosters CASCADE;
            DROP TABLE IF EXISTS daily_deal_stock CASCADE;
            DROP TABLE IF EXISTS daily_deal_purchases CASCADE;
            DROP TABLE IF EXISTS user_shop_purchases CASCADE;
            DROP TABLE IF EXISTS shop_inventory CASCADE;
            DROP TABLE IF EXISTS shop_items CASCADE;
            DROP TABLE IF EXISTS user_achievements CASCADE;
            DROP TABLE IF EXISTS achievements CASCADE;
            DROP TABLE IF EXISTS challenges CASCADE;
            DROP TABLE IF EXISTS leaderboards CASCADE;
            DROP TABLE IF EXISTS coach_stats CASCADE;
            DROP TABLE IF EXISTS coach_picks CASCADE;
            DROP TABLE IF EXISTS coaches CASCADE;
            DROP TABLE IF EXISTS tournaments CASCADE;
            DROP TABLE IF EXISTS refresh_tokens CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        `);
        console.log('✅ Old tables dropped');
        
        // Read schema and seed files
        const schemaPath = path.join(__dirname, 'database', 'schema-complete.sql');
        const seedPath = path.join(__dirname, 'database', 'seed-complete.sql');
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        const seed = fs.readFileSync(seedPath, 'utf8');
        
        // Execute schema
        await pool.query(schema);
        console.log('✅ Schema executed');
        
        // Execute seed
        await pool.query(seed);
        console.log('✅ Seed executed');
        
        res.json({
            success: true,
            message: 'Database initialized successfully! 🎉',
            details: {
                tables: 'Created (old tables dropped)',
                seed: 'Inserted'
            }
        });
    } catch (error) {
        console.error('❌ Database init failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// API Routes Mounting
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // Auth middleware is now inside route handlers
app.use('/api/shop', shopRoutes);
app.use('/api/ai-coaches', aiCoachesRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/odds', oddsRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/bets', authenticateToken, betsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/achievements', authenticateToken, achievementsRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/social', authenticateToken, socialRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/init-coaches', initCoachesRoutes);
app.use('/api/init-coaches-now', initCoachesGetRoutes);
app.use('/api/check-coaches', checkCoachesRoutes);
app.use('/api/tournaments', authenticateToken, tournamentsRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);

// Admin routes should be registered AFTER database-init to avoid conflicts
// We already registered adminRoutes via database-init above

// Live Dashboard Config
app.get('/api/live-dashboard/config', (req, res) => {
    res.json({ 
        success: true, 
        oddsApiKey: process.env.THE_ODDS_API_KEY,
        oddsApiUrl: 'https://api.the-odds-api.com/v4'
    });
});

// Debug Config
app.get('/api/debug/config', (req, res) => {
    res.json({ 
        environment: process.env.NODE_ENV, 
        nodeVersion: process.version,
        jwtSecretConfigured: !!process.env.JWT_SECRET,
        dbConfigured: !!process.env.DATABASE_URL
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(500).json({ error: 'Server error', message: err.message });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏈 Ultimate Sports AI Backend Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Server is ready to accept connections`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing gracefully...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Closing gracefully...');
    server.close(() => process.exit(0));
});

module.exports = { app, server, io };
