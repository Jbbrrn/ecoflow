const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { JWT_SECRET, SALT_ROUNDS } = require('../config/constants');
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
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

module.exports = router;

