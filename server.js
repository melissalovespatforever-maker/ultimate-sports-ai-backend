// ============================================
// ULTIMATE SPORTS AI - BACKEND SERVER
// Node.js + Express + PostgreSQL
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const picksRoutes = require('./routes/picks');
const socialRoutes = require('./routes/social');
const achievementsRoutes = require('./routes/achievements');
const challengesRoutes = require('./routes/challenges');
const shopRoutes = require('./routes/shop');
const analyticsRoutes = require('./routes/analytics');
const oddsRoutes = require('./routes/odds');
const scoresRoutes = require('./routes/scores');
const aiCoachesRoutes = require('./routes/ai-coaches');
const paypalWebhooksRoutes = require('./routes/paypal-webhooks');
const subscriptionsRoutes = require('./routes/subscriptions');
const annualSubscriptionsRoutes = require('./routes/annual-subscriptions');
const invoicesRoutes = require('./routes/invoices');

const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { setupWebSocket } = require('./websocket/handler');
const {
    apiLimiter,
    authLimiter,
    paymentLimiter,
    corsOptions,
    securityHeaders,
    sanitizeInput,
    securityLogger
} = require('./middleware/security');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: function(origin, callback) {
            // Allow all Rosebud domains and localhost
            if (!origin || origin.includes('rosebud.ai') || origin.includes('localhost')) {
                callback(null, true);
            } else {
                callback(null, true); // Allow anyway for development
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// ============================================
// MIDDLEWARE
// ============================================

// Security logging (must be first)
app.use(securityLogger);

// Security headers
app.use(securityHeaders);

// CORS with enhanced security
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Trust proxy (required for Railway, Render, Heroku)
app.set('trust proxy', 1);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization (prevent NoSQL injection)
app.use(sanitizeInput);

// General API rate limiting
app.use('/api/', apiLimiter);

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        oddsApiConfigured: !!process.env.THE_ODDS_API_KEY
    });
});

// Debug endpoint for testing API configuration
app.get('/api/debug/config', (req, res) => {
    res.json({
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        oddsApiConfigured: !!process.env.THE_ODDS_API_KEY,
        oddsApiKeyPreview: process.env.THE_ODDS_API_KEY ? `${process.env.THE_ODDS_API_KEY.substring(0, 10)}...` : 'NOT SET',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// TEST ENDPOINT - No authentication required
// ============================================
app.get('/api/test/games', (req, res) => {
    res.json({
        success: true,
        message: 'Backend API is working! 🎉',
        data: {
            games: [
                {
                    id: 1,
                    league: 'NBA',
                    home_team: 'Lakers',
                    away_team: 'Celtics',
                    status: 'live',
                    home_score: 98,
                    away_score: 105,
                    time_remaining: '5:30'
                },
                {
                    id: 2,
                    league: 'NFL',
                    home_team: 'Cowboys',
                    away_team: 'Chiefs',
                    status: 'upcoming',
                    home_score: 0,
                    away_score: 0,
                    time_remaining: 'In 2h'
                }
            ]
        }
    });
});

// Auth routes with strict rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Database initialization endpoint
app.get('/api/admin/init-database', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { pool } = require('./config/database');
        
        console.log('🔧 Starting database initialization...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('NODE_ENV:', process.env.NODE_ENV);
        
        // Test database connection first
        try {
            await pool.query('SELECT NOW()');
            console.log('✅ Database connection successful');
        } catch (connError) {
            console.error('❌ Database connection failed:', connError.message);
            return res.status(500).json({
                success: false,
                error: 'Database connection failed: ' + connError.message,
                hint: 'Check your DATABASE_URL environment variable in Railway'
            });
        }
        
        // Read schema file
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Read seed file
        const seedPath = path.join(__dirname, 'database', 'seed.sql');
        const seed = fs.readFileSync(seedPath, 'utf8');
        
        // Execute schema
        console.log('📊 Creating tables...');
        await pool.query(schema);
        console.log('✅ Tables created');
        
        // Execute seed
        console.log('🌱 Seeding data...');
        await pool.query(seed);
        console.log('✅ Seed data inserted');
        
        res.json({
            success: true,
            message: 'Database initialized successfully! 🎉',
            details: {
                tablesCreated: '18 tables',
                seedData: 'Achievements, challenges, shop items, test users'
            }
        });
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/picks', authenticateToken, picksRoutes);
app.use('/api/social', authenticateToken, socialRoutes);
app.use('/api/achievements', authenticateToken, achievementsRoutes);
app.use('/api/challenges', authenticateToken, challengesRoutes);
app.use('/api/shop', authenticateToken, shopRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/odds', oddsRoutes); // Public route for odds data
app.use('/api/scores', scoresRoutes); // Public route for live scores
app.use('/api/ai-coaches', aiCoachesRoutes); // AI Coaches with real data
app.use('/api/paypal', paypalWebhooksRoutes); // PayPal webhook and verification endpoints
app.use('/api/subscriptions', subscriptionsRoutes); // Subscription management
app.use('/api/annual-subscriptions', annualSubscriptionsRoutes); // Annual subscription billing management
app.use('/api/invoices', invoicesRoutes); // Email receipts and invoice management

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Error handler
app.use(errorHandler);

// ============================================
// WEBSOCKET SETUP
// ============================================

setupWebSocket(io);

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏈 Ultimate Sports AI Backend Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`⚡ WebSocket server ready`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
