const nodemailer = require('nodemailer');
const { getPool } = require('../config/database');

// Gmail SMTP configuration from environment variables
const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports (587 uses TLS)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD // Use App Password, not regular password
    },
    // Gmail-specific options
    tls: {
        rejectUnauthorized: false // For development, set to true in production
    }
};

// Create reusable transporter
let transporter = null;

function getTransporter() {
    if (!transporter) {
        if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
            console.warn('Email service not configured. SMTP_USER and SMTP_PASSWORD must be set in environment variables.');
            return null;
        }
        
        // Verify it's a Gmail address
        if (!EMAIL_CONFIG.auth.user.includes('@gmail.com')) {
            console.warn('Warning: SMTP_USER does not appear to be a Gmail address. Gmail SMTP settings may not work.');
        }
        
        transporter = nodemailer.createTransport({
            host: EMAIL_CONFIG.host,
            port: EMAIL_CONFIG.port,
            secure: EMAIL_CONFIG.secure,
            auth: EMAIL_CONFIG.auth,
            tls: EMAIL_CONFIG.tls
        });
        
        // Verify connection on startup
        transporter.verify((error, success) => {
            if (error) {
                console.error('Email service connection failed:', error);
            } else {
                console.log('✓ Email service (Gmail) is ready to send messages');
            }
        });
    }
    return transporter;
}

/**
 * Get all active users' emails from database
 */
async function getActiveUserEmails() {
    try {
        const pool = getPool();
        const [users] = await pool.execute(
            `SELECT email, username FROM users WHERE is_active = 1 AND email IS NOT NULL AND email != ''`
        );
        return users.map(user => ({ email: user.email, username: user.username }));
    } catch (error) {
        console.error('Error fetching user emails:', error);
        return [];
    }
}

/**
 * Send email notification to all active users via Gmail
 */
