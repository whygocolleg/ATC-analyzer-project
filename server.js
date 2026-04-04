const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));
app.use(express.json({ limit: '10mb' }));

// ── Database ────────────────────────────────────────────────────────────────
const db = require('./server/db');

// ── YouTube 분석 유틸 ────────────────────────────────────────────────────────
const { parseEvents } = require('./server/utils/atcParser');

// ── Anthropic client (lazy-loaded) ──────────────────────────────────────────
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
  "suggestedCategory": "Emergency | Runway Incursion | Weather | Communication | Separation | Go-Around | General Training",
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
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned.trim());
}

// ══════════════════════════════════════════════════════════════════════════════
//  API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Analyze YouTube URL (rule-based, no API key required) ───────────────────
// POST /api/analyze  { url: string }
// Returns { events: [...], mapFocus: { coordinates, zoom } }
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(url)) {
    return res.status(400).json({ error: '유효한 YouTube URL을 입력해주세요.' });
  }

  // Dynamically require yt-dlp / caption tools only when needed
  let ytDlp, parseVtt, cleanupFile;
  try {
    ({ extractMedia: ytDlp, parseVtt, cleanupFile } = require('./server/utils/audioExtractor'));
  } catch (_) {
    // audioExtractor not available — return mock events for dev/demo
    const mockSegments = [
      { start: 5,  end: 8,  text: 'Mayday mayday mayday, engine failure' },
      { start: 20, end: 23, text: 'Traffic alert, TCAS resolution advisory' },
      { start: 45, end: 48, text: 'Cleared for ILS approach runway 31L' },
      { start: 70, end: 73, text: 'Go-around, go-around, wind shear alert' },
      { start: 95, end: 98, text: 'Say again, unable to copy your transmission' },
    ];
    const result = parseEvents(mockSegments);
    return res.json(result);
  }

  let mediaPath = null;
  try {
    const media = await ytDlp(url);
    mediaPath = media.filePath;

    if (media.type !== 'subtitle') {
      throw new Error('이 영상에는 자동 자막이 없습니다. 자막(CC)이 있는 ATC 영상을 사용해주세요.');
    }

    const segments = parseVtt(mediaPath);
    const result = parseEvents(segments);
    res.json(result);
  } catch (err) {
    console.error('[/api/analyze] 오류:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (cleanupFile && mediaPath) cleanupFile(mediaPath);
  }
});

// ── Analyze dialog (Claude AI) + auto-save ──────────────────────────────────
app.post('/api/analyze-dialog', async (req, res) => {
  const { dialog, sourceUrl, sourceType, title, categoryId, save } = req.body;

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

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock) {
      throw new Error('No text response received from Claude');
    }

    const analysis = extractJSON(textBlock.text);

    // Auto-save to database if save !== false
    let savedRecord = null;
    if (save !== false) {
      try {
        // Auto-detect category from suggestedCategory
        let resolvedCategoryId = categoryId;
        if (!resolvedCategoryId && analysis.suggestedCategory) {
          const categories = db.listCategories();
          const match = categories.find(c =>
            c.name.toLowerCase() === analysis.suggestedCategory.toLowerCase()
          );
          if (match) resolvedCategoryId = match.id;
        }

        savedRecord = db.saveAnalysis({
          dialogText: dialog,
          analysis,
          sourceUrl,
          sourceType: sourceType || 'manual',
          title,
          categoryId: resolvedCategoryId,
        });
      } catch (dbErr) {
        console.error('[DB] Save error (non-fatal):', dbErr.message);
      }
    }

    res.json({
      ...analysis,
      _saved: savedRecord ? { id: savedRecord.id, title: savedRecord.title } : null,
    });
  } catch (err) {
    console.error('[ATC Analyzer] Error:', err.message);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse Claude response as JSON. Try again.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── Saved analyses (CRUD) ───────────────────────────────────────────────────

// List all analyses (optionally filter by category)
app.get('/api/analyses', (_req, res) => {
  try {
    const categoryId = _req.query.category || null;
    const analyses = db.listAnalyses(categoryId);
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single analysis with full data
app.get('/api/analyses/:id', (req, res) => {
  try {
    const record = db.getAnalysis(req.params.id);
    if (!record) return res.status(404).json({ error: 'Analysis not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete analysis
app.delete('/api/analyses/:id', (req, res) => {
  try {
    db.deleteAnalysis(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update analysis category
app.patch('/api/analyses/:id/category', (req, res) => {
  try {
    const { categoryId } = req.body;
    db.updateCategory(req.params.id, categoryId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search analyses
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const results = db.searchAnalyses(q.trim());
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Categories ──────────────────────────────────────────────────────────────

app.get('/api/categories', (_req, res) => {
  try {
    res.json(db.listCategories());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, description, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });
    const category = db.createCategory({ name, description, icon, color });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Study progress ──────────────────────────────────────────────────────────

app.post('/api/analyses/:id/progress', (req, res) => {
  try {
    const { completed, notes, rating } = req.body;
    db.saveStudyProgress(req.params.id, { completed, notes, rating });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analyses/:id/progress', (req, res) => {
  try {
    const progress = db.getStudyProgress(req.params.id);
    res.json(progress || { completed: false, notes: null, rating: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats ───────────────────────────────────────────────────────────────────

app.get('/api/stats', (_req, res) => {
  try {
    res.json(db.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube 분석 파이프라인 ───────────────────────────────────────────────────
// POST /api/analyze-youtube  { youtubeUrl: string }
// 1) yt-dlp로 오디오 추출 → 2) Whisper로 트랜스크립트 → 3) GPT로 구조화 JSON 반환
app.post('/api/analyze-youtube', async (req, res) => {
  const { youtubeUrl } = req.body;

  if (!youtubeUrl || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(youtubeUrl)) {
    return res.status(400).json({ error: '유효한 YouTube URL을 입력해주세요.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: '.env에 ANTHROPIC_API_KEY가 설정되지 않았습니다.' });
  }

  // videoId 추출
  let videoId = 'unknown';
  try {
    const url = new URL(youtubeUrl);
    videoId = url.searchParams.get('v') || url.pathname.replace('/', '');
  } catch (_) {}

  let mediaPath = null;
  try {
    // 단계 1: 자막 우선 시도 → 없으면 오디오 추출
    console.log(`[YouTube] 미디어 추출 시작: ${youtubeUrl}`);
    const media = await extractMedia(youtubeUrl);
    mediaPath = media.filePath;
    console.log(`[YouTube] 추출 완료 (${media.type}): ${mediaPath}`);

    // 단계 2: 세그먼트 생성 (자막만 지원 — Whisper 미사용)
    if (media.type !== 'subtitle') {
      throw new Error('이 영상에는 자동 자막이 없습니다. 자막(CC)이 있는 ATC 영상을 사용해주세요.');
    }
    const segments = parseVtt(mediaPath);
    console.log(`[YouTube] 자막 파싱 완료 (${segments.length}개 세그먼트)`);

    // 단계 3: Claude로 구조화
    console.log('[YouTube] Claude 구조화 분석 시작...');
    const structured = await structureTranscript(segments, videoId);
    console.log('[YouTube] 분석 완료');

    res.json(structured);
  } catch (err) {
    console.error('[YouTube] 분석 오류:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    cleanupFile(mediaPath);
  }
});

// ── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: 'claude-opus-4-6',
    keySet: !!process.env.ANTHROPIC_API_KEY,
    database: 'sqlite',
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ATC Analyzer API  ->  http://localhost:${PORT}`);
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET -- add to .env'}`);
  console.log(`  Database: SQLite (data/atc.db)`);
});
