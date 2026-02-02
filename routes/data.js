const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { authenticateToken, authenticateDevice, authenticateTokenOrService } = require('../middleware/auth');
const { sendCriticalMoistureAlert } = require('../services/emailService');

/**
 * POST /api/data/ingest
 * Receive sensor data from RPi device
 * UPDATED: Now handles resource_consumption array and total_resources_last_5min
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
        timestamp,
        resource_consumption,      // NEW: Array of resource consumption records
        total_resources_last_5min  // NEW: Summary of last 5 minutes
    } = req.body;
    
    const device_id = req.headers['x-device-id'] || 'RPi_1';

    // Basic Input Validation
    if (typeof temperature === 'undefined' || 
        typeof soil1 === 'undefined' || 
        typeof soil2 === 'undefined' || 
        typeof soil3 === 'undefined') {
         return res.status(400).json({ message: 'Missing required sensor data (temperature, soil1, soil2, or soil3).' });
    }

    // Start database transaction
    const pool = getPool();
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Use timestamp from body if provided, otherwise use NOW()
        let timestampValue = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        // Validate timestamp: ensure it doesn't exceed current system time
        const currentTime = new Date();
        const providedTime = timestamp ? new Date(timestamp) : currentTime;
        
        if (providedTime > currentTime) {
            console.warn(`Future timestamp detected: ${timestamp}. Using current time instead.`);
            timestampValue = currentTime.toISOString().slice(0, 19).replace('T', ' ');
        }
        
        // STEP 1: Insert sensor data
        const [result] = await connection.execute(
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
        
        const sensorDataId = result.insertId;
        let resourceRecordsInserted = 0;
        
        // STEP 2: Insert resource consumption records (if present)
        if (resource_consumption && Array.isArray(resource_consumption) && resource_consumption.length > 0) {
            for (const record of resource_consumption) {
                // Skip records with resource_id = 0 (no consumption)
                if (record.resource_id === 0) {
                    console.log('Skipping resource record with resource_id = 0 (no consumption)');
                    continue;
                }
                
                // Format timestamp for resource consumption
                const resourceTimestamp = record.timestamp || timestampValue;
                
                // Insert resource consumption record
                await connection.execute(
                    `INSERT INTO resource_consumption 
                     (resource_id, sensor_data_id, device_id, timestamp, 
                      pump_runtime_seconds, valve_runtime_seconds, 
                      water_consumed_liters, energy_consumed_kwh, 
                      pump_state, valve_state) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        record.resource_id,
                        sensorDataId,
                        device_id,
                        resourceTimestamp,
                        record.pump_runtime_seconds || 0.0,
                        record.valve_runtime_seconds || 0.0,
                        record.water_consumed_liters || 0.0,
                        record.energy_consumed_kwh || 0.0,
                        record.pump_state || 0,
                        record.valve_state || 0
                    ]
                );
                
                resourceRecordsInserted++;
            }
        }
        
        // Commit transaction
        await connection.commit();
        
        console.log(`Data ingested successfully for ${device_id}. Temp: ${temperature}°C, Soil: ${soil1}%, ${soil2}%, ${soil3}%. Resource records: ${resourceRecordsInserted}`);
        
        // Check for critical moisture levels and send email notification
        const sensorData = {
            timestamp: timestampValue,
            soil_moisture_1_percent: soil1,
            soil_moisture_2_percent: soil2,
            soil_moisture_3_percent: soil3,
            air_temperature_celsius: temperature,
            air_humidity_percent: humidity
        };
        
        // Check if any sensor is critical (< 20%)
        const hasCriticalMoisture = [soil1, soil2, soil3].some(val => val !== null && val < 20);
        
        if (hasCriticalMoisture) {
            // Send email notification asynchronously (don't block the response)
            sendCriticalMoistureAlert(sensorData).catch(error => {
                console.error('Failed to send critical moisture alert email:', error);
            });
        }
        
        res.status(202).json({ 
            success: true,
            message: 'Data accepted and stored.', 
            sensor_data_id: sensorDataId,
            resource_records_inserted: resourceRecordsInserted,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('Data Ingestion Error:', error);
        
        // Check for duplicate resource_id error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ 
                success: false,
                message: 'Duplicate resource_id detected.',
                error: error.message 
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Internal server error during data storage.',
            error: error.message 
        });
    } finally {
        connection.release();
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

    } catch (error) {
        console.error('Error fetching historical sensor data:', error);
        res.status(500).json({ message: 'Internal server error while fetching historical data.' });
    }
});

/**
 * GET /api/data/resource-consumption
 * Get resource consumption data for reports
 * Query params: 
 *   - date (format: YYYY-MM-DD) - specific date to query
 *   - startDate and endDate - date range
 *   - hours (default: 24) - number of hours of history
 * Accepts either JWT token (Authorization header) or Service API Key (x-service-api-key header)
 */
