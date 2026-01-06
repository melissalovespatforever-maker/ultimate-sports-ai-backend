// ============================================
// MATCHES WEBSOCKET HANDLER
// Real-time live match updates via WebSocket
// ============================================

class MatchesHandler {
    constructor(io) {
        this.io = io;
        this.matchNamespace = io.of('/matches');
        this.liveMatches = new Map(); // matchId -> match data
        this.userSubscriptions = new Map(); // userId -> Set of matchIds
        this.matchSubscribers = new Map(); // matchId -> Set of userIds
        
        this.setupNamespace();
        console.log('⚽ Matches Handler initialized');
    }

    setupNamespace() {
        // No auth required for match updates (public data)
        this.matchNamespace.on('connection', (socket) => {
            console.log(`🔌 Match WebSocket connected: ${socket.id}`);
            
            // Subscribe to specific match
            socket.on('subscribe:match', (data) => {
                this.handleSubscribeMatch(socket, data);
            });
            
            // Unsubscribe from match
            socket.on('unsubscribe:match', (data) => {
                this.handleUnsubscribeMatch(socket, data);
            });
            
            // Get match data
            socket.on('get:match', (matchId, callback) => {
                this.handleGetMatch(socket, matchId, callback);
            });
            
            // Disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    // ============================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================

    handleSubscribeMatch(socket, data) {
        const { gameId } = data;
        
        socket.join(`match:${gameId}`);
        
        // Track subscription
        if (!this.userSubscriptions.has(socket.id)) {
            this.userSubscriptions.set(socket.id, new Set());
        }
        this.userSubscriptions.get(socket.id).add(gameId);
        
        if (!this.matchSubscribers.has(gameId)) {
            this.matchSubscribers.set(gameId, new Set());
        }
        this.matchSubscribers.get(gameId).add(socket.id);
        
        console.log(`👁️ Socket ${socket.id} subscribed to match ${gameId}`);
        console.log(`   Total subscribers for match ${gameId}: ${this.matchSubscribers.get(gameId).size}`);
        
        // Send current match data if available
        const matchData = this.liveMatches.get(gameId);
        if (matchData) {
            socket.emit('match:current_state', {
                gameId,
                data: matchData
            });
        }
    }

    handleUnsubscribeMatch(socket, data) {
        const { gameId } = data;
        
        socket.leave(`match:${gameId}`);
        
        // Update subscriptions
        const subscriptions = this.userSubscriptions.get(socket.id);
        if (subscriptions) {
            subscriptions.delete(gameId);
        }
        
        const subscribers = this.matchSubscribers.get(gameId);
        if (subscribers) {
            subscribers.delete(socket.id);
        }
        
        console.log(`👁️ Socket ${socket.id} unsubscribed from match ${gameId}`);
    }

    handleDisconnect(socket) {
        // Clean up subscriptions
        const subscriptions = this.userSubscriptions.get(socket.id);
        if (subscriptions) {
            subscriptions.forEach(gameId => {
                const subscribers = this.matchSubscribers.get(gameId);
                if (subscribers) {
                    subscribers.delete(socket.id);
                }
            });
            this.userSubscriptions.delete(socket.id);
        }
        
        console.log(`🔌 Match WebSocket disconnected: ${socket.id}`);
    }

    handleGetMatch(socket, matchId, callback) {
        const matchData = this.liveMatches.get(matchId);
        
        if (matchData) {
            callback(matchData);
        } else {
            callback({ error: 'Match not found' });
        }
    }

    // ============================================
    // BROADCAST METHODS
    // ============================================

    broadcastScoreUpdate(matchId, data) {
        const eventData = {
            type: 'score_update',
            gameId: matchId,
            score: data.score,
            quarter: data.quarter,
            clock: data.clock,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            timestamp: Date.now()
        };
        
        // Update stored match data
        if (this.liveMatches.has(matchId)) {
            const matchData = this.liveMatches.get(matchId);
            matchData.score = data.score;
            matchData.quarter = data.quarter;
            matchData.clock = data.clock;
            matchData.lastUpdate = Date.now();
        }
        
        // Broadcast to subscribers
        this.matchNamespace.to(`match:${matchId}`).emit('match:score_update', eventData);
        console.log(`📊 Score update for match ${matchId}: ${data.score.home}-${data.score.away}`);
    }

    broadcastKeyPlay(matchId, data) {
        const eventData = {
            type: 'key_play',
            gameId: matchId,
            play: data.play,
            team: data.team,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            timestamp: Date.now()
        };
        
        this.matchNamespace.to(`match:${matchId}`).emit('match:key_play', eventData);
        console.log(`🎯 Key play for match ${matchId}: ${data.play.description}`);
    }

    broadcastGameEnd(matchId, data) {
        const eventData = {
            type: 'game_end',
            gameId: matchId,
            finalScore: data.finalScore,
            winner: data.winner,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            duration: data.duration,
            timestamp: Date.now()
        };
        
        // Update stored match data
        if (this.liveMatches.has(matchId)) {
            const matchData = this.liveMatches.get(matchId);
            matchData.status = 'final';
            matchData.finalScore = data.finalScore;
            matchData.winner = data.winner;
        }
        
        // Broadcast to subscribers
        this.matchNamespace.to(`match:${matchId}`).emit('match:game_end', eventData);
        console.log(`🏁 Game ended for match ${matchId}: ${data.winner}`);
        
        // Clean up subscriptions after 5 minutes
        setTimeout(() => {
            this.matchNamespace.to(`match:${matchId}`).emit('match:cleanup');
            this.liveMatches.delete(matchId);
            this.matchSubscribers.delete(matchId);
        }, 300000);
    }

    broadcastInjury(matchId, data) {
        const eventData = {
            type: 'injury_report',
            gameId: matchId,
            player: data.player,
            team: data.team,
            severity: data.severity,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            timestamp: Date.now()
        };
        
        this.matchNamespace.to(`match:${matchId}`).emit('match:injury', eventData);
        console.log(`🏥 Injury update for match ${matchId}: ${data.player} (${data.severity})`);
    }

    broadcastMomentumChange(matchId, data) {
        const eventData = {
            type: 'momentum_change',
            gameId: matchId,
            team: data.team,
            strength: data.strength,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            timestamp: Date.now()
        };
        
        // Update stored match data
        if (this.liveMatches.has(matchId)) {
            const matchData = this.liveMatches.get(matchId);
            matchData.momentum = data;
        }
        
        this.matchNamespace.to(`match:${matchId}`).emit('match:momentum_change', eventData);
        console.log(`💥 Momentum change for match ${matchId}: ${data.team} (${data.strength})`);
    }

    broadcastOddsChange(matchId, data) {
        const eventData = {
            type: 'odds_change',
            gameId: matchId,
            market: data.market,
            oldOdds: data.oldOdds,
            newOdds: data.newOdds,
            change: data.change,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            sportsbook: data.sportsbook,
            timestamp: Date.now()
        };
        
        // Update odds in stored match data
        if (this.liveMatches.has(matchId)) {
            const matchData = this.liveMatches.get(matchId);
            if (!matchData.odds) {
                matchData.odds = {};
            }
            matchData.odds[data.market] = {
                current: data.newOdds,
                previous: data.oldOdds,
                change: data.change,
                updatedAt: Date.now()
            };
        }
        
        this.matchNamespace.to(`match:${matchId}`).emit('match:odds_change', eventData);
        console.log(`💰 Odds update for match ${matchId}: ${data.market} (${data.oldOdds} → ${data.newOdds})`);
    }

    broadcastStats(matchId, data) {
        const eventData = {
            type: 'stats_update',
            gameId: matchId,
            stats: data.stats,
            timestamp: Date.now()
        };
        
        // Update stats in stored match data
        if (this.liveMatches.has(matchId)) {
            const matchData = this.liveMatches.get(matchId);
            matchData.stats = data.stats;
        }
        
        this.matchNamespace.to(`match:${matchId}`).emit('match:stats_update', eventData);
    }

    broadcastPlayByPlay(matchId, data) {
        const eventData = {
            type: 'play_by_play',
            gameId: matchId,
            plays: data.plays,
            timestamp: Date.now()
        };
        
        // Update plays in stored match data
        if (this.liveMatches.has(matchId)) {
            const matchData = this.liveMatches.get(matchId);
            matchData.playByPlay = data.plays;
        }
        
        this.matchNamespace.to(`match:${matchId}`).emit('match:play_by_play', eventData);
    }

    // ============================================
    // MATCH MANAGEMENT
    // ============================================

    registerMatch(matchId, matchData) {
        this.liveMatches.set(matchId, {
            id: matchId,
            homeTeam: matchData.homeTeam,
            awayTeam: matchData.awayTeam,
            sport: matchData.sport,
            startTime: matchData.startTime || Date.now(),
            score: matchData.score || { home: 0, away: 0 },
            quarter: matchData.quarter || null,
            clock: matchData.clock || null,
            status: matchData.status || 'live',
            lastUpdate: Date.now()
        });
        
        console.log(`📝 Match registered: ${matchId} (${matchData.homeTeam} vs ${matchData.awayTeam})`);
    }

    unregisterMatch(matchId) {
        this.liveMatches.delete(matchId);
        this.matchSubscribers.delete(matchId);
        console.log(`🗑️ Match unregistered: ${matchId}`);
    }

    getMatchData(matchId) {
        return this.liveMatches.get(matchId);
    }

    getActiveMatches() {
        return Array.from(this.liveMatches.values());
    }

    getMatchSubscriberCount(matchId) {
        const subscribers = this.matchSubscribers.get(matchId);
        return subscribers ? subscribers.size : 0;
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStats() {
        return {
            activeMatches: this.liveMatches.size,
            totalSubscriptions: this.userSubscriptions.size,
            matches: Array.from(this.liveMatches.entries()).map(([id, data]) => ({
                id,
                homeTeam: data.homeTeam,
                awayTeam: data.awayTeam,
                score: data.score,
                subscribers: this.getMatchSubscriberCount(id)
            }))
        };
    }

    // ============================================
    // CLEANUP
    // ============================================

    cleanup() {
        this.liveMatches.clear();
        this.userSubscriptions.clear();
        this.matchSubscribers.clear();
        console.log('🗑️ Matches handler cleaned up');
    }
}

module.exports = MatchesHandler;
