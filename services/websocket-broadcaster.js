// ============================================
// WEBSOCKET BROADCASTER
// Pushes real-time ESPN data updates to connected clients
// ============================================

console.log('📍 Loading WebSocket Broadcaster...');

let io = null;
let connectedClients = new Set();

/**
 * Initialize WebSocket broadcaster with Socket.io instance
 */
function initializeBroadcaster(socketIoInstance) {
    io = socketIoInstance;

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        connectedClients.add(socket.id);

        // Send welcome message
        socket.emit('connection', {
            status: 'connected',
            clientId: socket.id,
            message: 'Connected to Ultimate Sports AI real-time updates'
        });

        // Handle client subscribing to a sport
        socket.on('subscribe', (data) => {
            const { sport } = data;
            console.log(`📡 Client ${socket.id} subscribed to ${sport}`);
            
            socket.join(`sport:${sport.toLowerCase()}`);
            socket.emit('subscribed', {
                sport: sport.toLowerCase(),
                message: `Subscribed to live ${sport} updates`
            });
        });

        // Handle client unsubscribing
        socket.on('unsubscribe', (data) => {
            const { sport } = data;
            console.log(`📡 Client ${socket.id} unsubscribed from ${sport}`);
            
            socket.leave(`sport:${sport.toLowerCase()}`);
            socket.emit('unsubscribed', {
                sport: sport.toLowerCase(),
                message: `Unsubscribed from ${sport} updates`
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
            connectedClients.delete(socket.id);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`⚠️  Socket error for ${socket.id}:`, error);
        });
    });

    console.log('✅ WebSocket Broadcaster initialized');
    return true;
}

/**
 * Broadcast score update to all connected clients for a sport
 */
function broadcastScoreUpdate(sport, games) {
    if (!io) {
        console.warn('⚠️  WebSocket not initialized');
        return false;
    }

    const room = `sport:${sport.toLowerCase()}`;
    const update = {
        sport: sport.toUpperCase(),
        games: games,
        timestamp: new Date().toISOString(),
        gameCount: games.length
    };

    io.to(room).emit('score_update', update);
    
    // Also broadcast to admin dashboard
    io.emit('admin:score_update', {
        ...update,
        room: room,
        clientsSubscribed: io.sockets.adapter.rooms.get(room)?.size || 0
    });

    return true;
}

/**
 * Broadcast sync status to all clients
 */
function broadcastSyncStatus(status) {
    if (!io) return false;

    io.emit('sync_status', {
        status: status.lastSyncStatus,
        timestamp: new Date().toISOString(),
        stats: {
            totalSyncs: status.totalSyncs,
            successfulSyncs: status.successfulSyncs,
            failedSyncs: status.failedSyncs,
            gamesUpdated: status.gamesUpdated
        },
        sports: status.sports
    });

    return true;
}

/**
 * Broadcast scheduler heartbeat (keep-alive)
 */
function broadcastHeartbeat(stats) {
    if (!io) return false;

    io.emit('scheduler_heartbeat', {
        timestamp: new Date().toISOString(),
        running: true,
        stats: stats,
        connectedClients: connectedClients.size
    });

    return true;
}

/**
 * Broadcast game event (new game, game ended, etc)
 */
function broadcastGameEvent(eventType, gameData) {
    if (!io) return false;

    const sport = gameData.sport.toLowerCase();
    const room = `sport:${sport}`;

    const event = {
        eventType: eventType, // 'game_start', 'game_end', 'score_change', 'status_update'
        game: gameData,
        timestamp: new Date().toISOString()
    };

    io.to(room).emit('game_event', event);
    
    // Also broadcast to all clients
    io.emit('admin:game_event', {
        ...event,
        room: room
    });

    console.log(`🎯 Game event broadcasted: ${eventType} - ${gameData.away_team} vs ${gameData.home_team}`);
    return true;
}

/**
 * Broadcast notification to specific user or all users
 */
function broadcastNotification(notification, targetRoom = null) {
    if (!io) return false;

    const data = {
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info', // 'info', 'success', 'warning', 'error'
        timestamp: new Date().toISOString(),
        icon: notification.icon || '📢'
    };

    if (targetRoom) {
        io.to(targetRoom).emit('notification', data);
    } else {
        io.emit('notification', data);
    }

    console.log(`📢 Notification broadcasted: ${notification.title}`);
    return true;
}

/**
 * Get connected clients count
 */
function getConnectedClientsCount() {
    return connectedClients.size;
}

/**
 * Get stats
 */
function getStats() {
    if (!io) {
        return {
            connected: false,
            clients: 0,
            rooms: []
        };
    }

    const rooms = [];
    io.sockets.adapter.rooms.forEach((value, key) => {
        if (key.startsWith('sport:')) {
            rooms.push({
                room: key,
                subscribers: value.size
            });
        }
    });

    return {
        connected: true,
        clients: connectedClients.size,
        rooms: rooms,
        totalConnections: io.engine.clientsCount
    };
}

module.exports = {
    initializeBroadcaster,
    broadcastScoreUpdate,
    broadcastSyncStatus,
    broadcastHeartbeat,
    broadcastGameEvent,
    broadcastNotification,
    getConnectedClientsCount,
    getStats
};

console.log('✅ WebSocket Broadcaster loaded');
