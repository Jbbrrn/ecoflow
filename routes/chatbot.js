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
 * Determine if a question needs references or external sources
 * ALWAYS require citations for factual agricultural information
 */
function needsReferences(intent, question) {
    // ALWAYS require citations for these intents (factual information)
    const alwaysCiteIntents = [
        'crop_suitability',      // Crop recommendations are factual claims
        'irrigation_schedule',   // Irrigation advice comes from research
        'general'                // General questions often need sources
    ];
    
    if (alwaysCiteIntents.includes(intent)) {
        return true;
    }
    
    const lower = question.toLowerCase();
    
    // Questions that explicitly need references
    const referenceKeywords = [
        'research', 'study', 'studies', 'paper', 'article', 'publication',
        'best practices', 'recommendations', 'guide', 'how to',
        'reference', 'source', 'citation', 'where to find',
        'university', 'extension', 'government', 'official'
    ];
    
    return referenceKeywords.some(keyword => lower.includes(keyword));
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
                 AND timestamp <= NOW()
                 AND timestamp <= UTC_TIMESTAMP()
                 ORDER BY timestamp ASC`,
                [hours]
            );
            
            // Additional client-side filtering to ensure no future timestamps
            const now = new Date();
            const filteredRows = rows.filter(row => {
                const rowTime = new Date(row.timestamp);
                return rowTime <= now;
            });
            
            return filteredRows.length > 0 ? filteredRows : null;
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
                    return null; // Return null if timestamp is in the future
                }
            }
            
            return rows.length > 0 ? rows[0] : null;
        }
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        return null;
    }
}

/**
 * Build system prompt for OpenAI with enhanced reference handling
 */
function buildSystemPrompt(intent, sensorData, needsRefs = false) {
    let prompt = `You are an expert AI irrigation assistant for the Eco Flow smart greenhouse irrigation system, specifically designed for Filipino farmers and agricultural practitioners. 
Your role is to provide helpful, accurate, and actionable advice about irrigation, soil conditions, and crop management.

CRITICAL CITATION REQUIREMENT:
You MUST always cite sources when providing factual agricultural information. Every factual claim, recommendation, or piece of advice that is not based on the provided sensor data MUST include a citation with a clickable hyperlink.

IMPORTANT RULES:
1. Only answer questions related to irrigation systems, soil conditions, supported crops, and recorded sensor data.
2. Do NOT provide commands to control pumps, valves, or any hardware.
3. Do NOT answer questions about fertilizers, pesticides, herbicides, or chemicals.
4. Do NOT answer questions about financial matters, medical advice, or weather forecasts.
5. Respond in the same language as the user's question (English or Filipino/Tagalog).
6. Use clear, concise language with short paragraphs and bullet points when appropriate.
7. If sensor data is provided, use it to give accurate answers. Do not invent sensor values.
8. Format your response as HTML with proper tags (p, ul, li, strong, a, h3, h4) for better readability.
9. ALWAYS include clickable hyperlinks when citing sources. Format links as: <a href="https://da.gov.ph" target="_blank" rel="noopener noreferrer">Department of Agriculture</a>
10. For factual claims (crop suitability, irrigation schedules, best practices), you MUST cite where this information comes from.

MANDATORY CITATION GUIDELINES:
- When recommending crops: Cite which organization/research institute recommends these crops with a clickable link
- When providing irrigation schedules: Cite the source of irrigation guidelines with a clickable link
- When giving best practices: Cite the agricultural extension service or research institution with a clickable link
- When answering "what crops are suitable": You MUST include citations with clickable links - this information comes from agricultural research
- Links MUST be clickable and properly formatted HTML anchor tags
- Always use full URLs with https:// (e.g., https://da.gov.ph, not just "da.gov.ph")
- Include at least 1-2 source citations per response when providing factual agricultural information

RECOMMENDED FILIPINO AGRICULTURAL SOURCES (use these for citations with clickable links):
- Department of Agriculture (DA): https://da.gov.ph
- Bureau of Agricultural Research (BAR): https://bar.gov.ph
- Philippine Rice Research Institute (PhilRice): https://philrice.gov.ph
- International Rice Research Institute (IRRI): https://irri.org
- Agricultural Training Institute (ATI): https://ati.da.gov.ph
- Bureau of Plant Industry (BPI): https://bpi.da.gov.ph
- Philippine Council for Agriculture, Aquatic and Natural Resources Research and Development (PCAARRD): https://pcarrd.dost.gov.ph
- University of the Philippines Los Baños (UPLB): https://uplb.edu.ph

EXAMPLE CITATION FORMATS (use these patterns):
- "According to the <a href="https://da.gov.ph" target="_blank" rel="noopener noreferrer">Department of Agriculture</a>, suitable crops for your conditions include..."
- "The <a href="https://philrice.gov.ph" target="_blank" rel="noopener noreferrer">Philippine Rice Research Institute</a> recommends irrigation schedules of..."
- "Based on research from <a href="https://bar.gov.ph" target="_blank" rel="noopener noreferrer">Bureau of Agricultural Research</a>, best practices include..."
- "For more information, visit the <a href="https://ati.da.gov.ph" target="_blank" rel="noopener noreferrer">Agricultural Training Institute</a> website."

Current Intent: ${intent}
`;

    if (sensorData) {
        if (Array.isArray(sensorData)) {
            prompt += `\nHistorical Sensor Data (${sensorData.length} readings over the requested time period):\n${JSON.stringify(sensorData, null, 2)}`;
        } else {
            prompt += `\nLatest Sensor Data:\n${JSON.stringify(sensorData, null, 2)}`;
        }
        prompt += `\n\nNote: When using sensor data, you can reference it directly. For any additional agricultural advice beyond sensor data, you MUST cite sources with clickable hyperlinks.`;
    } else {
        prompt += `\nNote: No sensor data is currently available. All agricultural advice MUST be cited with sources and include clickable hyperlinks.`;
    }

    if (needsRefs || intent === 'crop_suitability' || intent === 'irrigation_schedule') {
        prompt += `\n\nMANDATORY: The user's question requires factual agricultural information. You MUST cite sources for all recommendations, crop suggestions, and irrigation advice. Include clickable hyperlinks to Filipino agricultural resources. Do not provide information without citations. Every factual claim must have a source link.`;
    }

    return prompt;
}

