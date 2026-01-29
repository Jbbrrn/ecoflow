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
const { sendCriticalMoistureAlert, sendSprinklerActivationNotification } = require('./services/emailService');

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

// Test endpoints for email notifications
app.post('/api/test-email/critical-moisture', async (req, res) => {
    try {
        console.log('[TEST] Critical moisture email test requested');
        
        // Create test sensor data with critical moisture levels
        const testSensorData = {
            soil_moisture_1_percent: 15, // Critical: < 20%
            soil_moisture_2_percent: 18, // Critical: < 20%
            soil_moisture_3_percent: 12, // Critical: < 20%
            air_temperature_celsius: 25.5,
            air_humidity_percent: 65,
            timestamp: new Date()
        };
        
        const result = await sendCriticalMoistureAlert(testSensorData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Critical moisture alert email sent successfully',
                details: {
                    recipients: result.recipients,
                    messageId: result.messageId
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send critical moisture alert email',
                error: result.message || result.error
            });
        }
    } catch (error) {
        console.error('[TEST] Error sending critical moisture test email:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending test email',
            error: error.message
        });
    }
});

app.post('/api/test-email/pump-activation', async (req, res) => {
    try {
        console.log('[TEST] Pump activation email test requested');
        
        // Get optional parameters from request body
        const { username } = req.body;
        const requestedBy = username || 'Test User';
        
        // Create test command data
        const testCommandData = {
            device: 'pump',
            desired_state: 'ON',
            status: 'SUCCESS'
        };
        
        const result = await sendSprinklerActivationNotification(testCommandData, requestedBy);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Pump activation notification email sent successfully',
                details: {
                    recipients: result.recipients,
                    messageId: result.messageId,
                    requestedBy: requestedBy
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send pump activation notification email',
                error: result.message || result.error
            });
        }
    } catch (error) {
        console.error('[TEST] Error sending pump activation test email:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending test email',
            error: error.message
        });
    }
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