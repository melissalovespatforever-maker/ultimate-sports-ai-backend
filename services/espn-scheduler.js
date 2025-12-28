// ============================================
// ESPN DATA AUTO-REFRESH SCHEDULER
// Continuously syncs ESPN data every 30 seconds
// ============================================

const axios = require('axios');
const { pool } = require('../config/database');

console.log('📍 Loading ESPN Scheduler...');

let schedulerRunning = false;
let lastSyncTime = null;
let syncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncStatus: 'Not started',
    gamesUpdated: 0,
    sports: {
        nfl: { games: 0, lastSync: null },
        nba: { games: 0, lastSync: null },
        nhl: { games: 0, lastSync: null },
        mlb: { games: 0, lastSync: null },
        soccer: { games: 0, lastSync: null }
    }
};

/**
 * Start the ESPN scheduler
 * Syncs data every 30 seconds
 */
async function startESPNScheduler() {
    if (schedulerRunning) {
        console.log('⚠️  ESPN Scheduler is already running');
        return;
    }

    console.log('🚀 Starting ESPN Auto-Refresh Scheduler...');
    schedulerRunning = true;

    // Initial sync immediately
    console.log('📊 Running initial ESPN data sync...');
    await performESPNSync();

    // Then schedule recurring syncs every 30 seconds
    setInterval(() => {
        performESPNSync();
    }, 30000); // 30 seconds

    console.log('✅ ESPN Scheduler started (30 second interval)');
    return true;
}

/**
 * Perform ESPN data sync
 */
async function performESPNSync() {
    try {
        lastSyncTime = new Date();
        const sports = ['nfl', 'nba', 'nhl', 'mlb', 'soccer'];
        const results = {};
        let totalUpdated = 0;

        // Log sync start
        const syncStartTime = new Date();
        console.log(`\n⏰ [${syncStartTime.toLocaleTimeString()}] 🔄 ESPN Sync Starting...`);

        // Sync each sport in parallel
        const syncPromises = sports.map(sport => 
            syncSportData(sport).catch(error => {
                console.error(`❌ Error syncing ${sport}:`, error.message);
                return { sport, games: 0, error: error.message };
            })
        );

        const syncResults = await Promise.all(syncPromises);

        // Process results
        for (const result of syncResults) {
            results[result.sport] = result.games;
            totalUpdated += result.games || 0;

            // Update stats
            if (result.games !== undefined) {
                syncStats.sports[result.sport] = {
                    games: result.games,
                    lastSync: new Date()
                };
            }
        }

        syncStats.totalSyncs++;
        syncStats.successfulSyncs++;
        syncStats.gamesUpdated = totalUpdated;
        syncStats.lastSyncStatus = 'Success';

        const syncEndTime = new Date();
        const syncDuration = syncEndTime - syncStartTime;

        console.log(`✅ Sync Complete (${syncDuration}ms)`);
        console.log(`   📊 Total games updated: ${totalUpdated}`);
        console.log(`   • NFL: ${results.nfl || 0} games`);
        console.log(`   • NBA: ${results.nba || 0} games`);
        console.log(`   • NHL: ${results.nhl || 0} games`);
        console.log(`   • MLB: ${results.mlb || 0} games`);
        console.log(`   • Soccer: ${results.soccer || 0} games\n`);

    } catch (error) {
        syncStats.failedSyncs++;
        syncStats.lastSyncStatus = `Failed: ${error.message}`;
        console.error(`❌ ESPN Sync Error:`, error.message);
    }
}

/**
 * Sync data for a specific sport
 */
async function syncSportData(sport) {
    try {
        const games = await fetchESPNData(sport);
        const stored = await storeGamesInDB(sport, games);
        return { sport, games: stored };
    } catch (error) {
        console.error(`❌ Error in syncSportData for ${sport}:`, error.message);
        return { sport, games: 0, error: error.message };
    }
}

/**
 * Fetch ESPN data for a sport
 */
async function fetchESPNData(sport) {
    const endpoint = getESPNEndpoint(sport);

    try {
        const response = await axios.get(endpoint, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.data || !response.data.events) return [];

        return parseESPNEvents(response.data.events, sport);
    } catch (error) {
        console.warn(`⚠️  ESPN fetch warning for ${sport}:`, error.message);
        return [];
    }
}

