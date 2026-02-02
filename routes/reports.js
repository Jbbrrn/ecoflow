const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// Device energy constant: RPI (0.12 kWh) + ESP32 (0.0024 kWh) per day when system is active
const DEVICE_ENERGY_KWH = 0.12 + 0.0024;

/**
 * GET /api/reports/test
 * Test endpoint to verify reports routes are working
 */
router.get('/test', (req, res) => {
    res.status(200).json({ message: 'Reports API is working!', timestamp: new Date().toISOString() });
});

/**
 * GET /api/reports/device-commands
 * Get device commands report with user information
 * Query params: startDate, endDate, device (pump|valve|all), status (PENDING|SUCCESS|FAILED|all)
 */
router.get('/device-commands', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const { startDate, endDate, device, status } = req.query;
        
        // Require both startDate and endDate for device commands report
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Both start date and end date are required for device commands report.',
                message: 'Both start date and end date are required for device commands report.' 
            });
        }
        
        // Validate that dates are not in the future using Philippines timezone
        // Get current date in Philippines timezone (UTC+8)
        const phTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const today = new Date(phTime);
        today.setHours(0, 0, 0, 0);
        
        // Parse selected dates (they come as YYYY-MM-DD strings)
        // Treat them as Philippines timezone dates
        const startDateObj = new Date(startDate + 'T00:00:00+08:00');
        const endDateObj = new Date(endDate + 'T23:59:59+08:00');
        
        // Compare dates (ignore time, just compare date parts)
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startDateOnly = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
        const endDateOnly = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
        
        console.log('Server Date validation (Philippines time):', {
            phTime,
            todayDateOnly: todayDateOnly.toISOString().split('T')[0],
            startDateOnly: startDateOnly.toISOString().split('T')[0],
            endDateOnly: endDateOnly.toISOString().split('T')[0]
        });
        
        if (startDateOnly > todayDateOnly || endDateOnly > todayDateOnly) {
            return res.status(400).json({ 
                error: 'Date range cannot include future dates.',
                message: 'Date range cannot include future dates. Please select dates up to today (Philippines time).' 
            });
        }
        
        // Validate that start date is before end date
        if (startDateOnly > endDateOnly) {
            return res.status(400).json({ 
                error: 'Start date must be before or equal to end date.',
                message: 'Start date must be before or equal to end date.' 
            });
        }
        
        // Debug logging
        console.log('Date filter params:', { startDate, endDate, device, status });
        
        let query = `
            SELECT 
                dc.command_id,
                dc.device,
                dc.desired_state,
                dc.actual_state,
                dc.status,
                dc.requested_at,
                dc.executed_at,
                u.user_id,
                u.username,
                u.email,
                u.user_role,
                TIMESTAMPDIFF(SECOND, dc.requested_at, dc.executed_at) as execution_time_seconds
            FROM device_commands dc
            LEFT JOIN users u ON dc.requested_by = u.user_id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Add time to start date to include the entire day (from 00:00:00)
        query += ` AND dc.requested_at >= CONCAT(?, ' 00:00:00')`;
        params.push(startDate);
        
        // Add time to end date to include the entire day (up to 23:59:59)
        query += ` AND dc.requested_at <= CONCAT(?, ' 23:59:59')`;
        params.push(endDate);
        
        if (device && device !== 'all') {
            query += ` AND dc.device = ?`;
            params.push(device);
        }
        
        if (status && status !== 'all') {
            query += ` AND dc.status = ?`;
            params.push(status);
        }
        
        query += ` ORDER BY dc.requested_at DESC LIMIT 1000`;
        
        console.log('Date filter params:', { startDate, endDate, device, status });
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const [commands] = await pool.execute(query, params);
        
        console.log(`Found ${commands.length} commands`);
        
        // Calculate summary statistics
        const summary = {
            total: commands.length,
            by_device: {},
            by_status: {},
            by_user: {},
            success_rate: 0,
            avg_execution_time: 0
        };
        
        let successCount = 0;
        let totalExecutionTime = 0;
        let executionCount = 0;
        
        commands.forEach(cmd => {
            // By device
            summary.by_device[cmd.device] = (summary.by_device[cmd.device] || 0) + 1;
            
            // By status
            summary.by_status[cmd.status] = (summary.by_status[cmd.status] || 0) + 1;
            
            // By user
            const userName = cmd.username || 'Unknown';
            if (!summary.by_user[userName]) {
                summary.by_user[userName] = { count: 0, username: userName, email: cmd.email || 'N/A', role: cmd.user_role || 'N/A' };
            }
            summary.by_user[userName].count++;
            
            // Success rate
            if (cmd.status === 'SUCCESS') {
                successCount++;
            }
            
            // Execution time
            if (cmd.execution_time_seconds !== null) {
                totalExecutionTime += cmd.execution_time_seconds;
                executionCount++;
            }
        });
        
        summary.success_rate = commands.length > 0 ? ((successCount / commands.length) * 100).toFixed(2) : 0;
        summary.avg_execution_time = executionCount > 0 ? (totalExecutionTime / executionCount).toFixed(2) : 0;
        
        res.status(200).json({
            commands,
            summary
        });
        
    } catch (error) {
        console.error('Error fetching device commands report:', error);
        res.status(500).json({ message: 'Internal server error while fetching device commands report.' });
    }
});

/**
 * GET /api/reports/user-activity
 * Get user activity report
 * Query params: startDate, endDate
 * Returns array directly for frontend compatibility
 */
router.get('/user-activity', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const { startDate, endDate } = req.query;
        
        // Require both startDate and endDate
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Both start date and end date are required for user activity report.',
                message: 'Both start date and end date are required for user activity report.' 
            });
        }
        
        // Get user activity from device commands
        let query = `
            SELECT 
                u.user_id,
                u.username,
                u.email,
                u.user_role,
                u.is_active,
                COUNT(dc.command_id) as total_commands,
                SUM(CASE WHEN dc.status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_commands,
                SUM(CASE WHEN dc.status = 'FAILED' THEN 1 ELSE 0 END) as failed_commands,
                SUM(CASE WHEN dc.status = 'PENDING' THEN 1 ELSE 0 END) as pending_commands,
                SUM(CASE WHEN dc.device = 'pump' THEN 1 ELSE 0 END) as pump_commands,
                SUM(CASE WHEN dc.device = 'valve' THEN 1 ELSE 0 END) as valve_commands,
                MIN(dc.requested_at) as first_command,
                MAX(dc.requested_at) as last_command
            FROM users u
            LEFT JOIN device_commands dc ON u.user_id = dc.requested_by
                AND dc.requested_at >= CONCAT(?, ' 00:00:00')
                AND dc.requested_at <= CONCAT(?, ' 23:59:59')
            GROUP BY u.user_id, u.username, u.email, u.user_role, u.is_active
            ORDER BY total_commands DESC
        `;
        
        const params = [startDate, endDate];
        
        const [users] = await pool.execute(query, params);
        
        // Return array directly for frontend compatibility
        res.status(200).json(users);
        
    } catch (error) {
        console.error('Error fetching user activity report:', error);
        res.status(500).json({ message: 'Internal server error while fetching user activity report.' });
    }
});

/**
 * GET /api/reports/sensor-summary
 * Get sensor data summary report
 * Query params: startDate, endDate, hours (alternative to dates)
 */
router.get('/sensor-summary', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const { startDate, endDate } = req.query;
        
        // Require both startDate and endDate
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Both start date and end date are required for sensor summary report.',
                message: 'Both start date and end date are required for sensor summary report.' 
            });
        }
        
        console.log('Sensor Summary API called:', { startDate, endDate });
        
        let query = `
            SELECT 
                COUNT(*) as total_readings,
                MIN(timestamp) as first_reading,
                MAX(timestamp) as last_reading,
                AVG(soil_moisture_1_percent) as avg_soil1,
                MIN(soil_moisture_1_percent) as min_soil1,
                MAX(soil_moisture_1_percent) as max_soil1,
                AVG(soil_moisture_2_percent) as avg_soil2,
                MIN(soil_moisture_2_percent) as min_soil2,
                MAX(soil_moisture_2_percent) as max_soil2,
                AVG(soil_moisture_3_percent) as avg_soil3,
                MIN(soil_moisture_3_percent) as min_soil3,
                MAX(soil_moisture_3_percent) as max_soil3,
                AVG(air_temperature_celsius) as avg_temperature,
                MIN(air_temperature_celsius) as min_temperature,
                MAX(air_temperature_celsius) as max_temperature,
                AVG(air_humidity_percent) as avg_humidity,
                MIN(air_humidity_percent) as min_humidity,
                MAX(air_humidity_percent) as max_humidity,
                SUM(CASE WHEN water_level_low_status = 1 THEN 1 ELSE 0 END) as low_water_alerts,
                SUM(CASE WHEN water_level_high_status = 1 THEN 1 ELSE 0 END) as high_water_alerts,
                SUM(CASE WHEN pump_status = 1 THEN 1 ELSE 0 END) as pump_on_count,
                SUM(CASE WHEN valve_status = 1 THEN 1 ELSE 0 END) as valve_on_count
            FROM sensor_data
            WHERE 1=1
        `;
        
        const params = [];
        
        query += ` AND timestamp >= CONCAT(?, ' 00:00:00')`;
        params.push(startDate);
        console.log('Using startDate filter:', startDate);
        
        query += ` AND timestamp <= CONCAT(?, ' 23:59:59')`;
        params.push(endDate);
        console.log('Using endDate filter:', endDate);
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const [summary] = await pool.execute(query, params);
        
        console.log('Query result:', {
            rowCount: summary.length,
            summaryData: summary[0],
            totalReadings: summary[0]?.total_readings
        });
        
        // Get threshold violations
        let thresholdQuery = `
            SELECT 
                COUNT(*) as low_moisture_count,
                MIN(timestamp) as first_low_moisture,
                MAX(timestamp) as last_low_moisture
            FROM sensor_data
            WHERE (soil_moisture_1_percent < 20 OR soil_moisture_2_percent < 20 OR soil_moisture_3_percent < 20)
            AND timestamp >= CONCAT(?, ' 00:00:00')
            AND timestamp <= CONCAT(?, ' 23:59:59')
        `;
        
        const thresholdParams = [startDate, endDate];
        
        const [thresholds] = await pool.execute(thresholdQuery, thresholdParams);
        
        const responseData = {
            summary: summary[0],
            thresholds: thresholds[0]
        };
        
        console.log('Sending response:', {
            summaryKeys: Object.keys(responseData.summary),
            thresholdsKeys: Object.keys(responseData.thresholds),
            totalReadings: responseData.summary.total_readings
        });
        
        res.status(200).json(responseData);
        
    } catch (error) {
        console.error('Error fetching sensor summary report:', error);
        res.status(500).json({ message: 'Internal server error while fetching sensor summary report.' });
    }
});

/**
 * GET /api/reports/water-usage
 * UPDATED: Now uses actual resource_consumption data instead of estimating from commands
 * Get water usage report from resource consumption table
 * Query params: startDate, endDate
 */
router.get('/water-usage', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const { startDate, endDate } = req.query;
        
        // Require both startDate and endDate
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Both start date and end date are required for water usage report.',
                message: 'Both start date and end date are required for water usage report.' 
            });
        }
        
        // NEW: Get actual resource consumption data from resource_consumption table
        let resourceQuery = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as total_sessions,
                SUM(pump_runtime_seconds) as total_pump_seconds,
                SUM(valve_runtime_seconds) as total_valve_seconds,
                SUM(water_consumed_liters) as total_water_liters,
                SUM(energy_consumed_kwh) as total_energy_kwh,
                AVG(pump_runtime_seconds) as avg_pump_runtime,
                AVG(valve_runtime_seconds) as avg_valve_runtime,
                AVG(water_consumed_liters) as avg_water_per_session,
                SUM(CASE WHEN pump_state = 1 THEN 1 ELSE 0 END) as pump_sessions,
                SUM(CASE WHEN valve_state = 1 THEN 1 ELSE 0 END) as valve_sessions
            FROM resource_consumption
            WHERE timestamp >= CONCAT(?, ' 00:00:00')
            AND timestamp <= CONCAT(?, ' 23:59:59')
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;
        
        const resourceParams = [startDate, endDate];
        const [resourceData] = await pool.execute(resourceQuery, resourceParams);
        
        // Calculate overall summary (device energy = 0.1224 kWh per day with resource data)
        const summary = {
            total_sessions: 0,
            total_water_liters: 0,
            total_pump_seconds: 0,
            total_valve_seconds: 0,
            total_irrigation_energy_kwh: 0,
            total_device_energy_kwh: 0,
            total_energy_kwh: 0,
            avg_water_per_session: 0,
            avg_pump_runtime: 0,
            avg_valve_runtime: 0,
            days_with_data: resourceData.length
        };
        
        resourceData.forEach(day => {
            summary.total_sessions += day.total_sessions || 0;
            summary.total_water_liters += parseFloat(day.total_water_liters) || 0;
            summary.total_pump_seconds += parseFloat(day.total_pump_seconds) || 0;
            summary.total_valve_seconds += parseFloat(day.total_valve_seconds) || 0;
            summary.total_irrigation_energy_kwh += parseFloat(day.total_energy_kwh) || 0;
            summary.total_device_energy_kwh += DEVICE_ENERGY_KWH; // 0.1224 per day with data
        });
        
        summary.total_energy_kwh = summary.total_irrigation_energy_kwh + summary.total_device_energy_kwh;
        summary.avg_water_per_session = summary.total_sessions > 0 
            ? (summary.total_water_liters / summary.total_sessions).toFixed(3) 
            : 0;
        summary.avg_pump_runtime = summary.total_sessions > 0 
            ? (summary.total_pump_seconds / summary.total_sessions).toFixed(2) 
            : 0;
        summary.avg_valve_runtime = summary.total_sessions > 0 
            ? (summary.total_valve_seconds / summary.total_sessions).toFixed(2) 
            : 0;
        
        // Format resource data for response (device energy = 0.1224 kWh per day with data)
        const dailyBreakdown = resourceData.map(day => {
            const irrigationKwh = parseFloat(day.total_energy_kwh || 0);
            const totalKwh = irrigationKwh + DEVICE_ENERGY_KWH;
            return {
                date: day.date,
                sessions: day.total_sessions,
                water_liters: parseFloat(day.total_water_liters || 0).toFixed(3),
                pump_seconds: parseFloat(day.total_pump_seconds || 0).toFixed(2),
                valve_seconds: parseFloat(day.total_valve_seconds || 0).toFixed(2),
                irrigation_energy_kwh: irrigationKwh.toFixed(6),
                device_energy_kwh: DEVICE_ENERGY_KWH.toFixed(6),
                total_energy_kwh: totalKwh.toFixed(6),
                pump_sessions: day.pump_sessions || 0,
                valve_sessions: day.valve_sessions || 0
            };
        });
        
        res.status(200).json({
            summary,
            daily_breakdown: dailyBreakdown
        });
        
    } catch (error) {
        console.error('Error fetching water usage report:', error);
        res.status(500).json({ message: 'Internal server error while fetching water usage report.' });
    }
});

/**
 * GET /api/reports/resource-consumption
 * Get detailed resource consumption report with all metrics
 * Query params: startDate, endDate, groupBy (hour|day|week)
 */
router.get('/resource-consumption', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const { startDate, endDate, groupBy = 'day' } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Both start date and end date are required.',
                message: 'Both start date and end date are required for resource consumption report.' 
            });
        }
        
        // Determine grouping format
        let dateFormat;
        switch(groupBy) {
            case 'hour':
                dateFormat = '%Y-%m-%d %H:00:00';
                break;
            case 'week':
                dateFormat = '%Y-%U'; // Year-Week
                break;
            case 'day':
            default:
                dateFormat = '%Y-%m-%d';
                break;
        }
        
        let query = `
            SELECT 
                DATE_FORMAT(timestamp, ?) as period,
                COUNT(*) as total_sessions,
                SUM(pump_runtime_seconds) as total_pump_seconds,
                SUM(valve_runtime_seconds) as total_valve_seconds,
                SUM(water_consumed_liters) as total_water_liters,
                SUM(energy_consumed_kwh) as total_energy_kwh,
                AVG(pump_runtime_seconds) as avg_pump_runtime,
                AVG(valve_runtime_seconds) as avg_valve_runtime,
                AVG(water_consumed_liters) as avg_water_per_session,
                MAX(water_consumed_liters) as max_water_session,
                MIN(water_consumed_liters) as min_water_session,
                SUM(CASE WHEN pump_state = 1 THEN 1 ELSE 0 END) as pump_active_sessions,
                SUM(CASE WHEN valve_state = 1 THEN 1 ELSE 0 END) as valve_active_sessions,
                MIN(timestamp) as period_start,
                MAX(timestamp) as period_end
            FROM resource_consumption
            WHERE timestamp >= CONCAT(?, ' 00:00:00')
            AND timestamp <= CONCAT(?, ' 23:59:59')
            GROUP BY DATE_FORMAT(timestamp, ?)
            ORDER BY period ASC
        `;
        
        const params = [dateFormat, startDate, endDate, dateFormat];
        const [data] = await pool.execute(query, params);
        
        // Calculate totals
        const totals = {
            total_sessions: 0,
            total_water_liters: 0,
            total_pump_seconds: 0,
            total_valve_seconds: 0,
            total_energy_kwh: 0,
            periods_count: data.length
        };
        
        data.forEach(period => {
            totals.total_sessions += period.total_sessions || 0;
            totals.total_water_liters += parseFloat(period.total_water_liters) || 0;
            totals.total_pump_seconds += parseFloat(period.total_pump_seconds) || 0;
            totals.total_valve_seconds += parseFloat(period.total_valve_seconds) || 0;
            totals.total_energy_kwh += parseFloat(period.total_energy_kwh) || 0;
        });
        
        res.status(200).json({
            groupBy,
            data,
            totals
        });
        
    } catch (error) {
        console.error('Error fetching resource consumption report:', error);
        res.status(500).json({ message: 'Internal server error while fetching resource consumption report.' });
    }
});

/**
 * GET /api/reports/energy-consumption
 * Get comprehensive energy consumption report (irrigation + devices)
 * Query params: startDate, endDate
 */
router.get('/energy-consumption', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Both start date and end date are required.',
                message: 'Both start date and end date are required for energy consumption report.' 
            });
        }
        
        // Get irrigation energy consumption
        let irrigationQuery = `
            SELECT 
                DATE(timestamp) as date,
                SUM(energy_consumed_kwh) as irrigation_energy_kwh,
                COUNT(*) as sessions,
                AVG(energy_consumed_kwh) as avg_energy_per_session
            FROM resource_consumption
            WHERE timestamp >= CONCAT(?, ' 00:00:00')
            AND timestamp <= CONCAT(?, ' 23:59:59')
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;
        
        const [irrigationData] = await pool.execute(irrigationQuery, [startDate, endDate]);
        
        // Get dates with sensor data (system was on)
        const [sensorDates] = await pool.execute(
            `SELECT DISTINCT DATE(timestamp) as date FROM sensor_data 
             WHERE timestamp >= CONCAT(?, ' 00:00:00') AND timestamp <= CONCAT(?, ' 23:59:59')`,
            [startDate, endDate]
        );
        
        // Combine: unique dates from irrigation + sensor, device energy = 0.1224 per active day
        const dailyEnergy = [];
        const dateMap = new Map();
        
        irrigationData.forEach(item => {
            const dateStr = item.date;
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, {
                    date: dateStr,
                    irrigation_kwh: 0,
                    rpi_kwh: 0.12,
                    esp32_kwh: 0.0024,
                    total_device_kwh: DEVICE_ENERGY_KWH,
                    total_kwh: 0,
                    sessions: 0
                });
            }
            const entry = dateMap.get(dateStr);
            entry.irrigation_kwh = parseFloat(item.irrigation_energy_kwh || 0);
            entry.sessions = item.sessions || 0;
            entry.total_kwh = entry.irrigation_kwh + entry.total_device_kwh;
        });
        
        sensorDates.forEach(item => {
            const dateStr = item.date;
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, {
                    date: dateStr,
                    irrigation_kwh: 0,
                    rpi_kwh: 0.12,
                    esp32_kwh: 0.0024,
                    total_device_kwh: DEVICE_ENERGY_KWH,
                    total_kwh: DEVICE_ENERGY_KWH,
                    sessions: 0
                });
            }
        });
        
        dateMap.forEach((entry, date) => {
            if (entry.total_kwh === 0) {
                entry.total_kwh = entry.irrigation_kwh + entry.total_device_kwh;
            }
            dailyEnergy.push(entry);
        });
        
        // Sort by date
        dailyEnergy.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate summary
        const summary = {
            total_irrigation_kwh: 0,
            total_device_kwh: 0,
            total_rpi_kwh: 0,
            total_esp32_kwh: 0,
            grand_total_kwh: 0,
            days_recorded: dailyEnergy.length,
            avg_daily_irrigation_kwh: 0,
            avg_daily_device_kwh: 0,
            avg_daily_total_kwh: 0
        };
        
        dailyEnergy.forEach(day => {
            summary.total_irrigation_kwh += day.irrigation_kwh;
            summary.total_device_kwh += day.total_device_kwh;
            summary.total_rpi_kwh += day.rpi_kwh;
            summary.total_esp32_kwh += day.esp32_kwh;
            summary.grand_total_kwh += day.total_kwh;
        });
        
        if (dailyEnergy.length > 0) {
            summary.avg_daily_irrigation_kwh = (summary.total_irrigation_kwh / dailyEnergy.length).toFixed(6);
            summary.avg_daily_device_kwh = (summary.total_device_kwh / dailyEnergy.length).toFixed(6);
            summary.avg_daily_total_kwh = (summary.grand_total_kwh / dailyEnergy.length).toFixed(6);
        }
        
        // Round summary values
        summary.total_irrigation_kwh = parseFloat(summary.total_irrigation_kwh.toFixed(6));
        summary.total_device_kwh = parseFloat(summary.total_device_kwh.toFixed(6));
        summary.total_rpi_kwh = parseFloat(summary.total_rpi_kwh.toFixed(6));
        summary.total_esp32_kwh = parseFloat(summary.total_esp32_kwh.toFixed(6));
        summary.grand_total_kwh = parseFloat(summary.grand_total_kwh.toFixed(6));
        
        res.status(200).json({
            summary,
            daily_breakdown: dailyEnergy
        });
        
    } catch (error) {
        console.error('Error fetching energy consumption report:', error);
        res.status(500).json({ message: 'Internal server error while fetching energy consumption report.' });
    }
});

