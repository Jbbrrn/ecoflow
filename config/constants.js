require('dotenv').config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET || 'ecoflow_jwt_capstone9fA3Kx!Qm7R2@WZpE8cN',
    DEVICE_API_KEY: process.env.DEVICE_API_KEY || 'group4_thesis_secret54rg79j32k4dsn930ytt26',
    SALT_ROUNDS: 10,
    PORT: process.env.PORT || 3000
};

