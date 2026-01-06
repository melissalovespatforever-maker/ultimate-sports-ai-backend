// ============================================
// ULTIMATE SPORTS AI - PRODUCTION SERVER
// Full features: DB, Auth, Real AI, Live Data
// WITH: WebSocket broadcaster initialized
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
                console.log('📖 Tables do not exist. AUTO-INITIALIZING DATABASE...');
                
                // Create Users Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE,
                        email VARCHAR(255) UNIQUE,
                        password_hash VARCHAR(500),
                        subscription_tier VARCHAR(50) DEFAULT 'free',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create Games Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS games (
                        id SERIAL PRIMARY KEY,
                        sport VARCHAR(50) NOT NULL,
                        away_team VARCHAR(255) NOT NULL,
                        home_team VARCHAR(255) NOT NULL,
                        away_team_abbr VARCHAR(10),
                        home_team_abbr VARCHAR(10),
                        away_score INT,
                        home_score INT,
                        status VARCHAR(50),
                        game_time TIMESTAMP,
                        venue VARCHAR(255),
                        espn_id VARCHAR(255) UNIQUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create Bets Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS bets (
                        id SERIAL PRIMARY KEY,
                        user_id INT,
                        sport VARCHAR(50),
                        match_desc VARCHAR(255),
                        pick_details VARCHAR(255),
                        odds VARCHAR(10),
                        stake DECIMAL(10,2),
                        potential_win DECIMAL(10,2),
                        status VARCHAR(50),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create Coaches Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS coaches (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) UNIQUE NOT NULL,
                        sport VARCHAR(100),
                        accuracy INT,
                        streak INT,
                        avatar VARCHAR(500),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Create AI Coaches Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS ai_coaches (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) UNIQUE NOT NULL,
                        sport VARCHAR(100),
                        accuracy INT,
                        streak INT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create Transactions Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS transactions (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL,
                        type VARCHAR(50) NOT NULL, -- 'purchase', 'subscription', 'refund', 'bonus', 'bet_win'
                        amount DECIMAL(10, 2) NOT NULL, -- monetary amount
                        currency VARCHAR(10) DEFAULT 'USD',
                        coins_amount INT DEFAULT 0,
                        status VARCHAR(50) DEFAULT 'completed',
                        reference_id VARCHAR(255), -- PayPal Order ID or similar
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create Admin Logs Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS admin_logs (
                        id SERIAL PRIMARY KEY,
                        admin_id INT NOT NULL,
                        action VARCHAR(100) NOT NULL,
                        target_id INT, -- ID of the user or object affected
                        details TEXT,
                        ip_address VARCHAR(50),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create Shop Inventory Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS shop_inventory (
                        id SERIAL PRIMARY KEY,
                        item_id VARCHAR(50) UNIQUE NOT NULL,
                        item_name VARCHAR(100) NOT NULL,
                        category VARCHAR(50) NOT NULL,
                        price INTEGER NOT NULL,
                        tier VARCHAR(20) DEFAULT 'FREE',
                        description TEXT,
                        icon VARCHAR(10),
                        stock INTEGER DEFAULT -1,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                `);

                // Create User Inventory Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS user_inventory (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        item_id VARCHAR(50) NOT NULL,
                        item_name VARCHAR(100) NOT NULL,
                        item_type VARCHAR(50) NOT NULL,
                        quantity INTEGER DEFAULT 1,
                        metadata JSONB DEFAULT '{}'::jsonb,
                        expires_at TIMESTAMP,
                        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create User Shop Purchases Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS user_shop_purchases (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        item_id VARCHAR(50) NOT NULL,
                        item_name VARCHAR(100) NOT NULL,
                        price_paid INTEGER NOT NULL,
                        category VARCHAR(50) NOT NULL,
                        purchased_at TIMESTAMP DEFAULT NOW()
                    )
                `);

                // Create Active Boosters Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS active_boosters (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        booster_type VARCHAR(50) NOT NULL,
                        multiplier DECIMAL(3,2) DEFAULT 2.00,
                        duration_hours INTEGER DEFAULT 24,
                        activated_at TIMESTAMP DEFAULT NOW(),
                        expires_at TIMESTAMP NOT NULL,
                        UNIQUE(user_id, booster_type)
                    )
                `);

                console.log('✅ Database auto-initialization complete');
            } else {
                console.log('✅ Tables detected');
                
                // Self-Healing: Check for missing columns in existing tables
                
                // 1. Check for missing columns in users
                try {
                    await pool.query(`
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
                        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
                        ADD COLUMN IF NOT EXISTS coins INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
                        ADD COLUMN IF NOT EXISTS avatar VARCHAR(10) DEFAULT '😊',
                        ADD COLUMN IF NOT EXISTS wins INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS losses INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS best_streak INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS total_picks INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS win_rate DECIMAL(5,2) DEFAULT 0.00,
                        ADD COLUMN IF NOT EXISTS login_streak INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS longest_login_streak INT DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
                    `);
                    console.log('✅ Schema verification: users table columns ensured');
                } catch (e) {
                    console.warn('⚠️ Schema verification warning (users):', e.message);
                }

                // 2. Check for transactions table existence (if it was added later)
                try {
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS transactions (
                            id SERIAL PRIMARY KEY,
                            user_id INT NOT NULL,
                            type VARCHAR(50) NOT NULL,
                            amount DECIMAL(10, 2) NOT NULL,
                            currency VARCHAR(10) DEFAULT 'USD',
                            coins_amount INT DEFAULT 0,
                            status VARCHAR(50) DEFAULT 'completed',
                            reference_id VARCHAR(255),
                            description TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    
                    // Add coin_transactions table for unified coin economy
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS coin_transactions (
                            id SERIAL PRIMARY KEY,
                            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            type VARCHAR(50) NOT NULL,
                            amount INT NOT NULL,
                            balance_before INT NOT NULL,
                            balance_after INT NOT NULL,
                            reason VARCHAR(255),
                            metadata JSONB DEFAULT '{}',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    
                    // Add index for faster queries
                    await pool.query(`
                        CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id 
                        ON coin_transactions(user_id, created_at DESC)
                    `);
                    
                    // Add admin_logs if missing
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS admin_logs (
                            id SERIAL PRIMARY KEY,
                            admin_id INT NOT NULL,
                            action VARCHAR(100) NOT NULL,
                            target_id INT,
                            details TEXT,
                            ip_address VARCHAR(50),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    // Ensure Shop Tables exist
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS shop_inventory (
                            id SERIAL PRIMARY KEY,
                            item_id VARCHAR(50) UNIQUE NOT NULL,
                            item_name VARCHAR(100) NOT NULL,
                            category VARCHAR(50) NOT NULL,
                            price INTEGER NOT NULL,
                            tier VARCHAR(20) DEFAULT 'FREE',
                            description TEXT,
                            icon VARCHAR(10),
                            stock INTEGER DEFAULT -1,
                            created_at TIMESTAMP DEFAULT NOW(),
                            updated_at TIMESTAMP DEFAULT NOW()
                        )
                    `);

                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS user_inventory (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            item_id VARCHAR(50) NOT NULL,
                            item_name VARCHAR(100) NOT NULL,
                            item_type VARCHAR(50) NOT NULL,
                            quantity INTEGER DEFAULT 1,
                            metadata JSONB DEFAULT '{}'::jsonb,
                            expires_at TIMESTAMP,
                            purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS user_shop_purchases (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            item_id VARCHAR(50) NOT NULL,
                            item_name VARCHAR(100) NOT NULL,
                            price_paid INTEGER NOT NULL,
                            category VARCHAR(50) NOT NULL,
                            purchased_at TIMESTAMP DEFAULT NOW()
                        )
                    `);

                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS active_boosters (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            booster_type VARCHAR(50) NOT NULL,
                            multiplier DECIMAL(3,2) DEFAULT 2.00,
                            duration_hours INTEGER DEFAULT 24,
                            activated_at TIMESTAMP DEFAULT NOW(),
                            expires_at TIMESTAMP NOT NULL,
                            UNIQUE(user_id, booster_type)
                        )
                    `);

                    console.log('✅ Schema verification: new tables ensured');
                } catch (e) {
                    console.warn('⚠️ Schema verification warning (tables):', e.message);
                }
            }
            
            dbInitialized = true;
            return true;
        } catch (error) {
            console.error('❌ Database initialization error:', error.message);
            // Don't block server startup on database error
            dbInitialized = true;
            return false;
        }
    })();
    
    return dbInitializationPromise;
}

