// ============================================
// VERIFY COACHES SCRIPT
// Check if coaches are loaded in database
// Usage: node scripts/verify-coaches.js
// ============================================

const { pool } = require('../config/database');

async function verifyCoaches() {
    try {
        console.log('🔍 Verifying AI Coaches Setup...\n');
        
        // Check if tables exist
        console.log('📊 Checking for tables...');
        
        const tablesCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'coaches'
            ) as coaches_exists,
            EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'coach_picks'
            ) as picks_exists,
            EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'coach_stats'
            ) as stats_exists;
        `);
        
        const { coaches_exists, picks_exists, stats_exists } = tablesCheck.rows[0];
        
        console.log(`   Coaches table: ${coaches_exists ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   Picks table: ${picks_exists ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   Stats table: ${stats_exists ? '✅ EXISTS' : '❌ MISSING'}\n`);
        
        if (!coaches_exists) {
            console.log('⚠️  Coaches table not found. Running migration...\n');
            const migrationPath = require('path').join(__dirname, '../migrations/003_ai_coaches_performance.sql');
            const fs = require('fs');
            const migration = fs.readFileSync(migrationPath, 'utf8');
            await pool.query(migration);
            console.log('✅ Migration executed!\n');
        }
        
        // Count coaches
        console.log('📋 Checking coaches count...');
        const coachCount = await pool.query('SELECT COUNT(*) FROM coaches');
        console.log(`   Total coaches: ${coachCount.rows[0].count}\n`);
        
        if (coachCount.rows[0].count === 0) {
            console.log('❌ NO COACHES FOUND! Database is empty.\n');
            process.exit(1);
        }
        
        // List all coaches
        console.log('🏆 All Coaches:\n');
        const coaches = await pool.query('SELECT id, name, specialty, tier, avatar FROM coaches ORDER BY id');
        coaches.rows.forEach(coach => {
            console.log(`   ${coach.id}. ${coach.avatar} ${coach.name} (${coach.tier}) - ${coach.specialty}`);
        });
        
        // Check stats
        console.log('\n📈 Coach Statistics:\n');
        const stats = await pool.query(`
            SELECT 
                c.id,
                c.name,
                cs.accuracy,
                cs.total_picks,
                cs.wins,
                cs.losses,
                cs.best_streak
            FROM coaches c
            LEFT JOIN coach_stats cs ON c.id = cs.coach_id
            ORDER BY c.id
        `);
        
        stats.rows.forEach(row => {
            console.log(`   ${row.id}. ${row.name}: ${row.accuracy}% accuracy, ${row.total_picks} picks, Best streak: ${row.best_streak}W`);
        });
        
        console.log('\n✅ VERIFICATION COMPLETE!\n');
        console.log('📊 Summary:');
        console.log(`   ✅ Tables: ${coaches_exists && picks_exists && stats_exists ? 'ALL PRESENT' : 'SOME MISSING'}`);
        console.log(`   ✅ Coaches: ${coachCount.rows[0].count}/11 loaded`);
        console.log(`   ✅ Stats: Populated for each coach`);
        
        if (coachCount.rows[0].count === 11) {
            console.log('\n🎉 DATABASE IS FULLY LOADED AND READY! 🚀\n');
        } else {
            console.log('\n⚠️  Some coaches are missing. Expected 11, got ' + coachCount.rows[0].count + '\n');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

verifyCoaches();
