const jwt = require('jsonwebtoken');
const { JWT_SECRET, DEVICE_API_KEY, SERVICE_API_KEY } = require('../config/constants');

/**
 * Middleware function to verify JWT token and attach user payload to the request.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) {
        return res.status(401).json({ message: 'Authentication failed. Token required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token is invalid or expired.' });
        }
        req.user = user;
        next();
    });
}

/**
 * Middleware function to check if the authenticated user has the 'admin' role.
 */
function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access Denied. Administrator privileges required.' });
    }
    next();
}

/**
 * Middleware function to check for a pre-shared API key sent in the header (used by RPi).
 */
function authenticateDevice(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (apiKey !== DEVICE_API_KEY) {
        console.warn(`Unauthorized data ingestion attempt from IP: ${req.ip}`);
        return res.status(401).json({ message: 'Device authorization failed. Invalid API Key.' });
    }
    next();
}

/**
 * Middleware function to authenticate using SERVICE_API_KEY (for automation services like n8n).
 * Checks for x-service-api-key header.
 */
function authenticateService(req, res, next) {
    const apiKey = req.headers['x-service-api-key'];
    
    if (apiKey !== SERVICE_API_KEY) {
        console.warn(`Unauthorized service API attempt from IP: ${req.ip}`);
        return res.status(401).json({ message: 'Service authorization failed. Invalid Service API Key.' });
    }
    
    // Attach a service account user object for compatibility
    req.user = {
        user_id: 0,
        role: 'gardener',
        service_account: true
    };
    next();
}

/**
 * Middleware that accepts either JWT token OR service API key.
 * Useful for endpoints that should work with both user authentication and service accounts.
 */
function authenticateTokenOrService(req, res, next) {
    // First try service API key (for automation)
    const serviceApiKey = req.headers['x-service-api-key'];
    if (serviceApiKey === SERVICE_API_KEY) {
        req.user = {
            user_id: 0,
            role: 'gardener',
            service_account: true
        };
        return next();
    }
    
    // Fall back to JWT token (for regular users)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) {
        return res.status(401).json({ message: 'Authentication failed. Token or Service API Key required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token is invalid or expired.' });
        }
        req.user = user;
        next();
    });
}

module.exports = {
    authenticateToken,
    authorizeAdmin,
    authenticateDevice,
    authenticateService,
    authenticateTokenOrService
};

