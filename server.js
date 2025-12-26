require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');
const { PORT } = require('./config/constants');

// Import routes
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const commandRoutes = require('./routes/commands');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/commands', commandRoutes);

// Default root route -> redirect to login page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Server Start - Start server first, then initialize database
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Access login page: http://localhost:${PORT}/login.html`);
    
    // Initialize database connection after server starts
    initializeDatabase().catch((error) => {
        console.error('Database initialization failed, but server is running:', error.message);
        console.log('Server will continue running. Database operations may fail until connection is established.');
    });
});