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

// Health check endpoint for Render (must work immediately)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Variables for Vite
let viteInstance = null;
let viteInitializing = true;
let viteMiddlewareHandler = null;
let indexTemplate = null;

// Try to read index.html for fallback
try {
    indexTemplate = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
} catch (err) {
    console.warn('Could not read index.html:', err.message);
}

// Vite middleware wrapper - MUST come before static files
// This ensures Vite can transform JSX/TS files before static middleware serves them
app.use(async (req, res, next) => {
    // Skip API routes and health check
    if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
    }
    
    // If Vite middleware is ready, use it to handle the request
    if (viteMiddlewareHandler) {
        return viteMiddlewareHandler(req, res, next);
    }
    
    // If still initializing and it's a source file, wait a bit
    if (viteInitializing && req.path.startsWith('/src/')) {
        const startTime = Date.now();
        while (viteInitializing && (Date.now() - startTime) < 5000) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (viteMiddlewareHandler) {
            return viteMiddlewareHandler(req, res, next);
        }
    }
    
    // Continue to next middleware (static files or SPA handler)
    next();
});

// Serve static files from public folder (after Vite middleware)
app.use(express.static('public'));

// SPA route handler - fallback if Vite doesn't handle it
app.use(async (req, res, next) => {
    // Skip API routes and health check
    if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
    }
    
    // Skip file requests (should have been handled by static or Vite)
    if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
        return next();
    }
    
    // If Vite is available, try to transform HTML
    if (viteInstance) {
        try {
            const url = req.originalUrl;
            const transformedHtml = await viteInstance.transformIndexHtml(url, indexTemplate || '');
            return res.status(200).set({ 'Content-Type': 'text/html' }).end(transformedHtml);
        } catch (e) {
            viteInstance.ssrFixStacktrace(e);
            // Fall through to file-based fallback
        }
    }
    
    // Fallback: try to serve from dist if it exists
    res.sendFile('index.html', { root: 'dist' }, (err) => {
        if (err) {
            // Last resort: serve basic HTML
            if (indexTemplate) {
                res.status(200).set({ 'Content-Type': 'text/html' }).end(indexTemplate);
            } else {
                res.status(503).send('React app is initializing. Please wait a moment and refresh.');
            }
        }
    });
});

// Initialize Vite middleware for React app (no build needed) - async, non-blocking
async function setupVite() {
    try {
        console.log('Initializing Vite middleware...');
        
        // Check if required files exist
        const indexHtmlPath = path.resolve(__dirname, 'index.html');
        const srcMainPath = path.resolve(__dirname, 'src', 'main.jsx');
        
        if (!fs.existsSync(indexHtmlPath)) {
            throw new Error(`index.html not found at ${indexHtmlPath}`);
        }
        
        if (!fs.existsSync(srcMainPath)) {
            throw new Error(`src/main.jsx not found at ${srcMainPath}`);
        }
        
        // Dynamic import of Vite (ESM module)
        let viteModule;
        try {
            viteModule = await import('vite');
        } catch (importError) {
            // Check if it's a module resolution error
            if (importError.code === 'ERR_MODULE_NOT_FOUND' || importError.message.includes('Cannot find module')) {
                throw new Error('Vite package not found. Make sure vite is installed: npm install vite');
            }
            throw importError;
        }
        
        const { createServer } = viteModule;
        
        // Create Vite server with explicit config
        // Vite will automatically load vite.config.js from the root
        const vite = await createServer({
            server: { 
                middlewareMode: true,
                hmr: false, // Disable HMR in production
                // In production middleware mode, allow all hosts (Render, Vercel, etc.)
                // This is safe because we're behind Express which handles security
                allowedHosts: process.env.NODE_ENV === 'production' 
                    ? true  // Allow all hosts in production
                    : ['localhost', '127.0.0.1']
            },
            appType: 'spa',
            root: process.cwd(),
            // Explicitly disable features not needed in middleware mode
            logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
            clearScreen: false
        });
        
        // Create Vite middleware handler - this will be called by the wrapper above
        viteMiddlewareHandler = (req, res, next) => {
            // Skip API routes - let them pass through to API handlers
            if (req.path.startsWith('/api/') || req.path === '/health') {
                return next();
            }
            // Use Vite middleware for everything else (especially /src/ files)
            vite.middlewares(req, res, next);
        };
        
        viteInstance = vite;
        viteInitializing = false;
        console.log('✓ Vite middleware initialized - serving React app without build');
        return vite;
    } catch (error) {
        viteInitializing = false;
        console.error('Failed to initialize Vite:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('not found')) {
            console.error('Make sure all required files exist: index.html, src/main.jsx');
        }
        if (error.message.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
            console.error('Vite dependencies may not be installed. Run: npm install');
        }
        
        if (error.stack && process.env.NODE_ENV !== 'production') {
            console.error('Stack:', error.stack);
        }
        
        console.log('Server will continue with fallback mode (serving from dist if available)');
        return null;
    }
}

// Start server immediately, then initialize Vite in background
try {
    const server = app.listen(PORT, () => {
        console.log(`✓ Server is running on port ${PORT}`);
        console.log(`✓ Health check: http://localhost:${PORT}/health`);
        
        // Initialize Vite in background (non-blocking)
        setupVite().catch((err) => {
            console.error('Vite initialization error (non-fatal):', err.message);
        }).then((vite) => {
            if (vite) {
                console.log(`✓ React app: http://localhost:${PORT}/ (served via Vite middleware - no build needed)`);
            } else {
                console.log(`⚠ React app: http://localhost:${PORT}/ (fallback mode - check if dist folder exists)`);
            }
        });
        
        // Initialize database connection after server starts
        initializeDatabase().catch((error) => {
            console.error('Database initialization failed, but server is running:', error.message);
            console.log('Server will continue running. Database operations may fail until connection is established.');
        });
    });
    
    // Handle server errors
    server.on('error', (error) => {
        console.error('Server error:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use`);
        }
        process.exit(1);
    });
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        // Don't exit - let server continue
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        // Don't exit - let server continue
    });
} catch (error) {
    console.error('Failed to start server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
}