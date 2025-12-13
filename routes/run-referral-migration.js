// ============================================
// AUTO-MIGRATION ENDPOINT - REFERRAL SYSTEM
// Visit this URL in browser to create tables
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

router.get('/', async (req, res) => {
    try {
        console.log('🚀 Starting referral system migration...');

        // Create referrals table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referrals (
                id SERIAL PRIMARY KEY,
                referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                referee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code_used VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                coins_earned INTEGER DEFAULT 0,
                xp_earned INTEGER DEFAULT 0,
                first_pick_at TIMESTAMP,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(referee_id)
            );
        `);

        console.log('✅ Created referrals table');

        // Create referral_rewards table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_rewards (
                id SERIAL PRIMARY KEY,
                referral_id INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
                reward_type VARCHAR(50) NOT NULL,
                coins INTEGER DEFAULT 0,
                xp INTEGER DEFAULT 0,
                bonus_days INTEGER DEFAULT 0,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Created referral_rewards table');

        // Create referral_milestones table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_milestones (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                milestone INTEGER NOT NULL,
                coins_earned INTEGER DEFAULT 0,
                achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, milestone)
            );
        `);

        console.log('✅ Created referral_milestones table');

        // Create referral_events table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Created referral_events table');

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral ON referral_rewards(referral_id);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_referral_events_user ON referral_events(user_id);
        `);

        console.log('✅ Created all indexes');

        // Add referral_code column to users if it doesn't exist
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
        `);

        console.log('✅ Added referral_code to users table');

        // Success response with nice HTML
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Migration Complete! ✅</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 40px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    }
                    h1 { font-size: 3rem; margin: 0 0 20px 0; }
                    .emoji { font-size: 5rem; }
                    .success { color: #10b981; font-size: 1.5rem; font-weight: bold; }
                    .tables { 
                        background: rgba(0,0,0,0.2);
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-family: monospace;
                    }
                    .table-item {
                        padding: 8px 0;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="emoji">🎉</div>
                    <h1>Migration Complete!</h1>
                    <p class="success">✅ Referral system tables created successfully</p>
                    
                    <div class="tables">
                        <h3>Tables Created:</h3>
                        <div class="table-item">✓ referrals</div>
                        <div class="table-item">✓ referral_rewards</div>
                        <div class="table-item">✓ referral_milestones</div>
                        <div class="table-item">✓ referral_events</div>
                        <div class="table-item">✓ 5 indexes created</div>
                        <div class="table-item">✓ users.referral_code column added</div>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        <strong>🚀 Your referral system is ready to use!</strong><br>
                        You can now close this page and test the referral features.
                    </p>
                </div>
            </body>
            </html>
        `);

        console.log('🎉 Referral system migration completed!');

    } catch (error) {
        console.error('❌ Migration error:', error);
        
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Migration Error</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: #dc2626;
                        color: white;
                    }
                    .card {
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 20px;
                        padding: 40px;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>❌ Migration Failed</h1>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>Check Railway logs for more details.</p>
                </div>
            </body>
            </html>
        `);
    }
});

module.exports = router;
