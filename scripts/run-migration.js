// ============================================
// Run AI Coaches Migration
// Execute: node scripts/run-migration.js
// ============================================

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting AI Coaches Migration...\n');
        
        // Read migration file
        const migrationPath = path.join(__dirname, '../migrations/003_ai_coaches_performance.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📖 Migration file loaded');
        console.log('💾 Executing SQL...\n');
        
        // Execute migration
        await client.query(migration);
        
        console.log('✅ Migration completed successfully!\n');
        
        // Verify
        console.log('🔍 Verifying coaches table...');
        const result = await client.query('SELECT id, name, tier FROM coaches ORDER BY id');
        
        console.log(`\n✅ Found ${result.rows.length} coaches:\n`);
        result.rows.forEach(coach => {
            console.log(`   ${coach.id}. ${coach.name} (${coach.tier})`);
        });
        
        // Check stats
        console.log('\n🔍 Verifying coach_stats table...');
        const statsResult = await client.query('SELECT coach_id, accuracy, total_picks FROM coach_stats ORDER BY coach_id');
        console.log(`✅ Found ${statsResult.rows.length} coach stats\n`);
        
        console.log('🎉 All tables created and populated!\n');
        console.log('📊 Sample stats:');
        statsResult.rows.slice(0, 3).forEach(stat => {
            console.log(`   Coach ${stat.coach_id}: ${stat.accuracy}% accuracy, ${stat.total_picks} total picks`);
        });
        
        console.log('\n✨ Migration complete! Your coaches are ready to go! 🚀\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run it
runMigration();