/**
 * GET /api/reports/comprehensive-daily
 * Get comprehensive daily report combining all metrics
 * Query params: date (default: today)
 */
router.get('/comprehensive-daily', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const device_id = req.query.device_id || 'RPi_1';
        
        // Sensor statistics
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
                MIN(soil_moisture_3_percent) as min_soil3,
                SUM(CASE WHEN water_level_low_status = 1 THEN 1 ELSE 0 END) as low_water_alerts,
                SUM(CASE WHEN water_level_high_status = 1 THEN 1 ELSE 0 END) as high_water_alerts
             FROM sensor_data
             WHERE DATE(timestamp) = ? AND device_id = ?`,
            [date, device_id]
        );
        
        // Resource consumption
        const [resourceStats] = await pool.execute(
            `SELECT 
                COUNT(*) as total_sessions,
                SUM(pump_runtime_seconds) as total_pump_seconds,
                SUM(valve_runtime_seconds) as total_valve_seconds,
                SUM(water_consumed_liters) as total_water_liters,
                SUM(energy_consumed_kwh) as irrigation_energy_kwh,
                AVG(pump_runtime_seconds) as avg_pump_runtime,
                AVG(valve_runtime_seconds) as avg_valve_runtime
             FROM resource_consumption
             WHERE DATE(timestamp) = ? AND device_id = ?`,
            [date, device_id]
        );
        
        // Device energy: 0.1224 kWh when system was active (has sensor or resource data)
        const hasDataForDay = (sensorStats[0]?.total_readings > 0) || (resourceStats[0]?.total_sessions > 0);
        const deviceEnergyKwh = hasDataForDay ? 0.1224 : 0;
        const irrigationEnergy = resourceStats[0]?.irrigation_energy_kwh || 0;
        const totalEnergy = parseFloat(irrigationEnergy) + deviceEnergyKwh;
        
        res.status(200).json({
            date,
            device_id,
            sensor_statistics: sensorStats[0] || {},
            resource_consumption: resourceStats[0] || {},
            device_energy: { rpi_kwh: 0.12, esp32_kwh: 0.0024, total_device_kwh: deviceEnergyKwh },
            energy_summary: {
                irrigation_kwh: parseFloat((irrigationEnergy || 0).toFixed(6)),
                device_kwh: parseFloat((deviceEnergyKwh || 0).toFixed(6)),
                total_kwh: parseFloat(totalEnergy.toFixed(6))
            }
        });
        
    } catch (error) {
        console.error('Error fetching comprehensive daily report:', error);
        res.status(500).json({ message: 'Internal server error while fetching comprehensive daily report.' });
    }
});

module.exports = router;
