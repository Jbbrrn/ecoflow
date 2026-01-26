const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

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
                MIN(dc.requested_at) as first_command,
                MAX(dc.requested_at) as last_command
            FROM users u
            LEFT JOIN device_commands dc ON u.user_id = dc.requested_by
            WHERE 1=1
        `;
        
        const params = [];
        
        query += ` AND dc.requested_at >= CONCAT(?, ' 00:00:00')`;
        params.push(startDate);
        
        query += ` AND dc.requested_at <= CONCAT(?, ' 23:59:59')`;
        params.push(endDate);
        
        query += ` GROUP BY u.user_id, u.username, u.email, u.user_role, u.is_active ORDER BY total_commands DESC`;
        
        const [activity] = await pool.execute(query, params);
        
        res.status(200).json(activity);
        
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
 * Get water usage report based on pump/valve activations
 * Query params: startDate, endDate, days (alternative)
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
        
        // Get pump activation periods (simplified - assumes pump was on between ON and OFF commands)
        let query = `
            SELECT 
                DATE(requested_at) as date,
                device,
                desired_state,
                status,
                requested_at,
                executed_at,
                requested_by
            FROM device_commands
            WHERE device IN ('pump', 'valve')
            AND requested_at >= CONCAT(?, ' 00:00:00')
            AND requested_at <= CONCAT(?, ' 23:59:59')
        `;
        
        const params = [startDate, endDate];
        
        query += ` ORDER BY requested_at ASC`;
        
        const [commands] = await pool.execute(query, params);
        
        // Calculate usage statistics
        const usage = {
            pump: {
                total_activations: 0,
                successful_activations: 0,
                total_on_time_minutes: 0,
                by_date: {}
            },
            valve: {
                total_activations: 0,
                successful_activations: 0,
                total_on_time_minutes: 0,
                by_date: {}
            }
        };
        
        // Track ON/OFF pairs
        const deviceStates = { pump: null, valve: null };
        
        commands.forEach(cmd => {
            const device = cmd.device;
            const date = cmd.date;
            
            if (!usage[device].by_date[date]) {
                usage[device].by_date[date] = {
                    activations: 0,
                    on_time_minutes: 0
                };
            }
            
            if (cmd.desired_state === 'ON' && cmd.status === 'SUCCESS') {
                usage[device].total_activations++;
                usage[device].successful_activations++;
                usage[device].by_date[date].activations++;
                deviceStates[device] = cmd.executed_at || cmd.requested_at;
            } else if (cmd.desired_state === 'OFF' && cmd.status === 'SUCCESS' && deviceStates[device]) {
                const onTime = Math.round(
                    (new Date(cmd.executed_at || cmd.requested_at) - new Date(deviceStates[device])) / 60000
                );
                usage[device].total_on_time_minutes += onTime;
                usage[device].by_date[date].on_time_minutes += onTime;
                deviceStates[device] = null;
            }
        });
        
        res.status(200).json({
            usage,
            commands: commands.slice(0, 100) // Return recent commands
        });
        
    } catch (error) {
        console.error('Error fetching water usage report:', error);
        res.status(500).json({ message: 'Internal server error while fetching water usage report.' });
    }
});

module.exports = router;

