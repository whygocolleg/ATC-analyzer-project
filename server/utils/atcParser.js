/**
 * atcParser.js — Rule-based ATC transcript event extractor
 * Parses transcript segments into events with timestamps and coordinates.
 */

// ── Airport coordinate lookup table ─────────────────────────────────────────
const AIRPORT_COORDS = {
  // North America
  KJFK: { lat: 40.6413, lng: -73.7781, name: 'JFK' },
  KLAX: { lat: 33.9425, lng: -118.4081, name: 'LAX' },
  KORD: { lat: 41.9742, lng: -87.9073, name: 'ORD' },
  KATL: { lat: 33.6407, lng: -84.4277, name: 'ATL' },
  KDFW: { lat: 32.8998, lng: -97.0403, name: 'DFW' },
  KDEN: { lat: 39.8561, lng: -104.6737, name: 'DEN' },
  KSFO: { lat: 37.6213, lng: -122.379, name: 'SFO' },
  KSEA: { lat: 47.4502, lng: -122.3088, name: 'SEA' },
  KLAS: { lat: 36.084, lng: -115.1537, name: 'LAS' },
  KMIA: { lat: 25.7959, lng: -80.287, name: 'MIA' },
  KBOS: { lat: 42.3656, lng: -71.0096, name: 'BOS' },
  KEWR: { lat: 40.6895, lng: -74.1745, name: 'EWR' },
  KLGA: { lat: 40.7769, lng: -73.874, name: 'LGA' },
  KPHL: { lat: 39.8744, lng: -75.2424, name: 'PHL' },
  KIAH: { lat: 29.9902, lng: -95.3368, name: 'IAH' },
  KPHX: { lat: 33.4373, lng: -112.0078, name: 'PHX' },
  KMSP: { lat: 44.8848, lng: -93.2223, name: 'MSP' },
  KDTW: { lat: 42.2162, lng: -83.3554, name: 'DTW' },
  KBWI: { lat: 39.1754, lng: -76.6683, name: 'BWI' },
  KIAD: { lat: 38.9531, lng: -77.4565, name: 'IAD' },
  KMDW: { lat: 41.7868, lng: -87.7522, name: 'MDW' },
  KSLC: { lat: 40.7884, lng: -111.9778, name: 'SLC' },
  KSMF: { lat: 38.6954, lng: -121.5908, name: 'SMF' },
  KSAN: { lat: 32.7336, lng: -117.1897, name: 'SAN' },
  KHOU: { lat: 29.6454, lng: -95.2789, name: 'HOU' },
  KCVG: { lat: 39.0488, lng: -84.6678, name: 'CVG' },
  KSTL: { lat: 38.7487, lng: -90.37, name: 'STL' },
  KPIT: { lat: 40.4915, lng: -80.2329, name: 'PIT' },
  KPDX: { lat: 45.5898, lng: -122.5951, name: 'PDX' },
  KMCO: { lat: 28.4312, lng: -81.3081, name: 'MCO' },
  KFLL: { lat: 26.0726, lng: -80.1527, name: 'FLL' },
  KTPA: { lat: 27.9755, lng: -82.5332, name: 'TPA' },
  KBNA: { lat: 36.1245, lng: -86.6782, name: 'BNA' },
  KRDU: { lat: 35.8801, lng: -78.7875, name: 'RDU' },
  KAUS: { lat: 30.1975, lng: -97.6664, name: 'AUS' },
  KCLT: { lat: 35.214, lng: -80.9431, name: 'CLT' },
  KMEM: { lat: 35.0424, lng: -89.9767, name: 'MEM' },
  KBUF: { lat: 42.9405, lng: -78.7322, name: 'BUF' },
  KSNA: { lat: 33.6757, lng: -117.8682, name: 'SNA' },
  KONT: { lat: 34.056, lng: -117.6012, name: 'ONT' },
  KSDF: { lat: 38.1744, lng: -85.7360, name: 'SDF' },
  KOMA: { lat: 41.3032, lng: -95.8941, name: 'OMA' },
  KRIC: { lat: 37.5052, lng: -77.3197, name: 'RIC' },
  KCMH: { lat: 39.9980, lng: -82.8919, name: 'CMH' },
  KIND: { lat: 39.7173, lng: -86.2944, name: 'IND' },
  // International
  EGLL: { lat: 51.4775, lng: -0.4614, name: 'LHR' },
  EGKK: { lat: 51.1537, lng: -0.1821, name: 'LGW' },
  LFPG: { lat: 49.0097, lng: 2.5479, name: 'CDG' },
  EDDF: { lat: 50.0379, lng: 8.5622, name: 'FRA' },
  EHAM: { lat: 52.3086, lng: 4.7639, name: 'AMS' },
  LEMD: { lat: 40.4983, lng: -3.5676, name: 'MAD' },
  LIRF: { lat: 41.8003, lng: 12.2389, name: 'FCO' },
  LSZH: { lat: 47.4647, lng: 8.5492, name: 'ZRH' },
  LOWW: { lat: 48.1103, lng: 16.5697, name: 'VIE' },
  LEBL: { lat: 41.2971, lng: 2.0785, name: 'BCN' },
  OMDB: { lat: 25.2532, lng: 55.3657, name: 'DXB' },
  VHHH: { lat: 22.3089, lng: 113.9145, name: 'HKG' },
  RJTT: { lat: 35.5494, lng: 139.7798, name: 'HND' },
  RJAA: { lat: 35.7653, lng: 140.3864, name: 'NRT' },
  RKSI: { lat: 37.4602, lng: 126.4407, name: 'ICN' },
  WSSS: { lat: 1.3644, lng: 103.9915, name: 'SIN' },
  YSSY: { lat: -33.9461, lng: 151.177, name: 'SYD' },
  YMML: { lat: -37.6733, lng: 144.8433, name: 'MEL' },
  ZBAA: { lat: 40.0799, lng: 116.6031, name: 'PEK' },
  ZSPD: { lat: 31.1443, lng: 121.8083, name: 'PVG' },
  CYVR: { lat: 49.1967, lng: -123.1815, name: 'YVR' },
  CYYZ: { lat: 43.6777, lng: -79.6248, name: 'YYZ' },
  CYUL: { lat: 45.4706, lng: -73.7408, name: 'YUL' },
  SBGR: { lat: -23.4356, lng: -46.4731, name: 'GRU' },
  MMMX: { lat: 19.4363, lng: -99.0721, name: 'MEX' },
};

