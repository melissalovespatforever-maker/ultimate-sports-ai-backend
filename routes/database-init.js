// ============================================
// DATABASE INITIALIZATION ROUTES
// Auto-creates all tables needed for the app
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

console.log('📍 Loading Database Init routes...');

// ============================================
// ENDPOINT 1: Initialize Database
// ============================================

/**
 * POST /api/admin/init-database
 * Creates all necessary tables in the database
 */
router.post('/init-database', async (req, res) => {
    try {
        console.log('🔄 Starting database initialization...');
        
        const results = {
            games: false,
            picks: false,
            coaches: false,
            users: false,
            ai_coaches: false,
            bets: false
        };

        // 1. Create Games Table
        try {
            console.log('📊 Creating games table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS games (
                    id SERIAL PRIMARY KEY,
                    sport VARCHAR(50) NOT NULL,
                    away_team VARCHAR(255) NOT NULL,
                    home_team VARCHAR(255) NOT NULL,
                    away_team_abbr VARCHAR(10),
                    home_team_abbr VARCHAR(10),
                    away_score INT,
                    home_score INT,
                    status VARCHAR(50),
                    game_time TIMESTAMP,
                    venue VARCHAR(255),
                    spread DECIMAL(10,2),
                    total DECIMAL(10,2),
                    espn_id VARCHAR(255) UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create index for performance
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_games_sport_status 
                ON games(sport, status)
            `);
            
            results.games = true;
            console.log('✅ Games table created');
        } catch (error) {
            console.warn('⚠️  Games table error:', error.message);
            results.games = false;
        }

        // 2. Create Picks Table
        try {
            console.log('📊 Creating picks table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS picks (
                    id SERIAL PRIMARY KEY,
                    coach_id INT,
                    game_id INT,
                    pick_details VARCHAR(255),
                    bet_type VARCHAR(50),
                    confidence INT,
                    odds VARCHAR(10),
                    stake INT,
                    status VARCHAR(50),
                    reasoning TEXT,
                    game_time VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
                )
            `);
            
            results.picks = true;
            console.log('✅ Picks table created');
        } catch (error) {
            console.warn('⚠️  Picks table error:', error.message);
            results.picks = false;
        }

        // 3. Create Coaches Table
        try {
            console.log('📊 Creating coaches table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS coaches (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    sport VARCHAR(100),
                    accuracy INT,
                    streak INT,
                    catchphrase TEXT,
                    avatar VARCHAR(500),
                    color VARCHAR(50),
                    strengths TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            results.coaches = true;
            console.log('✅ Coaches table created');
        } catch (error) {
            console.warn('⚠️  Coaches table error:', error.message);
            results.coaches = false;
        }

        // 4. Create AI Coaches Table
        try {
            console.log('📊 Creating ai_coaches table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ai_coaches (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    sport VARCHAR(100),
                    accuracy INT,
                    streak INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            results.ai_coaches = true;
            console.log('✅ AI Coaches table created');
        } catch (error) {
            console.warn('⚠️  AI Coaches table error:', error.message);
            results.ai_coaches = false;
        }

        // 5. Create Bets Table
        try {
            console.log('📊 Creating bets table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS bets (
                    id SERIAL PRIMARY KEY,
                    user_id INT,
                    sport VARCHAR(50),
                    match_desc VARCHAR(255),
                    pick_details VARCHAR(255),
                    odds VARCHAR(10),
                    stake DECIMAL(10,2),
                    potential_win DECIMAL(10,2),
                    coach_name VARCHAR(255),
                    confidence INT,
                    status VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            results.bets = true;
            console.log('✅ Bets table created');
        } catch (error) {
            console.warn('⚠️  Bets table error:', error.message);
            results.bets = false;
        }

        // 6. Create Users Table (if not exists)
        try {
            console.log('📊 Creating users table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE,
                    email VARCHAR(255) UNIQUE,
                    password_hash VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            results.users = true;
            console.log('✅ Users table created');
        } catch (error) {
            console.warn('⚠️  Users table error:', error.message);
            results.users = false;
        }

        // Success response
        const successCount = Object.values(results).filter(v => v).length;
        const totalTables = Object.keys(results).length;

        console.log(`✅ Database initialization complete: ${successCount}/${totalTables} tables`);

        res.json({
            success: true,
            message: 'Database initialization completed',
            results: results,
            summary: `${successCount}/${totalTables} tables created successfully`
        });

    } catch (error) {
        console.error('❌ Database initialization error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Failed to initialize database'
        });
    }
});

// ============================================
// ENDPOINT 2: Get Database Status
// ============================================

/**
 * GET /api/admin/database-status
 * Check which tables exist
 */
router.get('/database-status', async (req, res) => {
    try {
        const tables = ['games', 'picks', 'coaches', 'users', 'ai_coaches', 'bets'];
        const status = {};

        for (const table of tables) {
            try {
                const result = await pool.query(`
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_name = $1
                    )
                `, [table]);
                
                status[table] = result.rows[0].exists;
            } catch (e) {
                status[table] = false;
            }
        }

        // Count total records in games table if it exists
        let gameCount = 0;
        if (status.games) {
            try {
                const gameResult = await pool.query('SELECT COUNT(*) as count FROM games');
                gameCount = parseInt(gameResult.rows[0].count);
            } catch (e) {
                gameCount = 0;
            }
        }

        res.json({
            success: true,
            tables: status,
            gameCount: gameCount,
            allTablesCreated: Object.values(status).every(v => v)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ENDPOINT 3: Clear All Data (DEBUG ONLY)
// ============================================

/**
 * DELETE /api/admin/clear-data
 * WARNING: Deletes all data from all tables (debug only)
 */
router.delete('/clear-data', async (req, res) => {
    try {
        console.log('🗑️  Clearing all data from tables...');
        
        // Delete in order of dependencies
        await pool.query('DELETE FROM picks WHERE id IS NOT NULL');
        await pool.query('DELETE FROM bets WHERE id IS NOT NULL');
        await pool.query('DELETE FROM games WHERE id IS NOT NULL');
        
        console.log('✅ All data cleared');

        res.json({
            success: true,
            message: 'All data cleared successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ESPN SCORES ENDPOINTS
// ============================================

/**
 * GET /api/scores/sync
 * Fetches ESPN data and populates games table
 */
router.get('/scores/sync', async (req, res) => {
    try {
        console.log('🔄 Starting ESPN data sync...');
        
        const sports = ['nfl', 'nba', 'nhl', 'mlb', 'soccer'];
        const results = {};
        
        for (const sport of sports) {
            try {
                const games = await fetchESPNData(sport);
                const stored = await storeGamesInDB(sport, games);
                results[sport] = {
                    fetched: games.length,
                    stored: stored
                };
                console.log(`✅ ${sport.toUpperCase()}: ${stored} games stored`);
            } catch (error) {
                console.error(`❌ Error processing ${sport}:`, error.message);
                results[sport] = { error: error.message };
            }
        }
        
        res.json({
            success: true,
            message: 'ESPN data sync completed',
            results
        });
    } catch (error) {
        console.error('❌ Sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/scores/:sport
 * Returns games for a specific sport
 */
router.get('/scores/:sport', async (req, res) => {
    try {
        const { sport } = req.params;
        
        const validSports = ['nfl', 'nba', 'nhl', 'mlb', 'soccer'];
        if (!validSports.includes(sport.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid sport'
            });
        }
        
        const result = await pool.query(`
            SELECT * FROM games 
            WHERE LOWER(sport) = $1
            ORDER BY game_time DESC
            LIMIT 50
        `, [sport.toLowerCase()]);
        
        res.json({
            success: true,
            sport: sport.toLowerCase(),
            games: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/scores/health
 * Check if games table is healthy
 */
router.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as total FROM games');
        
        res.json({
            success: true,
            message: 'Games table is healthy',
            totalGames: parseInt(result.rows[0].total)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Games table not found or error',
            details: error.message
        });
    }
});

// ============================================
// SCHEDULER STATUS ENDPOINT
// ============================================

/**
 * GET /api/admin/scheduler-status
 * Check ESPN scheduler status and statistics
 */
router.get('/scheduler-status', (req, res) => {
    try {
        const espnScheduler = require('../services/espn-scheduler');
        const status = espnScheduler.getSchedulerStatus();
        
        res.json({
            success: true,
            scheduler: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Unable to get scheduler status',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/scheduler-reset
 * Reset scheduler statistics
 */
router.post('/scheduler-reset', (req, res) => {
    try {
        const espnScheduler = require('../services/espn-scheduler');
        espnScheduler.resetStats();
        
        res.json({
            success: true,
            message: 'Scheduler stats reset successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Unable to reset scheduler stats',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/scheduler-start
 * Manually start ESPN scheduler
 */
router.post('/scheduler-start', async (req, res) => {
    try {
        const espnScheduler = require('../services/espn-scheduler');
        const result = await espnScheduler.startESPNScheduler();
        
        res.json({
            success: true,
            message: 'ESPN Scheduler started successfully',
            running: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Unable to start scheduler',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/scheduler-stop
 * Manually stop ESPN scheduler
 */
router.post('/scheduler-stop', (req, res) => {
    try {
        const espnScheduler = require('../services/espn-scheduler');
        espnScheduler.stopESPNScheduler();
        
        res.json({
            success: true,
            message: 'ESPN Scheduler stopped successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Unable to stop scheduler',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/scheduler-manual-sync
 * Manually trigger ESPN data sync
 */
router.post('/scheduler-manual-sync', async (req, res) => {
    try {
        const espnScheduler = require('../services/espn-scheduler');
        await espnScheduler.performESPNSync();
        
        res.json({
            success: true,
            message: 'Manual ESPN sync completed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Unable to perform manual sync',
            details: error.message
        });
    }
});

// ============================================
// ESPN FETCHING HELPER FUNCTIONS
// ============================================

async function fetchESPNData(sport) {
    const endpoint = getESPNEndpoint(sport);
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(endpoint, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || !data.events) return [];
        
        return parseESPNEvents(data.events, sport);
    } catch (error) {
        console.error(`ESPN fetch error for ${sport}:`, error.message);
        return [];
    }
}

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
            console.warn(`Error storing game ${game.espn_id}:`, error.message);
        }
    }
    
    return stored;
}

module.exports = router;
console.log('✅ Database Init routes loaded');