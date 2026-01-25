require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');
const { PORT } = require('./config/constants');

// Import routes
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const commandRoutes = require('./routes/commands');
const reportRoutes = require('./routes/reports');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first
app.use('/api', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/reports', reportRoutes);

// React SPA routes - serve index.html for client-side routing
const spaPaths = ['/', '/login.html', '/gardener-dashboard', '/admin-dashboard', '/admin_dashboard.html', '/gardener_dashboard.html'];
app.get(spaPaths, (req, res) => {
    res.sendFile('index.html', { root: 'dist' }, (err) => {
        if (err) {
            if (req.path === '/login.html') {
                res.status(503).send('React app not built. Run: npm run build');
            } else {
                res.redirect('/login.html');
            }
        }
    });
});

// Static: React build (assets), then legacy public as fallback
app.use(express.static('dist'));
app.use(express.static('public'));

// SPA catch-all: unknown paths → index.html (Express 5: use /{*splat})
app.get('/{*splat}', (req, res, next) => {
    // Skip catch-all for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile('index.html', { root: 'dist' }, (err) => {
        if (err) res.redirect('/login.html');
    });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Server Start - Start server first, then initialize database
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`React app: http://localhost:${PORT}/  (or use Vite dev server: npm run dev)`);
    
    // Initialize database connection after server starts
    initializeDatabase().catch((error) => {
        console.error('Database initialization failed, but server is running:', error.message);
        console.log('Server will continue running. Database operations may fail until connection is established.');
    });
});