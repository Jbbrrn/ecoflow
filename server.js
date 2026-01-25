require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Initialize Vite middleware for React app (no build needed)
async function setupVite() {
    try {
        const { createServer } = await import('vite');
        const vite = await createServer({
            server: { 
                middlewareMode: true,
                hmr: false // Disable HMR in production
            },
            appType: 'spa',
            root: process.cwd()
        });
        
        // Read index.html template
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        
        // Serve static files from public folder (before Vite middleware)
        app.use(express.static('public'));
        
        // Use Vite's middleware to handle React app requests
        app.use(vite.middlewares);
        
        // Serve index.html for all non-API routes (SPA fallback)
        app.get('*', async (req, res, next) => {
            // Skip API routes and health check
            if (req.path.startsWith('/api/') || req.path === '/health') {
                return next();
            }
            
            try {
                const url = req.originalUrl;
                const transformedHtml = await vite.transformIndexHtml(url, template);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(transformedHtml);
            } catch (e) {
                vite.ssrFixStacktrace(e);
                next(e);
            }
        });
        
        console.log('Vite middleware initialized - serving React app without build');
        return vite;
    } catch (error) {
        console.error('Failed to initialize Vite:', error);
        // Fallback: try to serve from dist if it exists
        app.use(express.static('public'));
        app.use(express.static('dist'));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api/') || req.path === '/health') return next();
            res.sendFile('index.html', { root: 'dist' }, (err) => {
                if (err) {
                    res.status(503).send('React app not available. Please ensure Vite dependencies are installed.');
                }
            });
        });
        return null;
    }
}

// Server Start - Initialize Vite, then start server
setupVite().then((vite) => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        if (vite) {
            console.log(`React app: http://localhost:${PORT}/ (served via Vite middleware - no build needed)`);
        } else {
            console.log(`React app: http://localhost:${PORT}/ (fallback mode)`);
        }
        
        // Initialize database connection after server starts
        initializeDatabase().catch((error) => {
            console.error('Database initialization failed, but server is running:', error.message);
            console.log('Server will continue running. Database operations may fail until connection is established.');
        });
    });
}).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});