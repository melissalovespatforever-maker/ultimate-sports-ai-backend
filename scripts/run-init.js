#!/usr/bin/env node

/**
 * Database Initialization Script
 * Reads and executes init-coaches.sql
 * Run with: node scripts/run-init.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    try {
        console.log('🔍 Starting database initialization...');
        console.log('📍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
        
        // Test connection
        console.log('🔗 Testing database connection...');
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful at:', testResult.rows[0].now);
        
        // Read SQL file
        const sqlPath = path.join(__dirname, 'init-coaches.sql');
        console.log('📄 Reading SQL file from:', sqlPath);
        
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL file not found at ${sqlPath}`);
        }
        
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('📖 SQL file loaded successfully');
        
        // Split statements and execute
        const statements = sql.split(';').filter(s => s.trim());
        console.log(`⚙️  Found ${statements.length} SQL statements to execute`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
                await pool.query(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            }
        }
        
        // Verify tables were created
        console.log('\n🔍 Verifying database structure...');
        
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('\n📊 Tables in database:');
        tables.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });
        
        // Verify coaches data
        const coachCount = await pool.query('SELECT COUNT(*) as count FROM coaches');
        console.log(`\n🏆 Coaches in database: ${coachCount.rows[0].count}`);
        
        const coaches = await pool.query('SELECT id, name, tier FROM coaches ORDER BY id');
        console.log('\n📋 Coaches list:');
        coaches.rows.forEach(coach => {
            console.log(`   ${coach.id}. ${coach.name} (${coach.tier})`);
        });
        
        // Verify coach stats
        const statsCount = await pool.query('SELECT COUNT(*) as count FROM coach_stats');
        console.log(`\n📈 Coach stats records: ${statsCount.rows[0].count}`);
        
        console.log('\n✨ Database initialization completed successfully! 🎉');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
    } catch (error) {
        console.error('\n❌ Database initialization failed:');
        console.error('Error:', error.message);
        console.error('\nDebug info:');
        console.error('  - DATABASE_URL set:', !!process.env.DATABASE_URL);
        console.error('  - NODE_ENV:', process.env.NODE_ENV);
        if (error.code) console.error('  - Error code:', error.code);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('✅ Database connection closed');
    }
}

// Run initialization
initializeDatabase();
