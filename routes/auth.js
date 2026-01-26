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
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ message: 'Invalid role specified. Must be "admin" or "user".' });
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
    
    // 'email' parameter can be either username or email
    const identifier = email;

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    try {
        const pool = getPool();
        // Check both email and username fields
        const [users] = await pool.execute(
            `SELECT user_id, username, password_hash, user_role, is_active FROM users 
             WHERE email = ? OR username = ?`,
            [identifier, identifier]
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
 * Body: { service_api_key: string, user_id?: number, role?: 'admin' | 'user' }
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
            // Generate a service account token with default user permissions
            // You can modify this to use a specific service account user_id
            tokenPayload = {
                user_id: 0, // Service account ID
                role: 'user', // Default role for service accounts
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

/**
 * GET /api/users
 * Get all users (Admin only)
 */
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const [users] = await pool.execute(
            `SELECT user_id, username, email, user_role, is_active, created_at 
             FROM users 
             ORDER BY created_at DESC`
        );
        
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal server error while fetching users.' });
    }
});

/**
 * PUT /api/users/:id
 * Update a user (Admin only)
 * Body: { name?, email?, role?, is_active?, password? }
 */
router.put('/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, role, is_active, password } = req.body;
    
    try {
        const pool = getPool();
        
        // Check if user exists
        const [existingUsers] = await pool.execute(
            `SELECT user_id FROM users WHERE user_id = ?`,
            [id]
        );
        
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Build update query dynamically
        const updates = [];
        const params = [];
        
        if (name !== undefined) {
            updates.push('username = ?');
            params.push(name);
        }
        
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email);
        }
        
        if (role !== undefined) {
            if (role !== 'admin' && role !== 'user') {
                return res.status(400).json({ message: 'Invalid role specified. Must be "admin" or "user".' });
            }
            updates.push('user_role = ?');
            params.push(role);
        }
        
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        
        if (password !== undefined && password !== '') {
            const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push('password_hash = ?');
            params.push(password_hash);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update.' });
        }
        
        params.push(id);
        
        await pool.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
            params
        );
        
        console.log(`User ${id} updated by Admin (ID: ${req.user.user_id})`);
        res.status(200).json({ message: 'User updated successfully.' });
        
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already in use.' });
        }
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal server error while updating user.' });
    }
});

/**
 * DELETE /api/users/:id
 * Delete a user (Admin only)
 * Note: Soft delete by setting is_active = 0, or hard delete
 */
router.delete('/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    
    // Prevent deleting yourself
    if (parseInt(id) === req.user.user_id) {
        return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    
    try {
        const pool = getPool();
        
        // Check if user exists
        const [existingUsers] = await pool.execute(
            `SELECT user_id FROM users WHERE user_id = ?`,
            [id]
        );
        
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Soft delete: set is_active = 0
        await pool.execute(
            `UPDATE users SET is_active = 0 WHERE user_id = ?`,
            [id]
        );
        
        console.log(`User ${id} deactivated by Admin (ID: ${req.user.user_id})`);
        res.status(200).json({ message: 'User deactivated successfully.' });
        
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal server error while deleting user.' });
    }
});

module.exports = router;

