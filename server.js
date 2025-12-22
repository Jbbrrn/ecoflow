require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');
const { PORT } = require('./config/constants');

// Import routes
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize database connection
initializeDatabase();

// Routes
app.use('/api', authRoutes);
app.use('/api/data', dataRoutes);

// Server Start
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Access login page: http://localhost:${PORT}/login.html`);
});
