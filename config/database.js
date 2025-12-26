const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ecoflow',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

let pool;

async function initializeDatabase() {
    try {
        pool = await mysql.createPool(DB_CONFIG);
        console.log('Database pool connected successfully.');
        return pool;
    } catch (error) {
        console.error('Failed to connect to database:', error.message);
        // Don't exit process - let server continue running
        // The server will retry on next request or can be restarted
        throw error;
    }
}

function getPool() {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializeDatabase() first.');
    }
    return pool;
}

module.exports = {
    initializeDatabase,
    getPool
};

