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
const chatbotRoutes = require('./routes/chatbot');

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
app.use('/api', chatbotRoutes);

// Health check endpoint for Render (must work immediately)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Serve static files: dist folder first (React build), then public folder (legacy files)
app.use(express.static('dist', { index: false })); // Don't serve index.html automatically
app.use(express.static('public'));

// SPA route handler - serve index.html for React routes (if needed)
// This must come AFTER static middleware so assets are served first
app.use((req, res, next) => {
    // Skip API routes and health check
    if (req.path.startsWith('/api/') || 
        req.path === '/health') {
        return next();
    }
    
    // Skip file requests with extensions (assets like .js, .css, .png, etc.)
    // These should have been handled by static middleware
    if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
        return next();
    }
    
    // Skip static HTML files in public folder (like login.html, admin_dashboard.html, etc.)
    // These should be served by static middleware, not React app
    if (req.path.endsWith('.html')) {
        return next();
    }
    
    // Serve index.html from dist folder for React SPA routing
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    // Check if dist/index.html exists before trying to serve it
    if (!fs.existsSync(indexPath)) {
        console.error(`[SPA Handler] dist/index.html not found at ${indexPath}`);
        console.error(`[SPA Handler] Current directory: ${__dirname}`);
        console.error(`[SPA Handler] Dist folder exists: ${fs.existsSync(path.join(__dirname, 'dist'))}`);
        return res.status(503).send(`
            <html>
                <head><title>Build Required</title></head>
                <body>
                    <h1>React app not built</h1>
                    <p>The dist folder or index.html is missing. Please ensure the build completed successfully.</p>
                    <p>Expected path: ${indexPath}</p>
                </body>
            </html>
        `);
    }
    
    // Read and verify the file content
    try {
        const fileContent = fs.readFileSync(indexPath, 'utf-8');
        if (!fileContent || fileContent.trim().length === 0) {
            console.error(`[SPA Handler] dist/index.html is empty`);
            return res.status(503).send('<html><body><h1>Error: dist/index.html is empty</h1></body></html>');
        }
        
        if (!fileContent.includes('<script')) {
            console.warn(`[SPA Handler] dist/index.html might not have script tags - content preview: ${fileContent.substring(0, 200)}`);
        }
    } catch (readErr) {
        console.error(`[SPA Handler] Error reading dist/index.html:`, readErr.message);
        return res.status(503).send(`<html><body><h1>Error reading file: ${readErr.message}</h1></body></html>`);
    }
    
    // Set proper content type
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('[SPA Handler] Error serving dist/index.html:', err.message);
            console.error('[SPA Handler] Error details:', err);
            res.status(503).send(`
                <html>
                    <head><title>Error</title></head>
                    <body>
                        <h1>Error serving React app</h1>
                        <p>${err.message}</p>
                        <p>Path: ${indexPath}</p>
                    </body>
                </html>
            `);
        }
    });
});

// Start server
try {
    const server = app.listen(PORT, () => {
        console.log(`✓ Server is running on port ${PORT}`);
        console.log(`✓ Health check: http://localhost:${PORT}/health`);
        
        // Check if dist folder exists
        const distPath = path.resolve(__dirname, 'dist');
        const indexPath = path.join(distPath, 'index.html');
        
        if (fs.existsSync(distPath)) {
            console.log(`✓ React app: http://localhost:${PORT}/ (serving from dist folder)`);
            
            // Check if index.html exists in dist
            if (fs.existsSync(indexPath)) {
                const indexContent = fs.readFileSync(indexPath, 'utf-8');
                console.log(`✓ Found dist/index.html (${indexContent.length} bytes)`);
                
                // Check if it has script tags (Vite should have transformed it)
                if (indexContent.includes('<script')) {
                    console.log(`✓ index.html contains script tags`);
                } else {
                    console.warn(`⚠ index.html might not have script tags - build may be incomplete`);
                }
            } else {
                console.warn(`⚠ dist/index.html not found`);
            }
        } else {
            console.warn(`⚠ React app: dist folder not found. Run: npm run build`);
            console.warn(`   For development, use: npm run dev`);
        }
        
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