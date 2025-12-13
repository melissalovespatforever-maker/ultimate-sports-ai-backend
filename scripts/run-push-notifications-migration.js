/**
 * Push Notifications Migration Runner
 * Adds push notification support tables to the database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting push notifications migration...\n');
        
        // Read migration SQL file
        const migrationPath = path.join(__dirname, '../migrations/009_push_notifications.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📖 Executing migration SQL...');
        
        // Execute migration within a transaction
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        
        console.log('✅ Migration executed successfully!\n');
        
        // Verify tables were created
        console.log('🔍 Verifying tables...');
        
        const tables = [
            'push_notification_devices',
            'web_push_subscriptions',
            'notification_preferences',
            'push_notification_log'
        ];
        
        for (const table of tables) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [table]);
            
            if (result.rows[0].exists) {
                console.log(`  ✅ ${table}`);
            } else {
                console.log(`  ❌ ${table} - FAILED TO CREATE`);
            }
        }
        
        console.log('\n🔍 Verifying functions...');
        
        const functions = [
            'cleanup_inactive_devices',
            'get_user_notification_channels'
        ];
        
        for (const func of functions) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_proc 
                    WHERE proname = $1
                )
            `, [func]);
            
            if (result.rows[0].exists) {
                console.log(`  ✅ ${func}()`);
            } else {
                console.log(`  ❌ ${func}() - FAILED TO CREATE`);
            }
        }
        
        // Count default preferences created
        const prefsCount = await client.query(`
            SELECT COUNT(*) as count FROM notification_preferences
        `);
        
        console.log(`\n📊 Statistics:`);
        console.log(`  - Default notification preferences created: ${prefsCount.rows[0].count}`);
        
        console.log('\n✅ Push notifications migration completed successfully!');
        console.log('\n📱 Next steps:');
        console.log('  1. Install Capacitor plugins:');
        console.log('     npm install @capacitor/push-notifications @capacitor/local-notifications @capacitor/app');
        console.log('  2. Run: npx cap sync');
        console.log('  3. Configure APNs (iOS) and FCM (Android)');
        console.log('  4. Test notifications on device\n');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
