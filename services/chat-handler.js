// ============================================
// CHAT HANDLER - Real-time Sports Lounge Chat
// ============================================

const { query } = require('../config/database');

class ChatHandler {
    constructor(io) {
        this.io = io;
        this.onlineUsers = new Map(); // userId -> { username, avatar, socketId }
        this.chatNamespace = io.of('/chat');
        this.setupChatNamespace();
    }

    setupChatNamespace() {
        this.chatNamespace.on('connection', (socket) => {
            console.log(`💬 Chat WebSocket connected: ${socket.id}`);

            // ============================================
            // USER AUTHENTICATION
            // ============================================
            socket.on('auth', async (data) => {
                try {
                    const { userId, username, avatar } = data;
                    
                    // Store user info
                    socket.userId = userId;
                    socket.username = username || 'Guest User';
                    socket.avatar = avatar || '🎮';
                    
                    // Add to online users
                    this.onlineUsers.set(userId, {
                        username: socket.username,
                        avatar: socket.avatar,
                        socketId: socket.id,
                        joinedAt: new Date()
                    });

                    // Join default channel
                    socket.join('channel:general');
                    socket.currentChannel = 'general';

                    // Broadcast user joined
                    this.chatNamespace.to('channel:general').emit('user:joined', {
                        userId,
                        username: socket.username,
                        avatar: socket.avatar,
                        timestamp: new Date()
                    });

                    // Send online users list
                    socket.emit('online:users', this.getOnlineUsersList());

                    // Broadcast updated online count
                    this.broadcastOnlineCount();

                    console.log(`✅ User authenticated: ${socket.username} (${userId})`);
                } catch (error) {
                    console.error('Auth error:', error);
                    socket.emit('error', { message: 'Authentication failed' });
                }
            });

            // ============================================
            // CHANNEL SWITCHING
            // ============================================
            socket.on('channel:join', async (channelName) => {
                try {
                    // Leave current channel
                    if (socket.currentChannel) {
                        socket.leave(`channel:${socket.currentChannel}`);
                        this.chatNamespace.to(`channel:${socket.currentChannel}`).emit('user:left', {
                            userId: socket.userId,
                            username: socket.username,
                            channel: socket.currentChannel,
                            timestamp: new Date()
                        });
                    }

                    // Join new channel
                    socket.join(`channel:${channelName}`);
                    socket.currentChannel = channelName;

                    // Notify channel
                    this.chatNamespace.to(`channel:${channelName}`).emit('user:joined', {
                        userId: socket.userId,
                        username: socket.username,
                        avatar: socket.avatar,
                        channel: channelName,
                        timestamp: new Date()
                    });

                    // Load recent messages
                    const recentMessages = await this.getRecentMessages(channelName, 50);
                    socket.emit('channel:history', {
                        channel: channelName,
                        messages: recentMessages
                    });

                    console.log(`📢 ${socket.username} joined #${channelName}`);
                } catch (error) {
                    console.error('Channel join error:', error);
                }
            });

            // ============================================
            // MESSAGE HANDLING
            // ============================================
            socket.on('message:send', async (data) => {
                try {
                    const { message, channel } = data;

                    // Validate
                    if (!message || message.trim().length === 0) {
                        return socket.emit('error', { message: 'Empty message' });
                    }

                    if (message.length > 500) {
                        return socket.emit('error', { message: 'Message too long (max 500 chars)' });
                    }

                    // Create message object
                    const chatMessage = {
                        id: Date.now() + Math.random(),
                        userId: socket.userId,
                        username: socket.username,
                        avatar: socket.avatar,
                        message: this.sanitizeMessage(message),
                        channel: channel || socket.currentChannel,
                        timestamp: new Date(),
                        reactions: []
                    };

                    // Save to database (optional - for history)
                    await this.saveMessage(chatMessage);

                    // Broadcast to channel
                    this.chatNamespace.to(`channel:${chatMessage.channel}`).emit('message:new', chatMessage);

                    console.log(`💬 ${socket.username}: ${message.substring(0, 50)}...`);
                } catch (error) {
                    console.error('Message send error:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            // ============================================
            // TYPING INDICATOR
            // ============================================
            socket.on('typing:start', () => {
                if (socket.currentChannel) {
                    socket.to(`channel:${socket.currentChannel}`).emit('typing:indicator', {
                        userId: socket.userId,
                        username: socket.username,
                        isTyping: true
                    });
                }
            });

            socket.on('typing:stop', () => {
                if (socket.currentChannel) {
                    socket.to(`channel:${socket.currentChannel}`).emit('typing:indicator', {
                        userId: socket.userId,
                        username: socket.username,
                        isTyping: false
                    });
                }
            });

            // ============================================
            // REACTIONS
            // ============================================
            socket.on('message:react', async (data) => {
                try {
                    const { messageId, emoji } = data;
                    
                    // Broadcast reaction
                    this.chatNamespace.to(`channel:${socket.currentChannel}`).emit('message:reaction', {
                        messageId,
                        userId: socket.userId,
                        username: socket.username,
                        emoji,
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.error('Reaction error:', error);
                }
            });

            // ============================================
            // MODERATION
            // ============================================
            socket.on('message:delete', async (messageId) => {
                // Admin/moderator only
                if (socket.isAdmin || socket.isModerator) {
                    this.chatNamespace.to(`channel:${socket.currentChannel}`).emit('message:deleted', {
                        messageId,
                        deletedBy: socket.username,
                        timestamp: new Date()
                    });
                }
            });

            // ============================================
            // DISCONNECT
            // ============================================
            socket.on('disconnect', () => {
                if (socket.userId) {
                    // Remove from online users
                    this.onlineUsers.delete(socket.userId);

                    // Notify channel
                    if (socket.currentChannel) {
                        this.chatNamespace.to(`channel:${socket.currentChannel}`).emit('user:left', {
                            userId: socket.userId,
                            username: socket.username,
                            timestamp: new Date()
                        });
                    }

                    // Broadcast updated online count
                    this.broadcastOnlineCount();

                    console.log(`❌ User disconnected: ${socket.username}`);
                }
            });
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    sanitizeMessage(message) {
        // Basic XSS prevention
        return message
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }

    async saveMessage(message) {
        try {
            // Create table if not exists
            await query(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGSERIAL PRIMARY KEY,
                    user_id INTEGER,
                    username VARCHAR(100),
                    avatar VARCHAR(20),
                    message TEXT,
                    channel VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await query(
                `INSERT INTO chat_messages (user_id, username, avatar, message, channel) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [message.userId, message.username, message.avatar, message.message, message.channel]
            );
        } catch (error) {
            console.error('Error saving message:', error);
            // Non-critical - chat still works without persistence
        }
    }

    async getRecentMessages(channel, limit = 50) {
        try {
            const result = await query(
                `SELECT user_id as "userId", username, avatar, message, channel, created_at as timestamp 
                 FROM chat_messages 
                 WHERE channel = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [channel, limit]
            );
            return result.rows.reverse(); // Oldest first
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    getOnlineUsersList() {
        return Array.from(this.onlineUsers.values()).map(user => ({
            username: user.username,
            avatar: user.avatar,
            joinedAt: user.joinedAt
        }));
    }

    broadcastOnlineCount() {
        this.chatNamespace.emit('online:count', {
            count: this.onlineUsers.size
        });
    }

    // Public method to send system messages
    sendSystemMessage(channel, message) {
        this.chatNamespace.to(`channel:${channel}`).emit('message:new', {
            id: Date.now(),
            userId: 0,
            username: 'System',
            avatar: '🤖',
            message,
            channel,
            timestamp: new Date(),
            isSystem: true
        });
    }
}

module.exports = ChatHandler;
