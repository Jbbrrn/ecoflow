const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { SERVICE_API_KEY } = require('../config/constants');

// Use native fetch if available (Node 18+), otherwise require node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    try {
        fetch = require('node-fetch');
    } catch (e) {
        throw new Error('fetch is not available. Please use Node 18+ or install node-fetch');
    }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. Chatbot will not work until this is configured.');
}

/**
 * Extract hours from question text (e.g., "last 24 hours", "past week")
 */
function extractHours(text) {
    const lower = text.toLowerCase();
    
    // Match patterns like "24 hours", "48 hours", etc.
    const hourMatch = lower.match(/(\d+)\s*(hour|hr|h|oras)/i);
    if (hourMatch) {
        return parseInt(hourMatch[1], 10);
    }
    
    // Match patterns like "past week", "last week", "linggo"
    if (/week|linggo/i.test(lower)) {
        return 168; // 7 days * 24 hours
    }
    
    // Match patterns like "past day", "last day", "araw"
    if (/day|araw/i.test(lower) && !/week|month|year/i.test(lower)) {
        return 24;
    }
    
    // Default to 24 hours
    return 24;
}

/**
 * Classify question intent and check for forbidden topics
 */
function classifyQuestion(question) {
    const lower = question.toLowerCase();
    
    // Forbidden topics (English and Filipino)
    const forbiddenKeywords = [
        // Control commands (must be exact phrases or specific contexts)
        'turn on pump', 'turn off pump', 'open valve', 'close valve',
        'start pump', 'stop pump', 'activate pump', 'deactivate pump',
        'control pump', 'control valve', 'operate pump', 'operate valve',
        
        // Off-topic topics
        'fertilizer', 'herbicide', 'pesticide', 'chemical',
        'pataba', 'pestisidyo', 'herbisidyo', 'kemikal',
        
        // Financial/medical
        'profit', 'yield', 'income', 'money', 'cost', 'price',
        'medical', 'health', 'sick', 'disease',
        'utang', 'bangko', 'pera', 'gastos',
        
        // Weather forecast (not historical data)
        'weather forecast', 'forecast', 'prediction',
        'hula', 'prediksyon'
    ];
    
    // Check for forbidden topics
    for (const keyword of forbiddenKeywords) {
        if (lower.includes(keyword)) {
            return { forbidden: true, reason: keyword };
        }
    }
    
    // Intent classification
    if (/history|trend|nakaraan|dati|last|past|over time|historical|nakalipas/i.test(lower)) {
        return { 
            intent: 'history', 
            hours: extractHours(question)
        };
    }
    
    if (/crop|suitable|tanim|pananim|halaman|gulay|vegetable|plant|recommend/i.test(lower)) {
        return { intent: 'crop_suitability' };
    }
    
    if (/irrigat|water|dilig|patubig|schedule|kailan|when|watering/i.test(lower)) {
        return { intent: 'irrigation_schedule' };
    }
    
    if (/soil|moisture|lupa|halumigmig|condition|sensor/i.test(lower)) {
        return { intent: 'soil_condition' };
    }
    
    if (/temperature|humidity|temperatura|humedad|temp|humid/i.test(lower)) {
        return { intent: 'sensor_data' };
    }
    
    // Default to general query
    return { intent: 'general' };
}

/**
 * Fetch sensor data from database
 */
async function fetchSensorData(intent, hours = 24) {
    try {
        const pool = getPool();
        
        if (intent === 'history') {
            // Fetch historical data
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
                 ORDER BY timestamp ASC`,
                [hours]
            );
            
            return rows.length > 0 ? rows : null;
        } else {
            // Fetch latest data
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
                 ORDER BY timestamp DESC 
                 LIMIT 1`
            );
            
            return rows.length > 0 ? rows[0] : null;
        }
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        return null;
    }
}

/**
 * Build system prompt for OpenAI
 */
