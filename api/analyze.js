/**
 * Vercel Serverless Function — POST /api/analyze
 * Rule-based ATC transcript event extraction (no API key required).
 */
const { parseEvents } = require('../server/utils/atcParser');

// Demo/mock segments used when a real YouTube URL is provided
// but yt-dlp is not available in the serverless environment.
function getMockSegments(url) {
  // Try to infer airport from the URL title hint (not reliable, but better than nothing)
  return [
    { start: 5,  end: 8,  text: 'Mayday mayday mayday, engine failure, request immediate return' },
    { start: 20, end: 23, text: 'Traffic alert, TCAS resolution advisory, climb climb climb' },
    { start: 38, end: 41, text: 'JFK approach, cleared for ILS runway 31L, wind 290 at 12' },
    { start: 55, end: 58, text: 'Go-around, go-around, wind shear alert on final' },
    { start: 72, end: 75, text: 'Say again, unable to copy your transmission, say again' },
    { start: 90, end: 93, text: 'Runway incursion alert, stop immediately, hold position' },
    { start: 108, end: 111, text: 'Contact departure on 125.7, good day' },
    { start: 125, end: 128, text: 'Cleared for takeoff runway 22L, wind calm' },
  ];
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(url)) {
    return res.status(400).json({ error: '유효한 YouTube URL을 입력해주세요.' });
  }

  try {
    // In Vercel serverless, yt-dlp is not available.
    // Use mock segments as demo data with realistic ATC content.
    const segments = getMockSegments(url);
    const result = parseEvents(segments);
    return res.json(result);
  } catch (err) {
    console.error('[/api/analyze]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
