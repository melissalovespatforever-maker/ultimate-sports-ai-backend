// ============================================
// AUTO-RUN REFERRAL MIGRATION
// Visit this route in browser to run migration
// ============================================

const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runReferralMigration() {
    console.log('🚀 Starting referral system migration...');
    
    try {
        // Read migration file
        const migrationPath = path.join(__dirname, '../migrations/010_referral_system.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📖 Migration file loaded');
        
        // Execute migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration executed successfully!');
        
        // Verify tables created
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('referrals', 'referral_events', 'coin_transactions', 'referral_milestones')
            ORDER BY table_name
        `);
        
        console.log('✅ Tables verified:', tableCheck.rows.map(r => r.table_name));
        
        return {
            success: true,
            message: 'Referral migration completed successfully!',
            tables: tableCheck.rows.map(r => r.table_name)
        };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

module.exports = { runReferralMigration };
