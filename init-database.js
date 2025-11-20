// ============================================
// DATABASE INITIALIZATION SCRIPT
// Run this to setup your database
// ============================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create connection
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'ultimate_sports_ai',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
        }
);

async function initDatabase() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗄️  Ultimate Sports AI - Database Setup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    try {
        // Test connection
        console.log('📡 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected successfully!');
        console.log('');

        // Run schema
        console.log('📋 Creating database schema...');
        const schemaSQL = fs.readFileSync(
            path.join(__dirname, '../database/schema.sql'),
            'utf8'
        );
        await pool.query(schemaSQL);
        console.log('✅ Schema created successfully!');
        console.log('');

        // Run seed data
        console.log('🌱 Seeding initial data...');
        const seedSQL = fs.readFileSync(
            path.join(__dirname, '../database/seed.sql'),
            'utf8'
        );
        await pool.query(seedSQL);
        console.log('✅ Data seeded successfully!');
        console.log('');

        // Get counts
        const achievements = await pool.query('SELECT COUNT(*) FROM achievements');
        const challenges = await pool.query('SELECT COUNT(*) FROM challenges');
        const shopItems = await pool.query('SELECT COUNT(*) FROM shop_items');
        const users = await pool.query('SELECT COUNT(*) FROM users');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ DATABASE SETUP COMPLETE!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📊 Summary:');
        console.log(`   • Achievements: ${achievements.rows[0].count}`);
        console.log(`   • Challenges: ${challenges.rows[0].count}`);
        console.log(`   • Shop Items: ${shopItems.rows[0].count}`);
        console.log(`   • Users: ${users.rows[0].count}`);
        console.log('');
        console.log('🔑 Admin Credentials:');
        console.log('   Email: admin@sportsai.com');
        console.log('   Password: admin123');
        console.log('');
        console.log('⚠️  IMPORTANT: Change admin password in production!');
        console.log('');
        console.log('🚀 You can now start your backend server:');
        console.log('   npm start');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('❌ Error initializing database:', error);
        console.error('');
        console.error('💡 Troubleshooting:');
        console.error('   1. Check your DATABASE_URL or DB_* variables');
        console.error('   2. Make sure PostgreSQL is running');
        console.error('   3. Verify database permissions');
        console.error('   4. Check if database already exists (drop and recreate if needed)');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run it
initDatabase();
