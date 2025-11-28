/**
 * WebSocket Competitions Handler - Phase 18
 * Real-time multiplayer competitions sync
 * 
 * Features:
 * - Real-time challenge creation & joining
 * - Live matchmaking with instant pairing
 * - Match result broadcasting
 * - Rating updates sync
 * - Tournament bracket updates
 * - Leaderboard live updates
 * - Spectator mode
 */

const { pool } = require('../config/database');

// In-memory matchmaking queue
const matchmakingQueue = new Map();
const activeCompetitions = new Map();
const userSockets = new Map();

/**
 * Setup competitions WebSocket handlers
 */
function setupCompetitionsWebSocket(io) {
    const competitionsNsp = io.of('/competitions');
    
    competitionsNsp.on('connection', (socket) => {
        console.log(`🎮 Competitions WebSocket connected: ${socket.id}`);
        
        let userId = null;
        let currentChallenge = null;
        
        // ============================================================
        // AUTHENTICATION
        // ============================================================
        
        socket.on('authenticate', (data) => {
            userId = data.userId;
            userSockets.set(userId, socket.id);
            
            socket.emit('authenticated', {
                success: true,
                userId,
                socketId: socket.id
            });
            
            console.log(`✅ User ${userId} authenticated on competitions socket`);
        });
        
        // ============================================================
        // CHALLENGE CREATION
        // ============================================================
        
        socket.on('create_challenge', async (data) => {
            try {
                const { title, format, sport, wagerAmount, challengerId, challengerUsername, challengerAvatar } = data;
                
                // Validate
                if (!challengerId || !challengerUsername) {
                    socket.emit('error', { message: 'Missing required fields' });
                    return;
                }
                
                // Insert into database
                const result = await pool.query(`
                    INSERT INTO competitions (
                        type, title, format, sport, wager_amount,
                        status, challenger_id, challenger_username, challenger_avatar,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                    RETURNING *
                `, ['1v1', title, format, sport, wagerAmount || 0, 'waiting', challengerId, challengerUsername, challengerAvatar || '']);
                
                const challenge = result.rows[0];
                
                // Store in memory
                activeCompetitions.set(challenge.id, challenge);
                
                // Broadcast to all users
                competitionsNsp.emit('challenge_created', {
                    challenge: formatChallenge(challenge)
                });
                
                socket.emit('challenge_created_success', {
                    challengeId: challenge.id,
                    challenge: formatChallenge(challenge)
                });
                
                console.log(`✅ Challenge created: ${challenge.id}`);
                
            } catch (error) {
                console.error('❌ Create challenge error:', error);
                socket.emit('error', { message: 'Failed to create challenge' });
            }
        });
        
        // ============================================================
        // JOIN CHALLENGE
        // ============================================================
        
        socket.on('join_challenge', async (data) => {
            try {
                const { challengeId, userId, username, avatar } = data;
                
                // Get challenge from database
                const result = await pool.query(
                    'SELECT * FROM competitions WHERE id = $1 AND status = $2',
                    [challengeId, 'waiting']
                );
                
                if (result.rows.length === 0) {
                    socket.emit('error', { message: 'Challenge not available' });
                    return;
                }
                
                const challenge = result.rows[0];
                
                // Check if user is joining own challenge
                if (challenge.challenger_id === userId) {
                    socket.emit('error', { message: 'Cannot join own challenge' });
                    return;
                }
                
                // Update challenge with opponent
                await pool.query(`
                    UPDATE competitions 
                    SET opponent_id = $1, 
                        opponent_username = $2, 
                        opponent_avatar = $3,
                        status = $4,
                        matched_at = NOW()
                    WHERE id = $5
                `, [userId, username, avatar || '', 'matched', challengeId]);
                
                // Get updated challenge
                const updated = await pool.query('SELECT * FROM competitions WHERE id = $1', [challengeId]);
                const updatedChallenge = updated.rows[0];
                
                // Update memory
                activeCompetitions.set(challengeId, updatedChallenge);
                
                // Notify both players
                const challengerSocketId = userSockets.get(challenge.challenger_id);
                if (challengerSocketId) {
                    competitionsNsp.to(challengerSocketId).emit('opponent_joined', {
                        challenge: formatChallenge(updatedChallenge)
                    });
                }
                
                socket.emit('challenge_joined_success', {
                    challenge: formatChallenge(updatedChallenge)
                });
                
                // Broadcast update to all
                competitionsNsp.emit('challenge_updated', {
                    challenge: formatChallenge(updatedChallenge)
                });
                
                console.log(`✅ User ${userId} joined challenge ${challengeId}`);
                
            } catch (error) {
                console.error('❌ Join challenge error:', error);
                socket.emit('error', { message: 'Failed to join challenge' });
            }
        });
        
        // ============================================================
        // START CHALLENGE
        // ============================================================
        
        socket.on('start_challenge', async (data) => {
            try {
                const { challengeId } = data;
                
                // Update status
                await pool.query(`
                    UPDATE competitions 
                    SET status = $1, started_at = NOW()
                    WHERE id = $2 AND status = $3
                `, ['in_progress', challengeId, 'matched']);
                
                // Get updated challenge
                const result = await pool.query('SELECT * FROM competitions WHERE id = $1', [challengeId]);
                const challenge = result.rows[0];
                
                if (!challenge) {
                    socket.emit('error', { message: 'Challenge not found' });
                    return;
                }
                
                // Update memory
                activeCompetitions.set(challengeId, challenge);
                
                // Notify both players
                const challengerSocketId = userSockets.get(challenge.challenger_id);
                const opponentSocketId = userSockets.get(challenge.opponent_id);
                
                const payload = { challenge: formatChallenge(challenge) };
                
                if (challengerSocketId) {
                    competitionsNsp.to(challengerSocketId).emit('challenge_started', payload);
                }
                if (opponentSocketId) {
                    competitionsNsp.to(opponentSocketId).emit('challenge_started', payload);
                }
                
                // Broadcast to all
                competitionsNsp.emit('challenge_updated', payload);
                
                console.log(`✅ Challenge ${challengeId} started`);
                
            } catch (error) {
                console.error('❌ Start challenge error:', error);
                socket.emit('error', { message: 'Failed to start challenge' });
            }
        });
        
        // ============================================================
        // RECORD MATCH RESULT
        // ============================================================
        
        socket.on('record_match_result', async (data) => {
            try {
                const { challengeId, winnerId, matchData } = data;
                
                // Get challenge
                const result = await pool.query('SELECT * FROM competitions WHERE id = $1', [challengeId]);
                const challenge = result.rows[0];
                
                if (!challenge) {
                    socket.emit('error', { message: 'Challenge not found' });
                    return;
                }
                
                // Insert match result
                await pool.query(`
                    INSERT INTO competition_matches (
                        competition_id, match_number, winner_id, timestamp
                    ) VALUES ($1, $2, $3, NOW())
                `, [challengeId, challenge.match_count + 1, winnerId]);
                
                // Update scores
                let newChallengerScore = challenge.challenger_score || 0;
                let newOpponentScore = challenge.opponent_score || 0;
                
                if (winnerId === challenge.challenger_id) {
                    newChallengerScore++;
                } else {
                    newOpponentScore++;
                }
                
                // Check if challenge is complete
                const winsNeeded = getWinsNeeded(challenge.format);
                let newStatus = challenge.status;
                let winner = null;
                
                if (newChallengerScore >= winsNeeded) {
                    newStatus = 'completed';
                    winner = challenge.challenger_id;
                } else if (newOpponentScore >= winsNeeded) {
                    newStatus = 'completed';
                    winner = challenge.opponent_id;
                }
                
                // Update challenge
                await pool.query(`
                    UPDATE competitions 
                    SET challenger_score = $1,
                        opponent_score = $2,
                        match_count = match_count + 1,
                        status = $3,
                        winner_id = $4,
                        completed_at = $5
                    WHERE id = $6
                `, [
                    newChallengerScore,
                    newOpponentScore,
                    newStatus,
                    winner,
                    newStatus === 'completed' ? new Date() : null,
                    challengeId
                ]);
                
                // Get updated challenge
                const updated = await pool.query('SELECT * FROM competitions WHERE id = $1', [challengeId]);
                const updatedChallenge = updated.rows[0];
                
                // Update ratings if completed
                if (newStatus === 'completed') {
                    await updateRatings(updatedChallenge);
                    await distributeRewards(updatedChallenge);
                }
                
                // Update memory
                activeCompetitions.set(challengeId, updatedChallenge);
                
                // Notify both players
                const challengerSocketId = userSockets.get(challenge.challenger_id);
                const opponentSocketId = userSockets.get(challenge.opponent_id);
                
                const payload = {
                    challenge: formatChallenge(updatedChallenge),
                    matchNumber: challenge.match_count + 1,
                    winnerId
                };
                
                if (challengerSocketId) {
                    competitionsNsp.to(challengerSocketId).emit('match_result_recorded', payload);
                }
                if (opponentSocketId) {
                    competitionsNsp.to(opponentSocketId).emit('match_result_recorded', payload);
                }
                
                // Broadcast to spectators
                competitionsNsp.emit('challenge_updated', {
                    challenge: formatChallenge(updatedChallenge)
                });
                
                // If completed, emit completion event
                if (newStatus === 'completed') {
                    const completionPayload = {
                        challenge: formatChallenge(updatedChallenge),
                        winner,
                        loser: winner === challenge.challenger_id ? challenge.opponent_id : challenge.challenger_id
                    };
                    
                    if (challengerSocketId) {
                        competitionsNsp.to(challengerSocketId).emit('challenge_completed', completionPayload);
                    }
                    if (opponentSocketId) {
                        competitionsNsp.to(opponentSocketId).emit('challenge_completed', completionPayload);
                    }
                    
                    competitionsNsp.emit('challenge_completed_public', completionPayload);
                }
                
                console.log(`✅ Match result recorded for challenge ${challengeId}`);
                
            } catch (error) {
                console.error('❌ Record match result error:', error);
                socket.emit('error', { message: 'Failed to record match result' });
            }
        });
        
        // ============================================================
        // MATCHMAKING
        // ============================================================
        
        socket.on('join_matchmaking', async (data) => {
            try {
                const { userId, username, avatar, preferences } = data;
                
                // Get user rating
                const ratingResult = await pool.query(
                    'SELECT rating FROM user_competition_stats WHERE user_id = $1',
                    [userId]
                );
                
                const rating = ratingResult.rows.length > 0 ? ratingResult.rows[0].rating : 1500;
                
                const queueEntry = {
                    userId,
                    username,
                    avatar: avatar || '',
                    rating,
                    preferences: preferences || {},
                    socketId: socket.id,
                    queuedAt: Date.now()
                };
                
                matchmakingQueue.set(userId, queueEntry);
                
                socket.emit('matchmaking_joined', {
                    success: true,
                    position: matchmakingQueue.size,
                    rating
                });
                
                // Try to find a match immediately
                const match = findBestMatch(queueEntry);
                if (match) {
                    await createMatchFromQueue(queueEntry, match, competitionsNsp);
                }
                
                console.log(`✅ User ${userId} joined matchmaking queue (${matchmakingQueue.size} in queue)`);
                
            } catch (error) {
                console.error('❌ Join matchmaking error:', error);
                socket.emit('error', { message: 'Failed to join matchmaking' });
            }
        });
        
        socket.on('leave_matchmaking', (data) => {
            const { userId } = data;
            matchmakingQueue.delete(userId);
            socket.emit('matchmaking_left', { success: true });
            console.log(`✅ User ${userId} left matchmaking queue`);
        });
        
        // ============================================================
        // LEADERBOARD SUBSCRIPTION
        // ============================================================
        
        socket.on('subscribe_leaderboard', () => {
            socket.join('leaderboard');
            console.log(`✅ Socket ${socket.id} subscribed to leaderboard`);
        });
        
        socket.on('unsubscribe_leaderboard', () => {
            socket.leave('leaderboard');
            console.log(`✅ Socket ${socket.id} unsubscribed from leaderboard`);
        });
        
        // ============================================================
        // SPECTATOR MODE
        // ============================================================
        
        socket.on('spectate_challenge', (data) => {
            const { challengeId } = data;
            socket.join(`challenge_${challengeId}`);
            socket.emit('spectating_challenge', { challengeId });
            console.log(`✅ Socket ${socket.id} spectating challenge ${challengeId}`);
        });
        
        socket.on('stop_spectating', (data) => {
            const { challengeId } = data;
            socket.leave(`challenge_${challengeId}`);
            console.log(`✅ Socket ${socket.id} stopped spectating challenge ${challengeId}`);
        });
        
        // ============================================================
        // DISCONNECT
        // ============================================================
        
        socket.on('disconnect', () => {
            if (userId) {
                matchmakingQueue.delete(userId);
                userSockets.delete(userId);
                console.log(`❌ User ${userId} disconnected from competitions socket`);
            }
        });
    });
    
    // ============================================================
    // PERIODIC TASKS
    // ============================================================
    
    // Matchmaking cycle every 3 seconds
    setInterval(() => {
        if (matchmakingQueue.size >= 2) {
            processMatchmakingQueue(competitionsNsp);
        }
    }, 3000);
    
    // Broadcast leaderboard updates every 10 seconds
    setInterval(async () => {
        try {
            const leaderboard = await getTopLeaderboard();
            competitionsNsp.to('leaderboard').emit('leaderboard_updated', { leaderboard });
        } catch (error) {
            console.error('❌ Leaderboard broadcast error:', error);
        }
    }, 10000);
    
    console.log('✅ Competitions WebSocket handlers initialized');
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format challenge for client
 */
function formatChallenge(challenge) {
    return {
        id: challenge.id,
        type: challenge.type,
        title: challenge.title,
        format: challenge.format,
        sport: challenge.sport,
        wagerAmount: challenge.wager_amount,
        status: challenge.status,
        createdAt: challenge.created_at,
        startedAt: challenge.started_at,
        completedAt: challenge.completed_at,
        
        challenger: {
            userId: challenge.challenger_id,
            username: challenge.challenger_username,
            avatar: challenge.challenger_avatar,
            score: challenge.challenger_score || 0
        },
        opponent: challenge.opponent_id ? {
            userId: challenge.opponent_id,
            username: challenge.opponent_username,
            avatar: challenge.opponent_avatar,
            score: challenge.opponent_score || 0
        } : null,
        
        matchCount: challenge.match_count || 0,
        winnerId: challenge.winner_id
    };
}

/**
 * Get wins needed for format
 */
function getWinsNeeded(format) {
    const formats = {
        'best_of_3': 2,
        'best_of_5': 3,
        'best_of_7': 4
    };
    return formats[format] || 3;
}

/**
 * Find best match in queue
 */
function findBestMatch(entry) {
    const candidates = Array.from(matchmakingQueue.values())
        .filter(q => 
            q.userId !== entry.userId &&
            Math.abs(q.rating - entry.rating) <= (entry.preferences.ratingRange || 200)
        )
        .sort((a, b) => {
            const diffA = Math.abs(a.rating - entry.rating);
            const diffB = Math.abs(b.rating - entry.rating);
            if (diffA !== diffB) return diffA - diffB;
            return a.queuedAt - b.queuedAt;
        });
    
    return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Create match from queue
 */
async function createMatchFromQueue(entry1, entry2, namespace) {
    try {
        // Create challenge in database
        const result = await pool.query(`
            INSERT INTO competitions (
                type, title, format, sport, wager_amount,
                status, challenger_id, challenger_username, challenger_avatar,
                opponent_id, opponent_username, opponent_avatar,
                created_at, matched_at, started_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), NOW())
            RETURNING *
        `, [
            '1v1',
            `${entry1.username} vs ${entry2.username}`,
            entry1.preferences.format || 'best_of_5',
            entry1.preferences.sport || 'all',
            0,
            'in_progress',
            entry1.userId,
            entry1.username,
            entry1.avatar,
            entry2.userId,
            entry2.username,
            entry2.avatar
        ]);
        
        const challenge = result.rows[0];
        
        // Remove from queue
        matchmakingQueue.delete(entry1.userId);
        matchmakingQueue.delete(entry2.userId);
        
        // Notify both players
        namespace.to(entry1.socketId).emit('match_found', {
            challenge: formatChallenge(challenge)
        });
        namespace.to(entry2.socketId).emit('match_found', {
            challenge: formatChallenge(challenge)
        });
        
        // Broadcast to all
        namespace.emit('challenge_created', {
            challenge: formatChallenge(challenge)
        });
        
        console.log(`✅ Match created from queue: ${entry1.username} vs ${entry2.username}`);
        
    } catch (error) {
        console.error('❌ Create match from queue error:', error);
    }
}

/**
 * Process matchmaking queue
 */
function processMatchmakingQueue(namespace) {
    const entries = Array.from(matchmakingQueue.values());
    
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const match = findBestMatch(entry);
        
        if (match) {
            createMatchFromQueue(entry, match, namespace);
            break; // Process one match at a time
        }
    }
}

/**
 * Update ELO ratings
 */
async function updateRatings(challenge) {
    try {
        const K = 32;
        
        // Get current ratings
        const winnerRating = await getUserRating(challenge.winner_id);
        const loserId = challenge.winner_id === challenge.challenger_id ? challenge.opponent_id : challenge.challenger_id;
        const loserRating = await getUserRating(loserId);
        
        // Calculate expected scores
        const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
        
        // Calculate new ratings
        const newWinnerRating = Math.round(winnerRating + K * (1 - expectedWinner));
        const newLoserRating = Math.round(loserRating + K * (0 - expectedLoser));
        
        // Update database
        await pool.query(`
            INSERT INTO user_competition_stats (user_id, rating, wins, losses, updated_at)
            VALUES ($1, $2, 1, 0, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                rating = $2,
                wins = user_competition_stats.wins + 1,
                updated_at = NOW()
        `, [challenge.winner_id, Math.max(0, newWinnerRating)]);
        
        await pool.query(`
            INSERT INTO user_competition_stats (user_id, rating, wins, losses, updated_at)
            VALUES ($1, $2, 0, 1, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                rating = $2,
                losses = user_competition_stats.losses + 1,
                updated_at = NOW()
        `, [loserId, Math.max(0, newLoserRating)]);
        
        console.log(`✅ Ratings updated: Winner ${winnerRating} → ${newWinnerRating}, Loser ${loserRating} → ${newLoserRating}`);
        
    } catch (error) {
        console.error('❌ Update ratings error:', error);
    }
}

/**
 * Get user rating
 */
async function getUserRating(userId) {
    try {
        const result = await pool.query(
            'SELECT rating FROM user_competition_stats WHERE user_id = $1',
            [userId]
        );
        return result.rows.length > 0 ? result.rows[0].rating : 1500;
    } catch (error) {
        return 1500;
    }
}

/**
 * Distribute rewards
 */
async function distributeRewards(challenge) {
    try {
        const baseReward = 100;
        const winnerCoins = baseReward * 2;
        const loserCoins = Math.round(baseReward * 0.25);
        
        // Update user coins
        await pool.query(`
            UPDATE users 
            SET coins = coins + $1
            WHERE id = $2
        `, [winnerCoins, challenge.winner_id]);
        
        const loserId = challenge.winner_id === challenge.challenger_id ? challenge.opponent_id : challenge.challenger_id;
        
        await pool.query(`
            UPDATE users 
            SET coins = coins + $1
            WHERE id = $2
        `, [loserCoins, loserId]);
        
        console.log(`✅ Rewards distributed: Winner +${winnerCoins}, Loser +${loserCoins}`);
        
    } catch (error) {
        console.error('❌ Distribute rewards error:', error);
    }
}

/**
 * Get top leaderboard
 */
async function getTopLeaderboard() {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.avatar_url,
                s.rating,
                s.wins,
                s.losses,
                CASE 
                    WHEN (s.wins + s.losses) > 0 
                    THEN ROUND((s.wins::decimal / (s.wins + s.losses)) * 100, 1)
                    ELSE 0 
                END as win_rate
            FROM user_competition_stats s
            JOIN users u ON u.id = s.user_id
            WHERE (s.wins + s.losses) >= 3
            ORDER BY win_rate DESC, s.rating DESC
            LIMIT 100
        `);
        
        return result.rows;
    } catch (error) {
        console.error('❌ Get leaderboard error:', error);
        return [];
    }
}

module.exports = { setupCompetitionsWebSocket };
