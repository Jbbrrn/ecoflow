const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { authenticateToken, authenticateDevice, authenticateTokenOrService } = require('../middleware/auth');

/**
 * POST /api/data/ingest
 * Receive sensor data from RPi device
 */
router.post('/ingest', authenticateDevice, async (req, res) => {
    const { 
        temperature, 
        humidity,    
        soil1,       
        soil2,       
        soil3,       
        lowLevel,    
        highLevel,   
        valve,       
        pump,
        timestamp    
    } = req.body;
    
    const device_id = req.headers['x-device-id'] || 'RPi_1';

    // Basic Input Validation
    if (typeof temperature === 'undefined' || 
        typeof soil1 === 'undefined' || 
        typeof soil2 === 'undefined' || 
        typeof soil3 === 'undefined') {
         return res.status(400).json({ message: 'Missing required sensor data (temperature, soil1, soil2, or soil3).' });
    }

    try {
        const pool = getPool();
        // Use timestamp from body if provided, otherwise use NOW()
        let timestampValue = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        // Validate timestamp: ensure it doesn't exceed current system time
        const currentTime = new Date();
        const providedTime = timestamp ? new Date(timestamp) : currentTime;
        
        if (providedTime > currentTime) {
            console.warn(`Future timestamp detected: ${timestamp}. Using current time instead.`);
            timestampValue = currentTime.toISOString().slice(0, 19).replace('T', ' ');
        }
        
        const [result] = await pool.execute(
            `INSERT INTO sensor_data 
             (device_id, timestamp, soil_moisture_1_percent, soil_moisture_2_percent, soil_moisture_3_percent, 
              air_temperature_celsius, air_humidity_percent, 
              valve_status, pump_status, water_level_low_status, water_level_high_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                device_id,
                timestampValue,
                soil1,           
                soil2,           
                soil3,           
                temperature,    
                humidity,       
                valve,          
                pump,           
                lowLevel,       
                highLevel       
            ]
        );
        
        console.log(`Data ingested successfully for ${device_id}. Temp: ${temperature}°C, Soil: ${soil1}%, ${soil2}%, ${soil3}%`);
        
        res.status(202).json({ 
            message: 'Data accepted and stored.', 
            recordId: result.insertId 
        });

    } catch (error) {
        console.error('Data Ingestion Error:', error);
        res.status(500).json({ message: 'Internal server error during data storage.' });
    }
});

/**
 * GET /api/data/latest
 * Get the most recent sensor data reading
 * Accepts either JWT token (Authorization header) or Service API Key (x-service-api-key header)
 */
router.get('/latest', authenticateTokenOrService, async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute(
            `SELECT 
                timestamp,
                soil_moisture_1_percent, 
                soil_moisture_2_percent, 
                soil_moisture_3_percent, 
                air_temperature_celsius, 
                air_humidity_percent, 
                valve_status, 
                pump_status,
                water_level_low_status,
                water_level_high_status
             FROM sensor_data 
             WHERE timestamp <= NOW()
             AND timestamp <= UTC_TIMESTAMP()
             ORDER BY timestamp DESC 
             LIMIT 1`
        );
        
        // Additional client-side validation to ensure no future timestamps
        if (rows.length > 0) {
            const now = new Date();
            const rowTime = new Date(rows[0].timestamp);
            if (rowTime > now) {
                // If the latest row is in the future, return empty result
                return res.status(404).json({ message: 'No valid sensor data found.' });
            }
        }

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No sensor data found.' });
        }

        res.status(200).json(rows[0]);

    } catch (error) {
        console.error('Error fetching latest sensor data:', error);
        res.status(500).json({ message: 'Internal server error while fetching data.' });
    }
});

 /**
 * GET /api/data/history
 * Get historical sensor data for charts
 * Query params: hours (default: 24) - number of hours of history to retrieve
 * Accepts either JWT token (Authorization header) or Service API Key (x-service-api-key header)
 */
router.get('/history', authenticateTokenOrService, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const pool = getPool();
        
        const [rows] = await pool.execute(
            `SELECT 
                timestamp,
                soil_moisture_1_percent, 
                soil_moisture_2_percent, 
                soil_moisture_3_percent, 
                air_temperature_celsius, 
                air_humidity_percent, 
                valve_status, 
                pump_status,
                water_level_low_status,
                water_level_high_status
             FROM sensor_data 
             WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
             AND timestamp <= NOW()
             AND timestamp <= UTC_TIMESTAMP()
             ORDER BY timestamp ASC`
        , [hours]);
        
        // Additional server-side filtering to ensure no future timestamps
        const now = new Date();
        const filteredRows = rows.filter(row => {
            const rowTime = new Date(row.timestamp);
            return rowTime <= now;
        });
        
        res.status(200).json(filteredRows);

        res.status(200).json(rows);

    } catch (error) {
        console.error('Error fetching historical sensor data:', error);
        res.status(500).json({ message: 'Internal server error while fetching historical data.' });
    }
});

module.exports = router;