function buildSystemPrompt(intent, data) {
    let prompt = `You are an expert AI irrigation assistant for the Eco Flow smart greenhouse irrigation system. 
Your role is to provide helpful, accurate, and actionable advice about irrigation, soil conditions, and crop management.

IMPORTANT RULES:
1. Only answer questions related to irrigation systems, soil conditions, supported crops, and recorded sensor data.
2. Do NOT provide commands to control pumps, valves, or any hardware.
3. Do NOT answer questions about fertilizers, pesticides, herbicides, or chemicals.
4. Do NOT answer questions about financial matters, medical advice, or weather forecasts.
5. Respond in the same language as the user's question (English or Filipino/Tagalog).
6. Use clear, concise language with short paragraphs and bullet points when appropriate.
7. If sensor data is provided, use it to give accurate answers. Do not invent sensor values.
8. If no sensor data is available, acknowledge this and provide general best practices.
9. For crop suitability questions, you may include 1-3 reputable agricultural resource links if helpful.
10. Format your response as HTML with proper tags (p, ul, li, strong, a) for better readability.

Current Intent: ${intent}
`;

    if (data) {
        if (Array.isArray(data)) {
            prompt += `\nHistorical Sensor Data (${data.length} readings over the requested time period):\n${JSON.stringify(data, null, 2)}`;
        } else {
            prompt += `\nLatest Sensor Data:\n${JSON.stringify(data, null, 2)}`;
        }
    } else {
        prompt += `\nNote: No sensor data is currently available. Provide general best practices based on the question.`;
    }

    return prompt;
}

/**
 * POST /api/chatbot
 * Chatbot endpoint that uses OpenAI ChatGPT API
 */
router.post('/chatbot', async (req, res) => {
    try {
        console.log('Chatbot request received:', {
            body: req.body,
            headers: req.headers['content-type']
        });
        
        const question = (req.body.question || req.body.message || '').trim();
        
        if (!question) {
            console.log('No question provided');
            return res.status(400).json({ 
                response: 'Please provide a question.' 
            });
        }

        console.log('Processing question:', question);

        // Check if OpenAI API key is configured FIRST
        if (!OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not configured');
            return res.status(500).json({
                response: 'Chatbot service is not configured. Please contact the administrator.'
            });
        }

        // Check for forbidden topics
        const classification = classifyQuestion(question);
        console.log('Classification:', classification);
        
        if (classification.forbidden) {
            console.log('Question blocked (forbidden topic):', classification.reason);
            return res.json({
                response: 'I can only answer questions related to irrigation systems, soil conditions, supported crops, and recorded sensor data. I cannot provide information about control commands, chemicals, financial matters, or other off-topic subjects.'
            });
        }

        // Fetch sensor data if needed (wrap in try-catch to handle DB errors gracefully)
        let sensorData = null;
        if (classification.intent !== 'general') {
            try {
                console.log('Fetching sensor data for intent:', classification.intent);
                sensorData = await fetchSensorData(classification.intent, classification.hours);
                console.log('Sensor data fetched:', sensorData ? 'Yes' : 'No');
            } catch (dbError) {
                console.warn('Could not fetch sensor data (continuing without it):', dbError.message);
                // Continue without sensor data - chatbot can still answer general questions
                sensorData = null;
            }
        }

        // Build system prompt
        const systemPrompt = buildSystemPrompt(classification.intent, sensorData);
        console.log('System prompt built, length:', systemPrompt.length);

        // Call OpenAI API
        console.log('Calling OpenAI API...');
        let openaiResponse;
        try {
            openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature: 0.3,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: question }
                    ]
                })
            });
            console.log('OpenAI response status:', openaiResponse.status);
        } catch (fetchError) {
            console.error('Failed to call OpenAI API:', fetchError.message);
            console.error('Fetch error details:', {
                name: fetchError.name,
                message: fetchError.message,
                stack: fetchError.stack
            });
            return res.status(500).json({
                response: 'Failed to connect to AI service. Please check your internet connection and try again.'
            });
        }

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json().catch(() => ({}));
            console.error('OpenAI API error:', openaiResponse.status, errorData);
            
            if (openaiResponse.status === 401) {
                return res.status(500).json({
                    response: 'Chatbot authentication failed. Please check your API key configuration.'
                });
            }
            
            if (openaiResponse.status === 429) {
                return res.status(500).json({
                    response: 'AI service is currently busy. Please try again in a moment.'
                });
            }
            
            return res.status(500).json({
                response: `I encountered an error processing your question (${openaiResponse.status}). Please try again later.`
            });
        }

        const openaiData = await openaiResponse.json();
        console.log('OpenAI response received');
        const reply = openaiData.choices?.[0]?.message?.content || 'I received your question, but I\'m having trouble processing it right now. Please try again.';

        console.log('Sending response to client');
        // Return response in the format expected by the frontend
        res.json({ response: reply });

    } catch (error) {
        console.error('Chatbot error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });
        res.status(500).json({
            response: `Sorry, I encountered an error: ${error.message}. Please check the server logs for details.`
        });
    }
});

module.exports = router;

