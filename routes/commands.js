const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { authenticateToken, authenticateDevice } = require('../middleware/auth');

/**
 * POST /api/commands/send
 * Send a device control command (pump or valve ON/OFF)
 * Body: { device: 'pump' | 'valve', state: 'ON' | 'OFF' }
 */
router.post('/send', authenticateToken, async (req, res) => {
    const { device, state } = req.body;
    const userId = req.user.user_id;

    // Validation
    if (!device || !state) {
        return res.status(400).json({ message: 'Device and state are required.' });
    }

    if (device !== 'pump' && device !== 'valve') {
        return res.status(400).json({ message: 'Invalid device. Must be "pump" or "valve".' });
    }

    if (state !== 'ON' && state !== 'OFF') {
        return res.status(400).json({ message: 'Invalid state. Must be "ON" or "OFF".' });
    }

    try {
        const pool = getPool();
        
        // Insert command into device_commands table
        const [result] = await pool.execute(
            `INSERT INTO device_commands (device, desired_state, status, requested_by) 
             VALUES (?, ?, 'PENDING', ?)`,
            [device, state, userId]
        );

        console.log(`Command created: ${device} -> ${state} by user ${userId} (command_id: ${result.insertId})`);

        res.status(201).json({
            message: 'Command sent successfully.',
            commandId: result.insertId,
            device: device,
            desiredState: state,
            status: 'PENDING'
        });

    } catch (error) {
        console.error('Error sending command:', error);
        res.status(500).json({ message: 'Internal server error while sending command.' });
    }
});

/**
 * GET /api/commands/status
 * Get the latest command status for each device (pump and valve)
 * Returns the most recent command for each device
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const pool = getPool();
        
        // Get latest command for pump
        const [pumpCommands] = await pool.execute(
            `SELECT 
                command_id,
                device,
                desired_state,
                actual_state,
                status,
                requested_by,
                requested_at,
                executed_at
             FROM device_commands 
             WHERE device = 'pump'
             ORDER BY requested_at DESC 
             LIMIT 1`
        );

        // Get latest command for valve
        const [valveCommands] = await pool.execute(
            `SELECT 
                command_id,
                device,
                desired_state,
                actual_state,
                status,
                requested_by,
                requested_at,
                executed_at
             FROM device_commands 
             WHERE device = 'valve'
             ORDER BY requested_at DESC 
             LIMIT 1`
        );

        const response = {
            pump: pumpCommands.length > 0 ? pumpCommands[0] : null,
            valve: valveCommands.length > 0 ? valveCommands[0] : null
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching command status:', error);
        res.status(500).json({ message: 'Internal server error while fetching command status.' });
    }
});

/**
 * GET /api/commands/pending
 * Get all pending commands for Raspberry Pi to execute
 * Returns commands in format: [{ "device": "pump", "state": "ON", "command_id": 1 }, ...]
 * Uses device API key authentication (x-api-key header)
 */
router.get('/pending', authenticateDevice, async (req, res) => {
    try {
        const pool = getPool();
        
        // Get all pending commands ordered by request time (oldest first)
        const [commands] = await pool.execute(
            `SELECT 
                command_id,
                device,
                desired_state as state
             FROM device_commands 
             WHERE status = 'PENDING'
             ORDER BY requested_at ASC`
        );

        // Format response to match expected JSON format
        const formattedCommands = commands.map(cmd => ({
            device: cmd.device,
            state: cmd.desired_state,
            command_id: cmd.command_id
        }));

        res.status(200).json(formattedCommands);

    } catch (error) {
        console.error('Error fetching pending commands:', error);
        res.status(500).json({ message: 'Internal server error while fetching pending commands.' });
    }
});

/**
 * POST /api/commands/update
 * Update command status after execution by Raspberry Pi
 * Body: { command_id: int, status: 'SUCCESS' | 'FAILED', actual_state: 'ON' | 'OFF' }
 * Uses device API key authentication (x-api-key header)
 */
router.post('/update', authenticateDevice, async (req, res) => {
    const { command_id, status, actual_state } = req.body;

    // Validation
    if (!command_id || !status) {
        return res.status(400).json({ message: 'command_id and status are required.' });
    }

    if (status !== 'SUCCESS' && status !== 'FAILED') {
        return res.status(400).json({ message: 'Invalid status. Must be "SUCCESS" or "FAILED".' });
    }

    if (status === 'SUCCESS' && actual_state !== 'ON' && actual_state !== 'OFF') {
        return res.status(400).json({ message: 'actual_state is required when status is SUCCESS. Must be "ON" or "OFF".' });
    }

    try {
        const pool = getPool();
        
        // Update command status, actual_state, and executed_at
        const updateFields = [];
        const updateValues = [];
        
        updateFields.push('status = ?');
        updateValues.push(status);
        
        if (actual_state) {
            updateFields.push('actual_state = ?');
            updateValues.push(actual_state);
        }
        
        updateFields.push('executed_at = NOW()');
        // command_id goes at the end for WHERE clause
        updateValues.push(command_id);

        const [result] = await pool.execute(
            `UPDATE device_commands 
             SET ${updateFields.join(', ')}
             WHERE command_id = ?`,
            updateValues
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Command not found.' });
        }

        // If command was successful, update the latest sensor_data row
        if (status === 'SUCCESS' && actual_state) {
            // Get the device type from the command
            const [commandRows] = await pool.execute(
                `SELECT device FROM device_commands WHERE command_id = ?`,
                [command_id]
            );

            if (commandRows.length > 0) {
                const device = commandRows[0].device;
                const statusValue = actual_state === 'ON' ? 1 : 0;
                const statusColumn = device === 'pump' ? 'pump_status' : 'valve_status';

                // Update the latest sensor_data row (most recent timestamp)
                // Get the max timestamp first, then update
                const [maxTimestampRows] = await pool.execute(
                    `SELECT MAX(timestamp) as max_ts FROM sensor_data`
                );
                
                if (maxTimestampRows.length > 0 && maxTimestampRows[0].max_ts) {
                    await pool.execute(
                        `UPDATE sensor_data 
                         SET ${statusColumn} = ?
                         WHERE timestamp = ?`,
                        [statusValue, maxTimestampRows[0].max_ts]
                    );
                }

                console.log(`Updated ${statusColumn} to ${statusValue} in latest sensor_data row`);
            }
        }

        console.log(`Command ${command_id} updated: status=${status}, actual_state=${actual_state || 'N/A'}`);

        res.status(200).json({
            message: 'Command status updated successfully.',
            command_id: command_id,
            status: status,
            actual_state: actual_state || null
        });

    } catch (error) {
        console.error('Error updating command status:', error);
        res.status(500).json({ message: 'Internal server error while updating command status.' });
    }
});

module.exports = router;

