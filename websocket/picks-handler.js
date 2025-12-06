// ============================================
// PICKS HANDLER - Real-time Pick Notifications
// WebSocket handler for live pick updates
// ============================================

class PicksHandler {
    constructor(io) {
        this.io = io;
        this.activePicks = new Map();
        this.userSubscriptions = new Map();
        this.pickListeners = new Map();
    }

    /**
     * Handle new WebSocket connection for picks
     */
    handleConnection(socket) {
        console.log(`🎲 Picks WebSocket connected: ${socket.id}`);

        // Subscribe to coach picks
        socket.on('subscribe:picks', (data) => {
            this.subscribeToPicks(socket, data);
        });

        // Unsubscribe from coach picks
        socket.on('unsubscribe:picks', (coachIds) => {
            this.unsubscribeFromPicks(socket, coachIds);
        });

        // Subscribe to all picks (admin/dashboard)
        socket.on('subscribe:all-picks', () => {
            this.subscribeToAllPicks(socket);
        });

        // Listen for pick results
        socket.on('pick:result', (data) => {
            this.handlePickResult(socket, data);
        });

        // Get active picks for coach
        socket.on('get:active-picks', (coachId) => {
            this.sendActivePicks(socket, coachId);
        });

        // Disconnect
        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });
    }

    /**
     * Subscribe to specific coach picks
     */
    subscribeToPicks(socket, data) {
        const { coachIds } = data;

        if (!Array.isArray(coachIds)) {
            socket.emit('error', { message: 'coachIds must be an array' });
            return;
        }

        coachIds.forEach(coachId => {
            const room = `coach:picks:${coachId}`;
            socket.join(room);
            console.log(`📥 Socket ${socket.id} subscribed to ${room}`);
        });

        // Track subscription
        if (!this.userSubscriptions.has(socket.id)) {
            this.userSubscriptions.set(socket.id, new Set());
        }

        coachIds.forEach(coachId => {
            this.userSubscriptions.get(socket.id).add(coachId);
        });

        socket.emit('subscribe:picks:success', {
            coachIds,
            message: `Subscribed to ${coachIds.length} coach(es)`
        });
    }

    /**
     * Unsubscribe from coach picks
     */
    unsubscribeFromPicks(socket, coachIds) {
        coachIds.forEach(coachId => {
            const room = `coach:picks:${coachId}`;
            socket.leave(room);
            
            const subs = this.userSubscriptions.get(socket.id);
            if (subs) {
                subs.delete(coachId);
            }
        });

        console.log(`📤 Socket ${socket.id} unsubscribed from ${coachIds.length} coach(es)`);
    }

    /**
     * Subscribe to ALL picks (admin dashboard)
     */
    subscribeToAllPicks(socket) {
        socket.join('admin:all-picks');
        console.log(`👨‍💼 Admin socket ${socket.id} subscribed to all picks`);
        
        socket.emit('subscribe:all-picks:success', {
            message: 'Subscribed to all pick updates'
        });
    }

    /**
     * Handle pick result submission
     */
    handlePickResult(socket, data) {
        const { pickId, result, coachId } = data;

        if (!['win', 'loss', 'push'].includes(result)) {
            socket.emit('error', { message: 'Invalid result' });
            return;
        }

        // Broadcast result to all subscribers
        this.broadcastPickResult(pickId, result, coachId);

        socket.emit('pick:result:success', {
            pickId,
            result,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send active picks for a coach
     */
    sendActivePicks(socket, coachId) {
        const picks = this.activePicks.get(coachId) || [];
        
        socket.emit('active-picks', {
            coachId,
            picks,
            count: picks.length,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Broadcast new pick to subscribers
     */
    broadcastNewPick(pick) {
        const { coach_id, id, sport, home_team, away_team, pick_team, confidence, odds } = pick;

        const pickData = {
            id,
            coach_id,
            sport,
            matchup: `${away_team} @ ${home_team}`,
            pick: pick_team,
            confidence,
            odds,
            result: 'pending',
            created_at: new Date().toISOString()
        };

        // Store in active picks
        if (!this.activePicks.has(coach_id)) {
            this.activePicks.set(coach_id, []);
        }
        this.activePicks.get(coach_id).push(pickData);

        // Broadcast to coach subscribers
        this.io.to(`coach:picks:${coach_id}`).emit('pick:created', {
            ...pickData,
            event: 'new_pick',
            notification: `New pick from Coach ${coach_id}: ${pick_team}`,
            sound: true,
            badge: true
        });

        // Broadcast to admin
        this.io.to('admin:all-picks').emit('pick:created', {
            ...pickData,
            event: 'new_pick_admin'
        });

        console.log(`✅ New pick broadcasted: Coach ${coach_id} - ${pick_team}`);
    }

    /**
     * Broadcast pick result
     */
    broadcastPickResult(pickId, result, coachId) {
        // Update active picks
        if (this.activePicks.has(coachId)) {
            const picks = this.activePicks.get(coachId);
            const pickIndex = picks.findIndex(p => p.id === pickId);
            if (pickIndex !== -1) {
                picks[pickIndex].result = result;
                picks[pickIndex].result_at = new Date().toISOString();
            }
        }

        const resultEmoji = result === 'win' ? '✅' : result === 'loss' ? '❌' : '➡️';

        // Broadcast to subscribers
        this.io.to(`coach:picks:${coachId}`).emit('pick:result', {
            pickId,
            coachId,
            result,
            event: `pick_${result}`,
            notification: `Pick ${resultEmoji} - ${result.toUpperCase()}`,
            timestamp: new Date().toISOString(),
            sound: true,
            badge: true
        });

        // Broadcast to admin
        this.io.to('admin:all-picks').emit('pick:result', {
            pickId,
            coachId,
            result,
            timestamp: new Date().toISOString()
        });

        console.log(`📊 Pick result: ${pickId} = ${result.toUpperCase()}`);
    }

    /**
     * Broadcast pick streak update
     */
    broadcastStreakUpdate(coachId, streak, accuracy) {
        this.io.to(`coach:picks:${coachId}`).emit('coach:streak:update', {
            coachId,
            streak,
            accuracy,
            event: 'streak_update',
            notification: `${coachId} streak: ${streak}W`,
            timestamp: new Date().toISOString()
        });

        this.io.to('admin:all-picks').emit('coach:streak:update', {
            coachId,
            streak,
            accuracy
        });

        console.log(`🔥 Streak update: Coach ${coachId} - ${streak} wins`);
    }

    /**
     * Broadcast coach stats update
     */
    broadcastStatsUpdate(coachId, stats) {
        this.io.to(`coach:picks:${coachId}`).emit('coach:stats:update', {
            coachId,
            stats,
            event: 'stats_update',
            timestamp: new Date().toISOString()
        });

        this.io.to('admin:all-picks').emit('coach:stats:update', {
            coachId,
            stats
        });
    }

    /**
     * Broadcast market movement alert
     */
    broadcastMarketMovement(coachId, pickId, data) {
        const { home_team, away_team, oddsMovement, newOdds } = data;

        this.io.to(`coach:picks:${coachId}`).emit('market:movement', {
            pickId,
            coachId,
            matchup: `${away_team} @ ${home_team}`,
            oddsMovement,
            newOdds,
            event: 'market_alert',
            notification: `Market moved: ${newOdds} (${oddsMovement > 0 ? '+' : ''}${oddsMovement})`,
            timestamp: new Date().toISOString(),
            sound: true
        });

        this.io.to('admin:all-picks').emit('market:movement', {
            pickId,
            coachId,
            oddsMovement,
            newOdds
        });

        console.log(`💹 Market movement: Pick ${pickId} - Odds now ${newOdds}`);
    }

    /**
     * Broadcast injury alert
     */
    broadcastInjuryAlert(coachId, pickId, data) {
        const { home_team, away_team, injuredPlayer, status } = data;

        this.io.to(`coach:picks:${coachId}`).emit('injury:alert', {
            pickId,
            coachId,
            matchup: `${away_team} @ ${home_team}`,
            injuredPlayer,
            status,
            event: 'injury_alert',
            notification: `⚠️ Injury Alert: ${injuredPlayer} (${status})`,
            timestamp: new Date().toISOString(),
            sound: true,
            urgent: status === 'Out'
        });

        this.io.to('admin:all-picks').emit('injury:alert', {
            pickId,
            coachId,
            injuredPlayer,
            status
        });

        console.log(`🏥 Injury alert: ${injuredPlayer} - ${status}`);
    }

    /**
     * Broadcast game status update
     */
    broadcastGameStatus(pickId, data) {
        const { sport, home_team, away_team, status, home_score, away_score } = data;

        this.io.to('admin:all-picks').emit('game:status', {
            pickId,
            matchup: `${away_team} @ ${home_team}`,
            status,
            score: `${home_score} - ${away_score}`,
            event: `game_${status.toLowerCase()}`,
            timestamp: new Date().toISOString()
        });

        // Broadcast to relevant coach subscribers
        // This would require pick-to-coach mapping
        console.log(`🎮 Game status: ${home_team} vs ${away_team} - ${status}`);
    }

    /**
     * Send real-time notification to user
     */
    notifyUser(userId, notification) {
        this.io.to(`user:${userId}`).emit('pick:notification', {
            ...notification,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Broadcast to specific room
     */
    broadcastToRoom(room, event, data) {
        this.io.to(room).emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle socket disconnect
     */
    handleDisconnect(socket) {
        // Clean up subscriptions
        this.userSubscriptions.delete(socket.id);
        console.log(`🔌 Picks WebSocket disconnected: ${socket.id}`);
    }

    /**
     * Get stats for all active coaches
     */
    getActivePickStats() {
        const stats = {
            totalActivePicks: 0,
            picksByCoach: {}
        };

        for (const [coachId, picks] of this.activePicks.entries()) {
            stats.picksByCoach[coachId] = {
                total: picks.length,
                pending: picks.filter(p => p.result === 'pending').length,
                wins: picks.filter(p => p.result === 'win').length,
                losses: picks.filter(p => p.result === 'loss').length,
                pushes: picks.filter(p => p.result === 'push').length
            };
            stats.totalActivePicks += picks.length;
        }

        return stats;
    }
}

module.exports = PicksHandler;
