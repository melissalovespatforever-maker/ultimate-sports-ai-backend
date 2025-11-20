// ============================================
// WEBSOCKET HANDLER
// Real-time communication for live features
// ============================================

const jwt = require('jsonwebtoken');

const setupWebSocket = (io) => {
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentication error'));
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log(`✅ WebSocket connected: ${socket.userId}`);
        
        // Join user's personal room
        socket.join(`user:${socket.userId}`);
        
        // ============================================
        // LIVE SCORES
        // ============================================
        
        socket.on('subscribe:scores', (sports) => {
            sports.forEach(sport => {
                socket.join(`scores:${sport}`);
            });
            console.log(`📊 User ${socket.userId} subscribed to scores:`, sports);
        });
        
        socket.on('unsubscribe:scores', (sports) => {
            sports.forEach(sport => {
                socket.leave(`scores:${sport}`);
            });
        });
        
        // ============================================
        // ODDS UPDATES
        // ============================================
        
        socket.on('subscribe:odds', (gameIds) => {
            gameIds.forEach(gameId => {
                socket.join(`odds:${gameId}`);
            });
            console.log(`💰 User ${socket.userId} subscribed to odds`);
        });
        
        socket.on('unsubscribe:odds', (gameIds) => {
            gameIds.forEach(gameId => {
                socket.leave(`odds:${gameId}`);
            });
        });
        
        // ============================================
        // POOL CHAT
        // ============================================
        
        socket.on('join:pool', (poolId) => {
            socket.join(`pool:${poolId}`);
            io.to(`pool:${poolId}`).emit('user:joined', {
                userId: socket.userId,
                timestamp: new Date()
            });
            console.log(`🎱 User ${socket.userId} joined pool ${poolId}`);
        });
        
        socket.on('leave:pool', (poolId) => {
            socket.leave(`pool:${poolId}`);
            io.to(`pool:${poolId}`).emit('user:left', {
                userId: socket.userId,
                timestamp: new Date()
            });
        });
        
        socket.on('pool:message', (data) => {
            const { poolId, message } = data;
            io.to(`pool:${poolId}`).emit('pool:message', {
                userId: socket.userId,
                message,
                timestamp: new Date()
            });
        });
        
        // ============================================
        // COLLABORATIVE ANALYSIS
        // ============================================
        
        socket.on('join:analysis', (roomId) => {
            socket.join(`analysis:${roomId}`);
            io.to(`analysis:${roomId}`).emit('user:joined', {
                userId: socket.userId,
                timestamp: new Date()
            });
        });
        
        socket.on('leave:analysis', (roomId) => {
            socket.leave(`analysis:${roomId}`);
            io.to(`analysis:${roomId}`).emit('user:left', {
                userId: socket.userId,
                timestamp: new Date()
            });
        });
        
        socket.on('analysis:message', (data) => {
            const { roomId, message } = data;
            io.to(`analysis:${roomId}`).emit('analysis:message', {
                userId: socket.userId,
                message,
                timestamp: new Date()
            });
        });
        
        // ============================================
        // NOTIFICATIONS
        // ============================================
        
        socket.on('subscribe:notifications', () => {
            socket.join(`notifications:${socket.userId}`);
        });
        
        // ============================================
        // DISCONNECT
        // ============================================
        
        socket.on('disconnect', () => {
            console.log(`❌ WebSocket disconnected: ${socket.userId}`);
        });
    });
    
    // Helper functions to emit events from other parts of the app
    return {
        emitScoreUpdate: (sport, data) => {
            io.to(`scores:${sport}`).emit('score:update', data);
        },
        
        emitOddsUpdate: (gameId, data) => {
            io.to(`odds:${gameId}`).emit('odds:update', data);
        },
        
        emitNotification: (userId, notification) => {
            io.to(`user:${userId}`).emit('notification', notification);
        },
        
        emitToPool: (poolId, event, data) => {
            io.to(`pool:${poolId}`).emit(event, data);
        }
    };
};

module.exports = { setupWebSocket };