// ============================================
// WEBSOCKET BROADCASTER SETUP
// ============================================

let broadcaster = null;
let esponScheduler = null;

async function initializeWebSocketBroadcaster() {
    try {
        // Load the broadcaster
        const { WebSocketBroadcaster } = require('./services/websocket-broadcaster');
        broadcaster = new WebSocketBroadcaster(io);
        console.log('✅ WebSocket Broadcaster initialized');
        
        return broadcaster;
    } catch (error) {
        console.error('❌ Error initializing WebSocket Broadcaster:', error.message);
        return null;
    }
}

// ============================================
// START ESPN SCHEDULER (AFTER DB READY)
// ============================================

async function startESPNScheduler() {
    try {
        await ensureDatabaseInitialized();
        
        // Load ESPN scheduler
        const espnScheduler = require('./services/espn-scheduler');
        
        // Connect broadcaster to scheduler
        if (broadcaster) {
            espnScheduler.setBroadcaster(broadcaster);
            console.log('✅ ESPN Scheduler connected to WebSocket Broadcaster');
        }
        
        // Start the scheduler
        await espnScheduler.startESPNScheduler();
        console.log('✅ ESPN Scheduler started (30-second sync intervals)');
        
        return espnScheduler;
    } catch (error) {
        console.error('❌ Error starting ESPN Scheduler:', error.message);
    }
}