// Short-name aliases (IATA + common spoken names) → ICAO
const AIRPORT_ALIASES = {};
for (const [icao, info] of Object.entries(AIRPORT_COORDS)) {
  AIRPORT_ALIASES[info.name.toLowerCase()] = icao;
  AIRPORT_ALIASES[icao.toLowerCase()] = icao;
}
// Extra spoken aliases
const SPOKEN_ALIASES = {
  'john f kennedy': 'KJFK', 'kennedy': 'KJFK',
  'los angeles': 'KLAX',
  "o'hare": 'KORD', 'ohare': 'KORD', "o hare": 'KORD',
  'hartsfield': 'KATL', 'atlanta': 'KATL',
  'dallas fort worth': 'KDFW', 'dallas': 'KDFW',
  'denver': 'KDEN',
  'san francisco': 'KSFO',
  'seattle': 'KSEA', 'tacoma': 'KSEA',
  'las vegas': 'KLAS',
  'miami': 'KMIA',
  'boston': 'KBOS', 'logan': 'KBOS',
  'newark': 'KEWR',
  'laguardia': 'KLGA', 'la guardia': 'KLGA',
  'philadelphia': 'KPHL',
  'houston': 'KIAH',
  'phoenix': 'KPHX',
  'minneapolis': 'KMSP',
  'detroit': 'KDTW',
  'washington': 'KIAD', 'dulles': 'KIAD',
  'heathrow': 'EGLL', 'london': 'EGLL',
  'charles de gaulle': 'LFPG', 'paris': 'LFPG',
  'frankfurt': 'EDDF',
  'amsterdam': 'EHAM', 'schiphol': 'EHAM',
  'dubai': 'OMDB',
  'hong kong': 'VHHH',
  'tokyo': 'RJTT', 'haneda': 'RJTT',
  'narita': 'RJAA',
  'incheon': 'RKSI', 'seoul': 'RKSI',
  'singapore': 'WSSS', 'changi': 'WSSS',
  'sydney': 'YSSY',
  'melbourne': 'YMML',
  'beijing': 'ZBAA',
  'shanghai': 'ZSPD',
  'vancouver': 'CYVR',
  'toronto': 'CYYZ', 'pearson': 'CYYZ',
  'montreal': 'CYUL',
};
for (const [alias, icao] of Object.entries(SPOKEN_ALIASES)) {
  AIRPORT_ALIASES[alias] = icao;
}

