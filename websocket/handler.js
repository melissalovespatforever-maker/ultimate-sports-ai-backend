// ============================================
// WEBSOCKET HANDLER
// Real-time communication for live features
// ============================================

const jwt = require('jsonwebtoken');
const OddsHandler = require('./odds-handler');
const MatchesHandler = require('./matches-handler');
const ScoresHandler = require('./scores-handler');
const PicksHandler = require('./picks-handler');
const ChatHandler = require('./chat-handler');
const { setupCompetitionsWebSocket } = require('./competitions-handler');

const setupWebSocket = (io) => {
    const oddsHandler = new OddsHandler(io);
    const matchesHandler = new MatchesHandler(io);
    const scoresHandler = new ScoresHandler(io);
    const picksHandler = new PicksHandler(io);
    const chatHandler = new ChatHandler(io);
    
    // Setup competitions namespace (Phase 18)
    setupCompetitionsWebSocket(io);
    
    // ============================================
    // ODDS NAMESPACE (No auth required)
    // ============================================
    
    io.of('/odds').on('connection', (socket) => {
        console.log(`🎯 Odds WebSocket connected: ${socket.id}`);
        oddsHandler.handleConnection(socket);
    });
    
    // ============================================
    // MATCHES NAMESPACE (No auth required for viewing)
    // ============================================
    // Initialized in MatchesHandler constructor
    
    // ============================================
    // PICKS NAMESPACE (Real-time pick notifications)
    // ============================================
    
    io.of('/picks').on('connection', (socket) => {
        console.log(`🎲 Picks WebSocket connected: ${socket.id}`);
        picksHandler.handleConnection(socket);
    });
    
    // ============================================
    // MAIN NAMESPACE (With auth)
    // ============================================
    
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
        },
        
        // Match notification handlers
        broadcastScoreUpdate: (matchId, data) => {
            matchesHandler.broadcastScoreUpdate(matchId, data);
        },
        
        broadcastKeyPlay: (matchId, data) => {
            matchesHandler.broadcastKeyPlay(matchId, data);
        },
        
        broadcastGameEnd: (matchId, data) => {
            matchesHandler.broadcastGameEnd(matchId, data);
        },
        
        broadcastInjury: (matchId, data) => {
            matchesHandler.broadcastInjury(matchId, data);
        },
        
        broadcastMomentumChange: (matchId, data) => {
            matchesHandler.broadcastMomentumChange(matchId, data);
        },
        
        broadcastOddsChange: (matchId, data) => {
            matchesHandler.broadcastOddsChange(matchId, data);
        },
        
        broadcastStats: (matchId, data) => {
            matchesHandler.broadcastStats(matchId, data);
        },
        
        registerMatch: (matchId, matchData) => {
            matchesHandler.registerMatch(matchId, matchData);
        },
        
        unregisterMatch: (matchId) => {
            matchesHandler.unregisterMatch(matchId);
        },
        
        getMatchData: (matchId) => {
            return matchesHandler.getMatchData(matchId);
        },
        
        getActiveMatches: () => {
            return matchesHandler.getActiveMatches();
        },
        
        // Picks handlers
        broadcastNewPick: (pick) => {
            picksHandler.broadcastNewPick(pick);
        },
        
        broadcastPickResult: (pickId, result, coachId) => {
            picksHandler.broadcastPickResult(pickId, result, coachId);
        },
        
        broadcastStreakUpdate: (coachId, streak, accuracy) => {
            picksHandler.broadcastStreakUpdate(coachId, streak, accuracy);
        },
        
        broadcastStatsUpdate: (coachId, stats) => {
            picksHandler.broadcastStatsUpdate(coachId, stats);
        },
        
        broadcastMarketMovement: (coachId, pickId, data) => {
            picksHandler.broadcastMarketMovement(coachId, pickId, data);
        },
        
        broadcastInjuryAlert: (coachId, pickId, data) => {
            picksHandler.broadcastInjuryAlert(coachId, pickId, data);
        },
        
        broadcastGameStatus: (pickId, data) => {
            picksHandler.broadcastGameStatus(pickId, data);
        },
        
        notifyUser: (userId, notification) => {
            picksHandler.notifyUser(userId, notification);
        },
        
        getActivePickStats: () => {
            return picksHandler.getActivePickStats();
        },
        
        matchesHandler,
        scoresHandler,
        picksHandler,
        chatHandler,
        
        // Chat methods
        sendSystemMessage: (channel, message) => {
            chatHandler.sendSystemMessage(channel, message);
        }
    };
};

module.exports = { setupWebSocket };