router.get('/resource-consumption', authenticateTokenOrService, async (req, res) => {
    try {
        const pool = getPool();
        const { date, startDate, endDate, hours } = req.query;
        
        let query = '';
        let params = [];
        
        if (date) {
            // Specific date query
            query = `
                SELECT 
                    rc.*,
                    sd.air_temperature_celsius,
                    sd.air_humidity_percent
                FROM resource_consumption rc
                LEFT JOIN sensor_data sd ON rc.sensor_data_id = sd.id
                WHERE DATE(rc.timestamp) = ?
                ORDER BY rc.timestamp DESC
            `;
            params = [date];
        } else if (startDate && endDate) {
            // Date range query
            query = `
                SELECT 
                    rc.*,
                    sd.air_temperature_celsius,
                    sd.air_humidity_percent
                FROM resource_consumption rc
                LEFT JOIN sensor_data sd ON rc.sensor_data_id = sd.id
                WHERE DATE(rc.timestamp) BETWEEN ? AND ?
                ORDER BY rc.timestamp DESC
            `;
            params = [startDate, endDate];
        } else {
            // Hours-based query (default: 24 hours)
            const hoursValue = parseInt(hours) || 24;
            query = `
                SELECT 
                    rc.*,
                    sd.air_temperature_celsius,
                    sd.air_humidity_percent
                FROM resource_consumption rc
                LEFT JOIN sensor_data sd ON rc.sensor_data_id = sd.id
                WHERE rc.timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                ORDER BY rc.timestamp DESC
            `;
            params = [hoursValue];
        }
        
        const [rows] = await pool.execute(query, params);
        
        res.status(200).json(rows);

    } catch (error) {
        console.error('Error fetching resource consumption data:', error);
        res.status(500).json({ message: 'Internal server error while fetching resource consumption data.' });
    }
});

/**
 * GET /api/data/daily-summary
 * Get daily summary including sensor data, resource consumption, and device energy
 * Query params: date (format: YYYY-MM-DD, default: today)
 * Accepts either JWT token (Authorization header) or Service API Key (x-service-api-key header)
 */
router.get('/daily-summary', authenticateTokenOrService, async (req, res) => {
    try {
        const pool = getPool();
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const device_id = req.query.device_id || 'RPi_1';
        
        // Get resource consumption summary
        const [resourceSummary] = await pool.execute(
            `SELECT 
                DATE(timestamp) as report_date,
                COUNT(*) as total_sessions,
                SUM(pump_runtime_seconds) as total_pump_seconds,
                SUM(valve_runtime_seconds) as total_valve_seconds,
                SUM(water_consumed_liters) as total_water_liters,
                SUM(energy_consumed_kwh) as irrigation_energy_kwh,
                AVG(pump_runtime_seconds) as avg_pump_runtime,
                AVG(valve_runtime_seconds) as avg_valve_runtime
             FROM resource_consumption
             WHERE DATE(timestamp) = ?
             AND device_id = ?
             GROUP BY DATE(timestamp)`,
            [date, device_id]
        );
        
        // Get sensor data statistics for the day
        const [sensorStats] = await pool.execute(
            `SELECT 
                COUNT(*) as total_readings,
                AVG(air_temperature_celsius) as avg_temperature,
                MIN(air_temperature_celsius) as min_temperature,
                MAX(air_temperature_celsius) as max_temperature,
                AVG(air_humidity_percent) as avg_humidity,
                AVG(soil_moisture_1_percent) as avg_soil1,
                AVG(soil_moisture_2_percent) as avg_soil2,
                AVG(soil_moisture_3_percent) as avg_soil3,
                MIN(soil_moisture_1_percent) as min_soil1,
                MIN(soil_moisture_2_percent) as min_soil2,
                MIN(soil_moisture_3_percent) as min_soil3
             FROM sensor_data
             WHERE DATE(timestamp) = ?
             AND device_id = ?`,
            [date, device_id]
        );
        
        // Calculate total energy consumption
        // Device energy (RPI + ESP32): 0.1224 kWh/day when system was active (has sensor or resource data)
        const DEVICE_ENERGY_KWH = 0.12 + 0.0024; // 0.1224
        const hasDataForDay = (sensorStats[0]?.total_readings > 0) || (resourceSummary[0]?.total_sessions > 0);
        const deviceEnergy_kwh = hasDataForDay ? DEVICE_ENERGY_KWH : 0;
        const irrigationEnergy = resourceSummary[0]?.irrigation_energy_kwh || 0;
        const totalEnergy = parseFloat(irrigationEnergy) + deviceEnergy_kwh;
        
        res.status(200).json({
            date: date,
            device_id: device_id,
            sensor_statistics: sensorStats[0] || {},
            resource_consumption: resourceSummary[0] || {
                total_sessions: 0,
                total_pump_seconds: 0,
                total_valve_seconds: 0,
                total_water_liters: 0,
                irrigation_energy_kwh: 0
            },
            device_energy: {
                rpi_kwh: 0.12,
                esp32_kwh: 0.0024,
                total_device_kwh: hasDataForDay ? DEVICE_ENERGY_KWH : 0
            },
            total_energy_consumption: {
                irrigation_kwh: irrigationEnergy,
                device_kwh: deviceEnergy_kwh,
                total_kwh: totalEnergy
            }
        });

    } catch (error) {
        console.error('Error fetching daily summary:', error);
        res.status(500).json({ message: 'Internal server error while fetching daily summary.' });
    }
});

module.exports = router;