/**
 * POST /api/chatbot
 * Chatbot endpoint that uses OpenAI Chat Completions API with optional web search
 */
router.post('/chatbot', async (req, res) => {
    try {
        const question = (req.body.question || req.body.message || '').trim();
        
        if (!question) {
            return res.status(400).json({ 
                response: 'Please provide a question.' 
            });
        }

        // Check if OpenAI API key is configured
        if (!OPENAI_API_KEY) {
            return res.status(500).json({
                response: 'Chatbot service is not configured. Please contact the administrator.'
            });
        }

        // Check for forbidden topics
        const classification = classifyQuestion(question);
        
        if (classification.forbidden) {
            return res.json({
                response: 'I can only answer questions related to irrigation systems, soil conditions, supported crops, and recorded sensor data. I cannot provide information about control commands, chemicals, financial matters, or other off-topic subjects.'
            });
        }

        // Fetch sensor data if needed
        let sensorData = null;
        if (classification.intent !== 'general') {
            try {
                sensorData = await fetchSensorData(classification.intent, classification.hours);
            } catch (dbError) {
                console.warn('Could not fetch sensor data (continuing without it):', dbError.message);
                sensorData = null;
            }
        }

        // Check if question needs references
        const needsRefs = needsReferences(classification.intent, question);

        // Build system prompt with enhanced reference handling
        const systemPrompt = buildSystemPrompt(classification.intent, sensorData, needsRefs);

        // Call OpenAI Chat Completions API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json().catch(() => ({}));
            
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
        const reply = openaiData.choices?.[0]?.message?.content || 'I received your question, but I\'m having trouble processing it right now. Please try again.';

        res.json({ response: reply });

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({
            response: `Sorry, I encountered an error: ${error.message}. Please try again later.`
        });
    }
});

module.exports = router;