// Default fallback airport when none detected
const FALLBACK_AIRPORT = AIRPORT_COORDS['KJFK'];

// ── Event detection rules ────────────────────────────────────────────────────
const RULES = [
  {
    id: 'EMERGENCY_DECLARATION',
    severity: 'HIGH',
    patterns: [/\bmayday\b/i, /\bpan[- ]pan\b/i, /\bdeclare[ds]?\s+emergency\b/i, /\bemergency\b/i],
    keyword: 'Emergency',
  },
  {
    id: 'RUNWAY_INCURSION',
    severity: 'HIGH',
    patterns: [/\bstop[p]?\s+immediately\b/i, /\bhalt\b/i, /\bgo[- ]around\b/i, /\babort\s+(?:take[- ]?off|landing)\b/i, /runway\s+incursion/i],
    keyword: 'Runway Incursion',
  },
  {
    id: 'TRAFFIC_ALERT',
    severity: 'HIGH',
    patterns: [/\btraffic\s+alert\b/i, /\bTCAS\b/i, /\bresolution\s+advisory\b/i, /\bconflict\b/i],
    keyword: 'Traffic Alert',
  },
  {
    id: 'GO_AROUND',
    severity: 'MEDIUM',
    patterns: [/\bgo[- ]around\b/i, /\bmissed\s+approach\b/i],
    keyword: 'Go-Around',
  },
  {
    id: 'WEATHER_DEVIATION',
    severity: 'MEDIUM',
    patterns: [/\bdeviat\w+\s+(?:for|due to)\s+weather\b/i, /\bwind\s+shear\b/i, /\bmicroburst\b/i, /\bturbulence\b/i, /\bicing\b/i],
    keyword: 'Weather',
  },
  {
    id: 'COMMUNICATION_ERROR',
    severity: 'MEDIUM',
    patterns: [/\bsay\s+again\b/i, /\bunable\s+to\s+(?:read|hear|copy)\b/i, /\bwrong\s+(?:frequency|freq)\b/i, /\bnegative\s+contact\b/i],
    keyword: 'Comms Issue',
  },
  {
    id: 'RUNWAY_CLEARANCE',
    severity: 'LOW',
    patterns: [/\bcleared\s+(?:for\s+)?(?:take[- ]?off|landing|approach|ils)\b/i, /\bline\s+up\s+and\s+wait\b/i],
    keyword: 'Clearance',
  },
  {
    id: 'FREQUENCY_CHANGE',
    severity: 'LOW',
    patterns: [/\bcontact\s+\w+\s+on\b/i, /\bfrequency\s+change\b/i, /\bswitch\s+(?:to|over)\b/i],
    keyword: 'Freq Change',
  },
];

