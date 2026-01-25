require('dotenv').config();


if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required! Set it in .env file or environment variables.');
}

if (!process.env.DEVICE_API_KEY) {
    throw new Error('DEVICE_API_KEY environment variable is required! Set it in .env file or environment variables.');
}

if (!process.env.SERVICE_API_KEY) {
    throw new Error('SERVICE_API_KEY environment variable is required! Set it in .env file or environment variables.');
}

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    DEVICE_API_KEY: process.env.DEVICE_API_KEY,
    SERVICE_API_KEY: process.env.SERVICE_API_KEY,
    SALT_ROUNDS: 10,
    PORT: process.env.PORT || 5000
};