/**
 * Get ESPN endpoint for sport
 */
function getESPNEndpoint(sport) {
    const endpoints = {
        nfl: 'https://www.espn.com/api/site/v2/sports/football/nfl/scoreboard',
        nba: 'https://www.espn.com/api/site/v2/sports/basketball/nba/scoreboard',
        nhl: 'https://www.espn.com/api/site/v2/sports/hockey/nhl/scoreboard',
        mlb: 'https://www.espn.com/api/site/v2/sports/baseball/mlb/scoreboard',
        soccer: 'https://www.espn.com/api/site/v2/sports/soccer/UEFA.CHAMPIONS/scoreboard'
    };
    return endpoints[sport.toLowerCase()] || endpoints.nfl;
}

/**
 * Parse ESPN events to standard format
 */
function parseESPNEvents(events, sport) {
    return events.map(event => {
        try {
            const competitors = event.competitions?.[0]?.competitors || [];
            const awayTeam = competitors[1] || {};
            const homeTeam = competitors[0] || {};

            return {
                sport: sport.toUpperCase(),
                away_team: awayTeam.displayName || awayTeam.name || 'Away',
                home_team: homeTeam.displayName || homeTeam.name || 'Home',
                away_team_abbr: awayTeam.abbreviation || 'A',
                home_team_abbr: homeTeam.abbreviation || 'H',
                away_score: parseInt(awayTeam.score) || null,
                home_score: parseInt(homeTeam.score) || null,
                status: event.status?.type?.name || 'SCHEDULED',
                game_time: new Date(event.date || new Date()),
                venue: event.competitions?.[0]?.venue?.fullName || 'TBD',
                spread: null,
                total: null,
                espn_id: event.id
            };
        } catch (error) {
            return null;
        }
    }).filter(game => game !== null);
}

/**
 * Store games in database
 */
async function storeGamesInDB(sport, games) {
    if (!games || games.length === 0) return 0;

    let stored = 0;

    for (const game of games) {
        try {
            await pool.query(`
                INSERT INTO games (
                    sport, away_team, home_team, away_team_abbr, home_team_abbr,
                    away_score, home_score, status, game_time, venue, espn_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (espn_id) DO UPDATE SET
                    away_score = EXCLUDED.away_score,
                    home_score = EXCLUDED.home_score,
                    status = EXCLUDED.status,
                    updated_at = NOW()
            `, [
                game.sport,
                game.away_team,
                game.home_team,
                game.away_team_abbr,
                game.home_team_abbr,
                game.away_score,
                game.home_score,
                game.status,
                game.game_time,
                game.venue,
                game.espn_id
            ]);
            stored++;
        } catch (error) {
            console.warn(`⚠️  Error storing game ${game.espn_id}:`, error.message);
        }
    }

    return stored;
}

/**
 * Get scheduler status and stats
 */
function getSchedulerStatus() {
    return {
        running: schedulerRunning,
        lastSyncTime: lastSyncTime,
        stats: syncStats,
        uptime: schedulerRunning ? 'Active' : 'Inactive'
    };
}

/**
 * Stop the scheduler (for graceful shutdown)
 */
function stopESPNScheduler() {
    if (schedulerRunning) {
        console.log('🛑 Stopping ESPN Scheduler...');
        schedulerRunning = false;
        console.log('✅ ESPN Scheduler stopped');
    }
}

/**
 * Reset scheduler stats
 */
function resetStats() {
    syncStats = {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncStatus: 'Not started',
        gamesUpdated: 0,
        sports: {
            nfl: { games: 0, lastSync: null },
            nba: { games: 0, lastSync: null },
            nhl: { games: 0, lastSync: null },
            mlb: { games: 0, lastSync: null },
            soccer: { games: 0, lastSync: null }
        }
    };
    console.log('📊 Scheduler stats reset');
}

module.exports = {
    startESPNScheduler,
    stopESPNScheduler,
    getSchedulerStatus,
    resetStats,
    performESPNSync
};

console.log('✅ ESPN Scheduler loaded');
