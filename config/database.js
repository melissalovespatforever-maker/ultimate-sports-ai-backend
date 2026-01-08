// ============================================
// DATABASE CONFIGURATION
// PostgreSQL connection and query utilities
// ============================================

const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
// Supports both DATABASE_URL (Railway/Production) and individual variables (Local)
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'ultimate_sports_ai',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        }
);

// Test connection
pool.on('connect', () => {
    console.log('✅ Database connected');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// Query helper
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Executed query', { text, duration, rows: res.rowCount });
        }
        
        return res;
    } catch (error) {
        console.error('❌ Query error:', error);
        throw error;
    }
};

// Transaction helper
const transaction = async (callback) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Batch insert helper
const batchInsert = async (table, columns, values) => {
    if (!values || values.length === 0) return;
    
    const placeholders = values.map((_, i) => {
        const row = columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ');
        return `(${row})`;
    }).join(', ');
    
    const flatValues = values.flat();
    const text = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    
    return query(text, flatValues);
};

module.exports = {
    pool,
    query,
    transaction,
    batchInsert
};
