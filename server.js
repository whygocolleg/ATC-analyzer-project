const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));
app.use(express.json({ limit: '10mb' }));

// Lazy-load Anthropic to avoid startup error if SDK not installed
let anthropic = null;
function getClient() {
  if (!anthropic) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const SYSTEM_PROMPT = `You are an expert ATC (Air Traffic Control) instructor and aviation safety analyst with 20+ years of experience. Your role is to analyze ATC/pilot communication dialogs and extract incidents, safety issues, and educational insights for student pilots and trainee controllers.

CRITICAL: Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanatory text — pure JSON only.`;

function buildAnalysisPrompt(dialog) {
  return `Analyze this ATC/pilot communication dialog for aviation training purposes.

DIALOG:
${dialog}

Return ONLY a JSON object with this exact structure:
{
  "summary": "2-3 sentence description of the overall situation",
  "aircraftCallsign": "flight callsign or null",
  "airport": "airport ICAO code or name or null",
  "runways": ["list of runways mentioned"],
  "phase": "DEPARTURE | APPROACH | LANDING | TAXI | ENROUTE | EMERGENCY",
  "overallSeverity": "HIGH | MEDIUM | LOW",
  "incidents": [
    {
      "id": 1,
      "dialogText": "exact short quote from dialog showing this issue (max 120 chars)",
      "type": "EMERGENCY_DECLARATION | RUNWAY_INCURSION | WEATHER_DEVIATION | COMMUNICATION_ERROR | RUNWAY_CLOSURE | SEPARATION_ISSUE | EQUIPMENT_FAILURE | FUEL_ISSUE | MEDICAL_EMERGENCY | UNAUTHORIZED_ENTRY | OTHER",
      "severity": "HIGH | MEDIUM | LOW",
      "title": "4-6 word incident title",
      "description": "2-3 sentences explaining what happened and why it matters",
      "educationalNote": "2-3 sentences on what student pilots/controllers should learn from this",
      "atcBestPractice": "what ATC did well or should have done differently",
      "pilotBestPractice": "what the pilot did well or should have done differently",
      "relatedRegulation": "relevant FAA/ICAO regulation or null"
    }
  ],
  "keyLessons": ["lesson 1", "lesson 2", "lesson 3"],
  "communicationQuality": {
    "clarity": "HIGH | MEDIUM | LOW",
    "standardPhraseology": "HIGH | MEDIUM | LOW",
    "readbacks": "CORRECT | PARTIAL | MISSING | N/A"
  },
  "mapFocus": {
    "airportCode": "ICAO code or null",
    "coordinates": {"lat": 40.6413, "lng": -73.7781},
    "zoom": 13
  }
}`;
}

function extractJSON(text) {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned.trim());
}

app.post('/api/analyze-dialog', async (req, res) => {
  const { dialog } = req.body;

  if (!dialog || dialog.trim().length < 20) {
    return res.status(400).json({ error: 'Dialog text is too short' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in .env' });
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAnalysisPrompt(dialog) }],
    });

    // Find the text block (skip thinking blocks)
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock) {
      throw new Error('No text response received from Claude');
    }

    const analysis = extractJSON(textBlock.text);
    res.json(analysis);
  } catch (err) {
    console.error('[ATC Analyzer] Error:', err.message);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse Claude response as JSON. Try again.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: 'claude-opus-4-6', keySet: !!process.env.ANTHROPIC_API_KEY });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🛫  ATC Analyzer API  →  http://localhost:${PORT}`);
  console.log(`    ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ set' : '❌ NOT SET — add to .env'}`);
});
