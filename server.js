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

const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { setupWebSocket } = require('./websocket/handler');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Compression
app.use(compression());

// Trust proxy (required for Railway, Render, Heroku)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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
        environment: process.env.NODE_ENV
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/picks', authenticateToken, picksRoutes);
app.use('/api/social', authenticateToken, socialRoutes);
app.use('/api/achievements', authenticateToken, achievementsRoutes);
app.use('/api/challenges', authenticateToken, challengesRoutes);
app.use('/api/shop', authenticateToken, shopRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/odds', oddsRoutes); // Public route for odds data

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
