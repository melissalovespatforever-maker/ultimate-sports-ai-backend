// ============================================
// PICKS NOTIFICATION CLIENT
// Real-time WebSocket client for pick updates
// Features:
// - Subscribe to coach picks
// - Receive live notifications
// - Sound/badge alerts
// - Auto-reconnection
// ============================================

import io from 'socket.io-client';

class PicksNotificationClient {
    constructor(options = {}) {
        this.socket = null;
        this.isConnected = false;
        this.subscriptions = new Set();
        this.listeners = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.options = {
            url: options.url || 'https://ultimate-sports-ai-backend-production.up.railway.app',
            namespace: options.namespace || '/picks',
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        };

        this.soundEnabled = true;
        this.badgeEnabled = true;
        this.notificationQueue = [];
    }

    /**
     * Connect to WebSocket
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io(`${this.options.url}${this.options.namespace}`, {
                    reconnection: this.options.reconnection,
                    reconnectionDelay: this.options.reconnectionDelay,
                    reconnectionDelayMax: this.options.reconnectionDelayMax,
                    reconnectionAttempts: this.options.reconnectionAttempts
                });

                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('✅ Picks WebSocket connected');
                    this.emit('connected');
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    console.log('❌ Picks WebSocket disconnected');
                    this.emit('disconnected');
                });

                this.socket.on('reconnect_attempt', () => {
                    this.reconnectAttempts++;
                    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}`);
                });

                this.socket.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                });

                // Set up event listeners
                this.setupEventListeners();

            } catch (error) {
                console.error('Failed to connect:', error);
                reject(error);
            }
        });
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Pick creation
        this.socket.on('pick:created', (data) => {
            this.handlePickCreated(data);
        });

        // Pick results
        this.socket.on('pick:result', (data) => {
            this.handlePickResult(data);
        });

        // Streak updates
        this.socket.on('coach:streak:update', (data) => {
            this.handleStreakUpdate(data);
        });

        // Stats updates
        this.socket.on('coach:stats:update', (data) => {
            this.handleStatsUpdate(data);
        });

        // Market movements
        this.socket.on('market:movement', (data) => {
            this.handleMarketMovement(data);
        });

        // Injury alerts
        this.socket.on('injury:alert', (data) => {
            this.handleInjuryAlert(data);
        });

        // Game status
        this.socket.on('game:status', (data) => {
            this.handleGameStatus(data);
        });

        // Subscription confirmation
        this.socket.on('subscribe:picks:success', (data) => {
            console.log('✅ Subscription successful:', data);
        });

        // Errors
        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
        });
    }

    /**
     * Subscribe to coach picks
     */
    subscribeToPicks(coachIds) {
        if (!this.isConnected) {
            console.warn('Not connected to WebSocket');
            return;
        }

        if (!Array.isArray(coachIds)) {
            coachIds = [coachIds];
        }

        coachIds.forEach(coachId => this.subscriptions.add(coachId));

        this.socket.emit('subscribe:picks', {
            coachIds: Array.from(this.subscriptions)
        });

        console.log(`📥 Subscribed to coaches: ${coachIds.join(', ')}`);
    }

    /**
     * Unsubscribe from coach picks
     */
    unsubscribeFromPicks(coachIds) {
        if (!this.isConnected) return;

        if (!Array.isArray(coachIds)) {
            coachIds = [coachIds];
        }

        coachIds.forEach(coachId => this.subscriptions.delete(coachId));

        this.socket.emit('unsubscribe:picks', coachIds);
        console.log(`📤 Unsubscribed from coaches: ${coachIds.join(', ')}`);
    }

    /**
     * Subscribe to all picks (admin)
     */
    subscribeToAllPicks() {
        if (!this.isConnected) return;

        this.socket.emit('subscribe:all-picks');
        console.log('👨‍💼 Subscribed to all picks');
    }

    /**
     * Handle pick created event
     */
    handlePickCreated(data) {
        const { coach_id, pick, matchup, confidence, odds, notification } = data;

        console.log(`🎲 New pick: ${pick} in ${matchup} (${confidence}% confidence)`);

        // Show notification
        this.showNotification({
            title: '🎲 New Pick',
            body: notification,
            icon: '🎯',
            tag: `pick-${data.id}`,
            data: data
        });

        // Play sound if enabled
        if (data.sound && this.soundEnabled) {
            this.playNotificationSound('pick-created');
        }

        // Update badge
        if (data.badge && this.badgeEnabled) {
            this.updateBadge();
        }

        this.emit('pick:created', data);
    }

    /**
     * Handle pick result event
     */
    handlePickResult(data) {
        const { result, notification, coachId } = data;

        const resultEmoji = result === 'win' ? '✅' : result === 'loss' ? '❌' : '➡️';
        console.log(`${resultEmoji} Pick result: ${result.toUpperCase()}`);

        // Show notification
        this.showNotification({
            title: `${resultEmoji} Pick Result`,
            body: notification,
            icon: resultEmoji,
            tag: `pick-result-${data.pickId}`,
            data: data,
            badge: 1
        });

        // Play sound
        if (data.sound && this.soundEnabled) {
            this.playNotificationSound(`pick-${result}`);
        }

        this.emit('pick:result', data);
    }

