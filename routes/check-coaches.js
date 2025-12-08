// ============================================
// CHECK COACHES DATABASE STATUS
// Simple endpoint to verify tables and data
// ============================================

const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { pool } = require('../config/database');
        
        // Test connection
        await pool.query('SELECT NOW()');
        
        const results = {
            connection: '✅ Connected',
            tables: {},
            usingFallback: false
        };
        
        // Check if coaches table exists
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('coaches', 'coach_stats', 'coach_picks')
        `);
        
        results.tables = tableCheck.rows.map(r => r.table_name);
        
        if (results.tables.length === 0) {
            results.usingFallback = true;
            results.message = '⚠️ No tables found - using fallback data';
        } else {
            // Get sample data
            const coachCount = await pool.query('SELECT COUNT(*) FROM coaches');
            const statsCount = await pool.query('SELECT COUNT(*) FROM coach_stats');
            const picksCount = await pool.query('SELECT COUNT(*) FROM coach_picks');
            
            // Get a sample coach
            const sample = await pool.query(`
                SELECT c.name, c.avatar, s.accuracy, s.total_picks, s.current_streak
                FROM coaches c
                JOIN coach_stats s ON c.id = s.coach_id
                LIMIT 1
            `);
            
            results.counts = {
                coaches: parseInt(coachCount.rows[0].count),
                stats: parseInt(statsCount.rows[0].count),
                picks: parseInt(picksCount.rows[0].count)
            };
            
            results.sample = sample.rows[0];
            results.message = '✅ Tables exist with data!';
        }
        
        res.json(results);
        
    } catch (error) {
        res.json({
            connection: '❌ Failed',
            error: error.message,
            usingFallback: true,
            message: '⚠️ Database error - coaches using fallback data'
        });
    }
});

module.exports = router;
