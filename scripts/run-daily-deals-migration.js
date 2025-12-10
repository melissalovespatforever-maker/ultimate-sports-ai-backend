// ============================================
// DAILY DEALS MIGRATION RUNNER
// Run this script to create daily deals tables
// ============================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    try {
        console.log('🚀 Starting Daily Deals Migration...\n');
        
        // Test connection
        console.log('📡 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');
        
        // Read migration file
        const migrationPath = path.join(__dirname, '../migrations/008_daily_deals.sql');
        console.log('📖 Reading migration file:', migrationPath);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        console.log('✅ Migration file loaded\n');
        
        // Execute migration
        console.log('🔧 Running migration...');
        await pool.query(migrationSQL);
        console.log('✅ Migration executed successfully!\n');
        
        // Verify tables created
        console.log('🔍 Verifying tables...');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'daily_deal_purchases',
                'shop_inventory',
                'user_shop_purchases',
                'active_boosters',
                'daily_deal_stock'
            )
            ORDER BY table_name
        `);
        
        console.log('✅ Tables created:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        // Check shop inventory
        const items = await pool.query('SELECT COUNT(*) as count FROM shop_inventory');
        console.log(`\n✅ Shop inventory seeded with ${items.rows[0].count} items`);
        
        // Check deal stock
        const stock = await pool.query('SELECT COUNT(*) as count FROM daily_deal_stock');
        console.log(`✅ Daily deal stock initialized with ${stock.rows[0].count} deals`);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 MIGRATION COMPLETE!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Next steps:');
        console.log('   1. Restart your backend server');
        console.log('   2. Test shop purchases: /api/shop/items');
        console.log('   3. Test daily deals: /api/shop/deals/stock');
        console.log('   4. Visit Sports Lounge > Shop to test frontend\n');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('\nFull error:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration
runMigration();