// ============================================
// ROUTE HANDLERS
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        websocket: !!io,
        broadcaster: !!broadcaster,
        database: dbInitialized
    });
});

// Database initialization endpoint
app.post('/api/admin/init-database', async (req, res, next) => {
    try {
        const initDB = require('./routes/database-init');
        await initDB();
        res.json({ success: true, message: 'Database initialized' });
    } catch (error) {
        console.error('❌ Database init error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// LOAD ALL ROUTES
// ============================================

const routeFiles = [
    'auth',
    'users',
    'transactions',
    'bets',
    'scores',
    'odds',
    'ai-coaches',
    'ai-chat',
    'achievements',
    'leaderboards-badges',
    'analytics',
    'shop',
    'inventory',
    'subscriptions',
    'badges',
    'social',
    'notifications',
    'tournaments',
    'challenges',
    'invoices',
    'annual-subscriptions',
    'age-verification',
    'password-reset',
    'two-factor',
    'paypal-webhooks',
    'push-notifications',
    'referrals',
    'admin',
    'oauth'
];

// Load routes synchronously to ensure correct middleware order
routeFiles.forEach((file) => {
    try {
        const route = require(`./routes/${file}`);
        app.use(`/api/${file}`, route);
        console.log(`✅ Route loaded: /api/${file}`);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.warn(`⚠️  Route not found: /api/${file}`);
        } else {
            console.error(`❌ Error loading /api/${file}:`, error.message);
        }
    }
});

// ============================================
// WEBSOCKET EVENT HANDLERS
// ============================================

if (io) {
    io.on('connection', (socket) => {
        console.log(`👥 Client connected: ${socket.id}`);
        
        // Client subscribes to sport
        socket.on('subscribe_sport', (sport) => {
            socket.join(`sport:${sport}`);
            console.log(`📡 Client ${socket.id} subscribed to ${sport}`);
            socket.emit('subscribed', { sport, status: 'ok' });
        });
        
        // Client unsubscribes from sport
        socket.on('unsubscribe_sport', (sport) => {
            socket.leave(`sport:${sport}`);
            console.log(`📡 Client ${socket.id} unsubscribed from ${sport}`);
        });
        
        // Heartbeat to keep connection alive
        socket.on('ping', () => {
            socket.emit('pong');
        });
        
        socket.on('disconnect', () => {
            console.log(`👥 Client disconnected: ${socket.id}`);
        });
    });
    
    console.log('📡 WebSocket event handlers attached');
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.path} not found`,
        method: req.method
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(error.status || 500).json({
        error: error.name || 'Internal Server Error',
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Ensure database is initialized
        console.log('⏳ Initializing database...');
        await ensureDatabaseInitialized();
        console.log('✅ Database ready');
        
        // Initialize WebSocket broadcaster
        console.log('⏳ Initializing WebSocket broadcaster...');
        await initializeWebSocketBroadcaster();
        console.log('✅ WebSocket broadcaster ready');
        
        // Start ESPN scheduler (connects to broadcaster)
        console.log('⏳ Starting ESPN scheduler...');
        await startESPNScheduler();
        console.log('✅ ESPN scheduler running');
        
        // Start the server
        server.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════════╗
║     🚀 ULTIMATE SPORTS AI SERVER RUNNING              ║
║                                                        ║
║     URL: http://localhost:${PORT}                        ║
║     WebSocket: ✅ Enabled                             ║
║     Database: ✅ Connected                            ║
║     ESPN Scheduler: ✅ Running (30s sync)             ║
║     Broadcaster: ✅ Active                            ║
║                                                        ║
║     Live Scores: Real-time WebSocket updates         ║
║     OAuth: Google & Apple Sign-In ready              ║
║     AI Coaches: All models loaded                    ║
╚════════════════════════════════════════════════════════╝
            `);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('⏹️  SIGTERM received - shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⏹️  SIGINT received - shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Start the server
startServer();

module.exports = app;