async function sendEmailNotification(subject, htmlContent, textContent) {
    const emailTransporter = getTransporter();
    if (!emailTransporter) {
        console.warn('Email service not available. Skipping email notification.');
        return { success: false, message: 'Email service not configured' };
    }

    try {
        const recipients = await getActiveUserEmails();
        
        if (recipients.length === 0) {
            console.warn('No active users with email addresses found.');
            return { success: false, message: 'No recipients found' };
        }

        const emailAddresses = recipients.map(r => r.email).join(', ');
        
        const mailOptions = {
            from: `"EcoFlow System" <${EMAIL_CONFIG.auth.user}>`,
            to: emailAddresses,
            subject: subject,
            text: textContent,
            html: htmlContent,
            // Gmail-specific headers
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high'
            }
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✓ Email notification sent via Gmail to ${recipients.length} user(s). Message ID: ${info.messageId}`);
        
        return { 
            success: true, 
            messageId: info.messageId,
            recipients: recipients.length 
        };
    } catch (error) {
        console.error('Error sending email notification via Gmail:', error);
        
        // Provide helpful error messages for common Gmail issues
        if (error.code === 'EAUTH') {
            console.error('Gmail authentication failed. Check your App Password.');
        } else if (error.code === 'ECONNECTION') {
            console.error('Gmail connection failed. Check your internet connection and SMTP settings.');
        }
        
        return { success: false, error: error.message };
    }
}

/**
 * Send critical moisture level alert
 */
async function sendCriticalMoistureAlert(sensorData) {
    const criticalSensors = [];
    
    if (sensorData.soil_moisture_1_percent !== null && sensorData.soil_moisture_1_percent < 20) {
        criticalSensors.push({ number: 1, value: sensorData.soil_moisture_1_percent });
    }
    if (sensorData.soil_moisture_2_percent !== null && sensorData.soil_moisture_2_percent < 20) {
        criticalSensors.push({ number: 2, value: sensorData.soil_moisture_2_percent });
    }
    if (sensorData.soil_moisture_3_percent !== null && sensorData.soil_moisture_3_percent < 20) {
        criticalSensors.push({ number: 3, value: sensorData.soil_moisture_3_percent });
    }

    if (criticalSensors.length === 0) {
        return { success: false, message: 'No critical sensors detected' };
    }

    const sensorList = criticalSensors.map(s => `Sensor ${s.number}: ${s.value}%`).join('<br>');
    const timestamp = new Date(sensorData.timestamp || new Date()).toLocaleString();

    const subject = `🚨 CRITICAL: Low Soil Moisture Detected - EcoFlow System`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px;">
                <h2 style="color: #dc2626; margin: 0;">⚠️ Critical Soil Moisture Alert</h2>
            </div>
            
            <p style="font-size: 16px;">The following soil sensors have detected <strong>critically low moisture levels</strong>:</p>
            
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <ul style="color: #dc2626; font-weight: bold; font-size: 16px; margin: 0; padding-left: 20px;">
                    ${criticalSensors.map(s => `<li>Sensor ${s.number}: <strong>${s.value}%</strong> (Critical: &lt;20%)</li>`).join('')}
                </ul>
            </div>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>📅 Timestamp:</strong> ${timestamp}</p>
                <p style="margin: 5px 0;"><strong>🌡️ Temperature:</strong> ${sensorData.air_temperature_celsius || 'N/A'}°C</p>
                <p style="margin: 5px 0;"><strong>💧 Humidity:</strong> ${sensorData.air_humidity_percent || 'N/A'}%</p>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #92400e;">⚡ Action Required:</p>
                <p style="margin: 5px 0 0 0;">Immediate watering is recommended to prevent plant stress and damage.</p>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated alert from the <strong>EcoFlow Smart Greenhouse Management System</strong>.<br>
                Sent via Gmail SMTP
            </p>
        </div>
    `;

    const textContent = `
🚨 CRITICAL: Low Soil Moisture Detected

The following soil sensors have detected critically low moisture levels:
${criticalSensors.map(s => `- Sensor ${s.number}: ${s.value}% (Critical: <20%)`).join('\n')}

Timestamp: ${timestamp}
Temperature: ${sensorData.air_temperature_celsius || 'N/A'}°C
Humidity: ${sensorData.air_humidity_percent || 'N/A'}%

⚡ Action Required: Immediate watering is recommended to prevent plant stress and damage.

This is an automated alert from the EcoFlow Smart Greenhouse Management System.
    `;

    return await sendEmailNotification(subject, htmlContent, textContent);
}

/**
 * Send sprinkler activation notification
 */
async function sendSprinklerActivationNotification(commandData, requestedBy) {
    const timestamp = new Date().toLocaleString();
    const requestedByUser = requestedBy || 'System';

    const subject = `💧 Sprinkler System Activated - EcoFlow System`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin-bottom: 20px;">
                <h2 style="color: #059669; margin: 0;">💧 Sprinkler System Activated</h2>
            </div>
            
            <p style="font-size: 16px;">The sprinkler system (water pump) has been <strong>activated</strong>.</p>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #059669;">
                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💧</div>
                    <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 0;">SYSTEM ACTIVE</p>
                </div>
                
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <p style="margin: 8px 0;"><strong>👤 Activated By:</strong> ${requestedByUser}</p>
                    <p style="margin: 8px 0;"><strong>📅 Timestamp:</strong> ${timestamp}</p>
                    <p style="margin: 8px 0;"><strong>📊 Status:</strong> <span style="color: #059669; font-weight: bold;">${commandData.status || 'SUCCESS'}</span></p>
                </div>
            </div>
            
            <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #1e40af;">ℹ️ System Information:</p>
                <p style="margin: 5px 0 0 0;">The system is now watering your plants. The sprinkler will run until manually turned off or the automatic system deactivates it.</p>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated notification from the <strong>EcoFlow Smart Greenhouse Management System</strong>.<br>
                Sent via Gmail SMTP
            </p>
        </div>
    `;

    const textContent = `
💧 Sprinkler System Activated

The sprinkler system (water pump) has been activated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYSTEM ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Activated By: ${requestedByUser}
Timestamp: ${timestamp}
Status: ${commandData.status || 'SUCCESS'}

ℹ️ System Information:
The system is now watering your plants. The sprinkler will run until manually turned off or the automatic system deactivates it.

This is an automated notification from the EcoFlow Smart Greenhouse Management System.
    `;

    return await sendEmailNotification(subject, htmlContent, textContent);
}

module.exports = {
    sendEmailNotification,
    sendCriticalMoistureAlert,
    sendSprinklerActivationNotification,
    getActiveUserEmails
};

