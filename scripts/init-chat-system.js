/**
 * Initialize Chat System
 * Run this script to set up the chat database table
 * 
 * Usage: node scripts/init-chat-system.js
 */

const { query } = require('../config/database');

async function initChatSystem() {
    console.log('🚀 Initializing Chat System...\n');

    try {
        // Create chat_messages table
        console.log('📦 Creating chat_messages table...');
        await query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER,
                username VARCHAR(100) NOT NULL,
                avatar VARCHAR(20) DEFAULT '🎮',
                message TEXT NOT NULL,
                channel VARCHAR(50) DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ chat_messages table created');

        // Create indexes for performance
        console.log('📊 Creating indexes...');
        await query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_channel 
            ON chat_messages(channel, created_at DESC);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_user 
            ON chat_messages(user_id);
        `);
        console.log('✅ Indexes created');

        // Insert welcome message
        console.log('💬 Adding welcome message...');
        await query(`
            INSERT INTO chat_messages (user_id, username, avatar, message, channel)
            VALUES (0, 'System', '🤖', 'Welcome to Sports Lounge Chat! Be respectful and have fun! 🎮', 'general')
            ON CONFLICT DO NOTHING;
        `);
        console.log('✅ Welcome message added');

        // Verify setup
        const count = await query('SELECT COUNT(*) FROM chat_messages');
        console.log(`\n📊 Total messages in database: ${count.rows[0].count}`);

        console.log('\n✅ Chat System initialized successfully!\n');
        console.log('Next steps:');
        console.log('1. Start your backend server');
        console.log('2. Open Sports Lounge');
        console.log('3. Messages will appear in real-time!\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error initializing chat system:', error);
        console.error('\nTroubleshooting:');
        console.error('- Check DATABASE_URL in .env');
        console.error('- Ensure PostgreSQL is running');
        console.error('- Verify database connection\n');
        process.exit(1);
    }
}

// Run initialization
initChatSystem();
