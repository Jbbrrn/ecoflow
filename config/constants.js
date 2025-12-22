require('dotenv').config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET || 'YOUR_FALLBACK_SECRET_KEY_ECOFLOW',
    DEVICE_API_KEY: process.env.DEVICE_API_KEY || 'YOUR_RPi_SECRET_KEY_123',
    SALT_ROUNDS: 10,
    PORT: process.env.PORT || 3000
};