// ── Flight phase detection ───────────────────────────────────────────────────
function detectFlightPhase(text, ruleId) {
  if (ruleId === 'EMERGENCY_DECLARATION') return 'EMERGENCY';
  if (ruleId === 'GO_AROUND')             return 'GO_AROUND';
  if (/cleared.*take.?off|line.?up.*wait|position.*hold/i.test(text)) return 'TAKEOFF';
  if (/take.?off roll|rotate\b|v1\b|vr\b/i.test(text))               return 'TAKEOFF';
  if (/cleared.*(?:ils|rnav|rnp|approach)|established.*(?:ils|loc)/i.test(text)) return 'APPROACH';
  if (/cleared.*land|short.*final|on.*final/i.test(text))             return 'LANDING';
  if (/touch.?down|landed|vacate/i.test(text))                        return 'LANDING';
  if (/climb|maintain.*(?:flight level|fl\s*\d|feet|ft\b)/i.test(text)) return 'AIRBORNE';
  if (/descend|descending|passing.*\d{3}/i.test(text))                return 'DESCENDING';
  if (/taxi|pushback|gate|apron|ground.*control/i.test(text))         return 'TAXI';
  return 'GROUND';
}

// ── Vehicle detection ────────────────────────────────────────────────────────
function detectVehicles(text) {
  const v = ['aircraft'];
  if (/fire.?(?:truck|engine|crew|dept)|arff|crash.*fire|foam/i.test(text)) v.push('fire_truck');
  if (/ambulance|medical|paramedic|medevac/i.test(text))               v.push('ambulance');
  if (/police|security|law enforcement/i.test(text))                   v.push('police');
  return v;
}

// ── Runway heading extraction ─────────────────────────────────────────────────
function detectRunwayHeading(text) {
  const m = text.match(/runway\s+(\d{1,2})[LRC]?/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 36) return n * 10;
  }
  return 315; // default NW
}

// ── Airport detection from text ──────────────────────────────────────────────
function detectAirport(text) {
  const lower = text.toLowerCase();

  // Check multi-word spoken aliases first (longest match wins)
  const sortedAliases = Object.keys(AIRPORT_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (lower.includes(alias)) {
      const icao = AIRPORT_ALIASES[alias];
      return AIRPORT_COORDS[icao] || null;
    }
  }
  return null;
}

// ── Main parser ──────────────────────────────────────────────────────────────
/**
 * Parse transcript segments into ATC events.
 *
 * @param {Array<{ start: number, end: number, text: string }>} segments
 * @returns {{ events: Array, mapFocus: object }}
 */
function parseEvents(segments) {
  const events = [];
  let globalAirport = null;

  // First pass: detect airport from full transcript
  const fullText = segments.map(s => s.text).join(' ');
  globalAirport = detectAirport(fullText) || FALLBACK_AIRPORT;

  // Build mapFocus from detected airport
  const mapFocus = {
    coordinates: { lat: globalAirport.lat, lng: globalAirport.lng },
    zoom: 12,
  };

  // Second pass: generate events per segment
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;

    // Per-segment airport refinement (might mention specific airport)
    const segAirport = detectAirport(text) || globalAirport;

    for (const rule of RULES) {
      const matched = rule.patterns.some(p => p.test(text));
      if (!matched) continue;

      events.push({
        id: `evt_${seg.start.toFixed(0)}_${rule.id}`,
        timestamp: seg.start,
        keyword: rule.keyword,
        severity: rule.severity,
        description: text.length > 150 ? text.slice(0, 147) + '…' : text,
        lat: segAirport.lat,
        lng: segAirport.lng,
        flightPhase: detectFlightPhase(text, rule.id),
        vehicles: detectVehicles(text),
        runwayHeading: detectRunwayHeading(text),
      });

      // Only emit one event per segment (highest-priority rule wins)
      break;
    }
  }

  // Deduplicate: keep only the highest-severity event per 3-second window
  const deduped = [];
  const DEDUP_WINDOW = 3;
  for (const evt of events) {
    const overlap = deduped.find(e => Math.abs(e.timestamp - evt.timestamp) < DEDUP_WINDOW);
    if (!overlap) {
      deduped.push(evt);
    } else {
      const severityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if ((severityRank[evt.severity] || 0) > (severityRank[overlap.severity] || 0)) {
        deduped.splice(deduped.indexOf(overlap), 1, evt);
      }
    }
  }

  return { events: deduped, mapFocus };
}

module.exports = { parseEvents, AIRPORT_COORDS, detectAirport };
