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

const RETRYABLE_ERRORS = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNREFUSED'];
const MAX_RETRIES = 3;

async function executeWithRetry(fn) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const isRetryable = RETRYABLE_ERRORS.includes(err.code);
            const hasRetriesLeft = attempt < MAX_RETRIES - 1;
            if (isRetryable && hasRetriesLeft) {
                const delayMs = 300 * (attempt + 1);
                console.warn(`Database connection error (${err.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, delayMs));
                continue;
            }
            throw err;
        }
    }
}

let pool;

async function initializeDatabase() {
    try {
        pool = await mysql.createPool({
            ...DB_CONFIG,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        });
        const originalExecute = pool.execute.bind(pool);
        pool.execute = function (...args) {
            return executeWithRetry(() => originalExecute(...args));
        };
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