    /**
     * Handle streak update
     */
    handleStreakUpdate(data) {
        const { coachId, streak, accuracy } = data;

        console.log(`🔥 ${coachId} streak: ${streak}W (${accuracy}% accurate)`);

        this.showNotification({
            title: `🔥 Streak Update`,
            body: `${streak}-game winning streak! (${accuracy}% accuracy)`,
            icon: '🔥',
            tag: `streak-${coachId}`,
            data: data
        });

        this.emit('coach:streak:update', data);
    }

    /**
     * Handle stats update
     */
    handleStatsUpdate(data) {
        const { coachId, stats } = data;

        console.log(`📈 Stats updated for coach ${coachId}:`, stats);
        this.emit('coach:stats:update', data);
    }

    /**
     * Handle market movement alert
     */
    handleMarketMovement(data) {
        const { matchup, oddsMovement, newOdds, notification } = data;

        console.log(`💹 Market movement: ${newOdds} (${oddsMovement})`);

        this.showNotification({
            title: '💹 Market Movement',
            body: notification,
            icon: '💰',
            tag: `market-${data.pickId}`,
            data: data,
            priority: 'high'
        });

        if (data.sound && this.soundEnabled) {
            this.playNotificationSound('market-alert');
        }

        this.emit('market:movement', data);
    }

    /**
     * Handle injury alert
     */
    handleInjuryAlert(data) {
        const { injuredPlayer, status, notification } = data;

        console.log(`🏥 Injury: ${injuredPlayer} - ${status}`);

        this.showNotification({
            title: '⚠️ Injury Alert',
            body: notification,
            icon: '🏥',
            tag: `injury-${data.pickId}`,
            data: data,
            priority: data.urgent ? 'high' : 'normal',
            badge: 1
        });

        if (data.sound && this.soundEnabled) {
            this.playNotificationSound('injury-alert');
        }

        this.emit('injury:alert', data);
    }

    /**
     * Handle game status update
     */
    handleGameStatus(data) {
        const { matchup, status, score } = data;

        console.log(`🎮 ${matchup} - ${status}: ${score}`);

        if (status === 'IN_PROGRESS' || status === 'FINAL') {
            this.showNotification({
                title: `🎮 Game ${status}`,
                body: `${matchup} - ${score}`,
                icon: '🎮',
                tag: `game-${data.pickId}`,
                data: data
            });

            this.emit('game:status', data);
        }
    }

    /**
     * Show browser notification
     */
    async showNotification(options) {
        try {
            // Check if notifications are supported
            if (!('Notification' in window)) {
                console.warn('Notifications not supported');
                return;
            }

            // Request permission if needed
            if (Notification.permission === 'denied') {
                return;
            }

            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;
            }

            // Show notification
            const notification = new Notification(options.title, {
                body: options.body,
                icon: options.icon || '🎯',
                tag: options.tag,
                badge: 'https://img.icons8.com/color/96/000000/sports.png',
                requireInteraction: options.priority === 'high'
            });

            // Click handler
            notification.onclick = () => {
                window.focus();
                notification.close();
                this.emit('notification:clicked', options.data);
            };

        } catch (error) {
            console.error('Notification error:', error);
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound(type = 'default') {
        try {
            // Use Web Audio API to generate sound or play from URL
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different sounds for different events
            const sounds = {
                'pick-created': { freq: 800, duration: 0.2 },
                'pick-win': { freq: 1000, duration: 0.3 },
                'pick-loss': { freq: 400, duration: 0.4 },
                'market-alert': { freq: 600, duration: 0.15 },
                'injury-alert': { freq: 300, duration: 0.5 }
            };

            const sound = sounds[type] || sounds['default'] || { freq: 800, duration: 0.2 };

            oscillator.frequency.value = sound.freq;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + sound.duration);

        } catch (error) {
            console.warn('Could not play sound:', error);
        }
    }

    /**
     * Update badge count (for PWA)
     */
    async updateBadge() {
        try {
            if ('setAppBadge' in navigator) {
                const count = this.notificationQueue.length + 1;
                await navigator.setAppBadge(count);
            }
        } catch (error) {
            console.warn('Could not update badge:', error);
        }
    }

    /**
     * Clear badge
     */
    async clearBadge() {
        try {
            if ('clearAppBadge' in navigator) {
                await navigator.clearAppBadge();
            }
        } catch (error) {
            console.warn('Could not clear badge:', error);
        }
    }

    /**
     * Enable/disable sounds
     */
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        console.log(`🔊 Notification sounds ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Enable/disable badges
     */
    setBadgeEnabled(enabled) {
        this.badgeEnabled = enabled;
    }

    /**
     * Get subscription status
     */
    getSubscriptions() {
        return Array.from(this.subscriptions);
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
            console.log('🔌 Picks WebSocket disconnected');
        }
    }

    /**
     * Check connection status
     */
    isReady() {
        return this.isConnected && this.socket && this.socket.connected;
    }
}

// Export for use
export default PicksNotificationClient;
