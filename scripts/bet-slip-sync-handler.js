/**
 * WebSocket Handler: Bet Slip Synchronization
 * Manages real-time bet slip sync across user devices
 * Features: Broadcast, conflict resolution, history, device tracking
 */

const userConnections = new Map(); // userId -> Set of connections
const deviceRegistry = new Map(); // deviceId -> device info

class BetSlipSyncHandler {
    constructor() {
        this.userSlipHistory = new Map(); // userId -> change history
        this.maxHistoryPerUser = 500;
        this.conflictLog = new Map(); // Track conflicts for debugging
    }

    /**
     * Handle incoming bet slip sync message
     */
    handleSync(ws, data, userId) {
        try {
            if (!userId || !data.deviceId) {
                this.sendError(ws, 'Missing userId or deviceId');
                return;
            }

            // Register device
            this.registerDevice(userId, data.deviceId, data.deviceName, ws);

            // Validate sync data
            if (!this.validateSync(data)) {
                this.sendError(ws, 'Invalid sync data');
                return;
            }

            // Record change history
            this.recordHistory(userId, data);

            // Broadcast to other devices
            this.broadcastToOtherDevices(userId, data);

            // Send confirmation
            this.sendConfirmation(ws, data);

            console.log(`✅ Bet slip synced from ${data.deviceName} (${data.deviceId})`);

        } catch (error) {
            console.error('❌ Error handling sync:', error);
            this.sendError(ws, error.message);
        }
    }

    /**
     * Handle device registration
     */
    registerDevice(userId, deviceId, deviceName, ws) {
        // Track connection
        if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(ws);

        // Record device info
        deviceRegistry.set(deviceId, {
            userId,
            deviceName,
            connectedAt: Date.now(),
            lastSync: Date.now()
        });

        // Notify user of device
        console.log(`📱 Device registered: ${deviceName}`);
    }

    /**
     * Validate sync message
     */
    validateSync(data) {
        if (!data.changes || !Array.isArray(data.changes)) {
            console.warn('Invalid changes array');
            return false;
        }

        if (!data.slip || !Array.isArray(data.slip)) {
            console.warn('Invalid slip array');
            return false;
        }

        if (!data.timestamp || typeof data.timestamp !== 'number') {
            console.warn('Invalid timestamp');
            return false;
        }

        return true;
    }

    /**
     * Record change history for user
     */
    recordHistory(userId, data) {
        if (!this.userSlipHistory.has(userId)) {
            this.userSlipHistory.set(userId, []);
        }

        const history = this.userSlipHistory.get(userId);

        const record = {
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            changes: data.changes,
            slipSize: data.slip.length,
            timestamp: data.timestamp,
            isOfflineFlush: data.isOfflineFlush || false
        };

        history.push(record);

        // Bound history
        if (history.length > this.maxHistoryPerUser) {
            history.shift();
        }

        // Check for conflicts
        this.detectConflicts(userId, record);
    }

    /**
     * Detect potential conflicts
     */
    detectConflicts(userId, currentRecord) {
        const history = this.userSlipHistory.get(userId) || [];
        
        if (history.length < 2) return;

        const previous = history[history.length - 2];
        if (!previous) return;

        // Check for conflicting changes to same picks
        const currentPickIds = new Set(currentRecord.changes.map(c => c.pickId));
        const previousPickIds = new Set(previous.changes.map(c => c.pickId));

        const conflicts = [];
        for (const pickId of currentPickIds) {
            if (previousPickIds.has(pickId)) {
                conflicts.push(pickId);
            }
        }

        if (conflicts.length > 0 && currentRecord.deviceId !== previous.deviceId) {
            const conflictRecord = {
                userId,
                timestamp: Date.now(),
                devices: [previous.deviceId, currentRecord.deviceId],
                conflictingPicks: conflicts,
                resolved: 'timestamp' // Automatically resolved by timestamp
            };

            if (!this.conflictLog.has(userId)) {
                this.conflictLog.set(userId, []);
            }

            this.conflictLog.get(userId).push(conflictRecord);

            console.log(`⚠️ Potential conflict detected for picks: ${conflicts.join(', ')}`);
        }
    }

