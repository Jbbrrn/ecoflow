const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { JWT_SECRET, SALT_ROUNDS, SERVICE_API_KEY } = require('../config/constants');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

/**
 * POST /api/register
 * Register a new user (Admin only)
 */
router.post('/register', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields (Name, Email, Password, Role) are required.' });
    }
    if (role !== 'admin' && role !== 'gardener') {
        return res.status(400).json({ message: 'Invalid role specified. Must be "admin" or "gardener".' });
    }

    try {
        const pool = getPool();
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        
        const [result] = await pool.execute(
            `INSERT INTO users (username, email, password_hash, user_role) VALUES (?, ?, ?, ?)`,
            [name, email, password_hash, role]
        );
        
        console.log(`New user registered by Admin (ID: ${req.user.user_id}): ID ${result.insertId}, Email: ${email}`);
        res.status(201).json({ 
            message: 'User registered successfully.', 
            userId: result.insertId 
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already in use. Registration failed.' });
        }
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

/**
 * POST /api/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const pool = getPool();
        const [users] = await pool.execute(
            `SELECT user_id, username, password_hash, user_role, is_active FROM users WHERE email = ?`,
            [email]
        );

        const user = users[0];

        if (!user || !user.is_active) {
            return res.status(401).json({ message: 'Invalid credentials or user is inactive.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { user_id: user.user_id, role: user.user_role }, 
            JWT_SECRET, 
            { expiresIn: '1d' } 
        );
        
        res.status(200).json({
            message: 'Login successful.',
            token: token,
            username: user.username,
            userRole: user.user_role
        });

    } catch (error) {
        console.error('Login Error:', error);
        // Check if it's a database connection error
        if (error.message && error.message.includes('Database pool not initialized')) {
            return res.status(503).json({ 
                message: 'Database connection not available. Please check your database configuration and ensure the database server is running.' 
            });
        }
        // Ensure we always send valid JSON
        res.status(500).json({ 
            message: 'Internal server error during login.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/auth/service-token
 * Generate a JWT token for service accounts (e.g., n8n workflows)
 * Uses SERVICE_API_KEY for authentication instead of user credentials
 * Body: { service_api_key: string, user_id?: number, role?: 'admin' | 'gardener' }
 * If user_id and role are provided, generates token for that user
 * Otherwise, generates a service account token with default permissions
 */
router.post('/service-token', async (req, res) => {
    const { service_api_key, user_id, role } = req.body;

    // Verify service API key
    if (!service_api_key || service_api_key !== SERVICE_API_KEY) {
        return res.status(401).json({ message: 'Invalid service API key.' });
    }

    try {
        const pool = getPool();
        let tokenPayload;

        // If user_id and role are provided, verify user exists and generate token for that user
        if (user_id && role) {
            const [users] = await pool.execute(
                `SELECT user_id, user_role, is_active FROM users WHERE user_id = ? AND user_role = ?`,
                [user_id, role]
            );

            if (users.length === 0) {
                return res.status(404).json({ message: 'User not found or role mismatch.' });
            }

            const user = users[0];
            if (!user.is_active) {
                return res.status(403).json({ message: 'User account is inactive.' });
            }

            tokenPayload = {
                user_id: user.user_id,
                role: user.user_role
            };
        } else {
            // Generate a service account token with default gardener permissions
            // You can modify this to use a specific service account user_id
            tokenPayload = {
                user_id: 0, // Service account ID
                role: 'gardener', // Default role for service accounts
                service_account: true
            };
        }

        const token = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { expiresIn: '30d' } // Longer expiration for service accounts
        );

        res.status(200).json({
            message: 'Service token generated successfully.',
            token: token,
            expiresIn: '30d'
        });

    } catch (error) {
        console.error('Service Token Generation Error:', error);
        res.status(500).json({ message: 'Internal server error during token generation.' });
    }
});

module.exports = router;

