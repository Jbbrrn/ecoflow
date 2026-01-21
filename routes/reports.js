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
        
        if (startDate) {
            // Add time to start date to include the entire day (from 00:00:00)
            query += ` AND dc.requested_at >= CONCAT(?, ' 00:00:00')`;
            params.push(startDate);
        }
        
        if (endDate) {
            // Add time to end date to include the entire day (up to 23:59:59)
            query += ` AND dc.requested_at <= CONCAT(?, ' 23:59:59')`;
            params.push(endDate);
        }
        
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
        
        if (startDate) {
            query += ` AND (dc.requested_at >= CONCAT(?, ' 00:00:00') OR dc.requested_at IS NULL)`;
            params.push(startDate);
        }
        
        if (endDate) {
            query += ` AND (dc.requested_at <= CONCAT(?, ' 23:59:59') OR dc.requested_at IS NULL)`;
            params.push(endDate);
        }
        
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
        const { startDate, endDate, hours } = req.query;
        
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
        
        if (hours) {
            query += ` AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)`;
            params.push(parseInt(hours));
        } else {
            if (startDate) {
                query += ` AND timestamp >= CONCAT(?, ' 00:00:00')`;
                params.push(startDate);
            }
            
            if (endDate) {
                query += ` AND timestamp <= CONCAT(?, ' 23:59:59')`;
                params.push(endDate);
            }
        }
        
        const [summary] = await pool.execute(query, params);
        
        // Get threshold violations
        let thresholdQuery = `
            SELECT 
                COUNT(*) as low_moisture_count,
                MIN(timestamp) as first_low_moisture,
                MAX(timestamp) as last_low_moisture
            FROM sensor_data
            WHERE (soil_moisture_1_percent < 20 OR soil_moisture_2_percent < 20 OR soil_moisture_3_percent < 20)
        `;
        
        const thresholdParams = [];
        if (hours) {
            thresholdQuery += ` AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)`;
            thresholdParams.push(parseInt(hours));
        } else {
            if (startDate) {
                thresholdQuery += ` AND timestamp >= CONCAT(?, ' 00:00:00')`;
                thresholdParams.push(startDate);
            }
            if (endDate) {
                thresholdQuery += ` AND timestamp <= CONCAT(?, ' 23:59:59')`;
                thresholdParams.push(endDate);
            }
        }
        
        const [thresholds] = await pool.execute(thresholdQuery, thresholdParams);
        
        res.status(200).json({
            summary: summary[0],
            thresholds: thresholds[0]
        });
        
    } catch (error) {
        console.error('Error fetching sensor summary report:', error);
        res.status(500).json({ message: 'Internal server error while fetching sensor summary report.' });
    }
});

/**
 * GET /api/reports/system-health
 * Get system health report
 * Query params: days (default: 7)
 */
router.get('/system-health', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const days = parseInt(req.query.days) || 7;
        
        // Command success rate
        const [commandStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_commands,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                AVG(TIMESTAMPDIFF(SECOND, requested_at, executed_at)) as avg_response_time
            FROM device_commands
            WHERE requested_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        // Sensor data availability
        const [sensorStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_readings,
                COUNT(DISTINCT DATE(timestamp)) as days_with_data,
                MIN(timestamp) as oldest_reading,
                MAX(timestamp) as newest_reading,
                TIMESTAMPDIFF(HOUR, MAX(timestamp), NOW()) as hours_since_last_reading
            FROM sensor_data
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        // Device uptime (based on successful commands)
        const [deviceUptime] = await pool.execute(`
            SELECT 
                device,
                COUNT(*) as total_commands,
                SUM(CASE WHEN status = 'SUCCESS' AND desired_state = 'ON' THEN 1 ELSE 0 END) as successful_ons,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failures
            FROM device_commands
            WHERE requested_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY device
        `, [days]);
        
        // Water level alerts
        const [waterAlerts] = await pool.execute(`
            SELECT 
                SUM(CASE WHEN water_level_low_status = 1 THEN 1 ELSE 0 END) as low_water_count,
                SUM(CASE WHEN water_level_high_status = 1 THEN 1 ELSE 0 END) as high_water_count
            FROM sensor_data
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        const health = {
            period_days: days,
            commands: commandStats[0],
            sensors: sensorStats[0],
            devices: deviceUptime,
            water_alerts: waterAlerts[0],
            overall_status: 'healthy' // Can be enhanced with logic
        };
        
        // Determine overall status
        const commandSuccessRate = commandStats[0].total_commands > 0 
            ? (commandStats[0].successful / commandStats[0].total_commands) * 100 
            : 100;
        
        const hoursSinceLastReading = sensorStats[0].hours_since_last_reading || 0;
        
        if (commandSuccessRate < 80 || hoursSinceLastReading > 2) {
            health.overall_status = 'warning';
        }
        if (commandSuccessRate < 50 || hoursSinceLastReading > 24) {
            health.overall_status = 'critical';
        }
        
        res.status(200).json(health);
        
    } catch (error) {
        console.error('Error fetching system health report:', error);
        res.status(500).json({ message: 'Internal server error while fetching system health report.' });
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
        const { startDate, endDate, days } = req.query;
        
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
        `;
        
        const params = [];
        
        if (days) {
            query += ` AND requested_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
            params.push(parseInt(days));
        } else {
            if (startDate) {
                query += ` AND requested_at >= CONCAT(?, ' 00:00:00')`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND requested_at <= CONCAT(?, ' 23:59:59')`;
                params.push(endDate);
            }
        }
        
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