    /**
     * Broadcast sync to other devices
     */
    broadcastToOtherDevices(userId, data) {
        const connections = userConnections.get(userId);
        if (!connections || connections.size === 0) {
            return;
        }

        const message = {
            type: 'bet_slip_sync',
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            changes: data.changes,
            slip: data.slip,
            timestamp: data.timestamp,
            version: data.version,
            fromDevice: true
        };

        let broadcastCount = 0;

        for (const connection of connections) {
            // Don't send back to originating device
            if (connection.userId === userId && connection.deviceId !== data.deviceId) {
                try {
                    connection.send(JSON.stringify(message));
                    broadcastCount++;
                } catch (error) {
                    console.error('Error broadcasting to device:', error);
                }
            }
        }

        console.log(`📡 Broadcasted to ${broadcastCount} other device(s)`);
    }

    /**
     * Send confirmation
     */
    sendConfirmation(ws, data) {
        const confirmation = {
            type: 'bet_slip_sync_confirmation',
            deviceId: data.deviceId,
            timestamp: Date.now(),
            syncTimestamp: data.timestamp,
            status: 'success',
            message: 'Bet slip synced successfully'
        };

        try {
            ws.send(JSON.stringify(confirmation));
        } catch (error) {
            console.error('Error sending confirmation:', error);
        }
    }

    /**
     * Send error
     */
    sendError(ws, message) {
        const error = {
            type: 'bet_slip_sync_error',
            status: 'error',
            message,
            timestamp: Date.now()
        };

        try {
            ws.send(JSON.stringify(error));
        } catch (e) {
            console.error('Error sending error message:', e);
        }
    }

    /**
     * Get user's sync history
     */
    getUserHistory(userId, limit = 50) {
        const history = this.userSlipHistory.get(userId) || [];
        return history.slice(-limit);
    }

    /**
     * Get conflict log
     */
    getConflictLog(userId, limit = 50) {
        const conflicts = this.conflictLog.get(userId) || [];
        return conflicts.slice(-limit);
    }

    /**
     * Get user devices
     */
    getUserDevices(userId) {
        const devices = [];
        
        for (const [deviceId, info] of deviceRegistry) {
            if (info.userId === userId) {
                devices.push({
                    deviceId,
                    deviceName: info.deviceName,
                    connectedAt: info.connectedAt,
                    lastSync: info.lastSync,
                    isOnline: this.isDeviceOnline(deviceId)
                });
            }
        }

        return devices;
    }

    /**
     * Check if device is online
     */
    isDeviceOnline(deviceId) {
        const info = deviceRegistry.get(deviceId);
        if (!info) return false;

        // Consider online if last sync was within 2 minutes
        const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
        return info.lastSync > twoMinutesAgo;
    }

    /**
     * Handle device disconnection
     */
    handleDisconnect(ws, userId, deviceId) {
        console.log(`📱 Device disconnected: ${deviceId}`);

        // Remove connection
        const connections = userConnections.get(userId);
        if (connections) {
            connections.delete(ws);
            
            if (connections.size === 0) {
                userConnections.delete(userId);
            }
        }

        // Update device registry
        const info = deviceRegistry.get(deviceId);
        if (info) {
            info.disconnectedAt = Date.now();
        }
    }

    /**
     * Merge multiple slip versions (for conflict resolution)
     */
    mergeSlips(slips) {
        const merged = new Map();

        // Process each slip in order
        for (const slip of slips) {
            for (const pick of slip) {
                const existing = merged.get(pick.id);
                
                if (!existing) {
                    merged.set(pick.id, pick);
                } else {
                    // Merge logic: keep most recent
                    if (pick.updatedAt > existing.updatedAt) {
                        merged.set(pick.id, pick);
                    }
                }
            }
        }

        return Array.from(merged.values());
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            totalUsers: userConnections.size,
            totalDevices: deviceRegistry.size,
            totalHistoryRecords: Array.from(this.userSlipHistory.values())
                .reduce((sum, arr) => sum + arr.length, 0),
            conflictRecords: Array.from(this.conflictLog.values())
                .reduce((sum, arr) => sum + arr.length, 0)
        };
    }
}

// Export handler
module.exports = new BetSlipSyncHandler();
