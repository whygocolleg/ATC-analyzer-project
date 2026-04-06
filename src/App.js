import { useState, useRef, useCallback } from 'react';
import MapView from './components/MapView';
import VideoPlayer from './components/VideoPlayer';
import UrlInput from './components/UrlInput';
import EventBadge from './components/EventBadge';
import './App.css';

const API = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
const SYNC_WINDOW = 2; // seconds

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [events, setEvents] = useState([]);

  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const mapRef = useRef(null);
  const playerRef = useRef(null);

  // ── Analyze ─────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (url) => {
    setError('');
    setLoading(true);
    setEvents([]);
    setActiveEvent(null);
    setVideoUrl(url);

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      const evts = data.events || [];
      setEvents(evts);

      // Fly to the first known coordinate immediately after analysis
      const firstGeo = evts.find(e => e.lat != null && e.lng != null);
      const focus = data.mapFocus?.coordinates || (firstGeo ? { lat: firstGeo.lat, lng: firstGeo.lng } : null);
      if (focus && mapRef.current) {
        mapRef.current.flyTo({
          center: [focus.lng, focus.lat],
          zoom: data.mapFocus?.zoom ?? 11,
          duration: 2000,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Video progress sync ──────────────────────────────────────────────────
  const handleProgress = useCallback(({ playedSeconds }) => {
    const match = events.find(e =>
      Math.abs(e.timestamp - playedSeconds) <= SYNC_WINDOW
    );

    if (match) {
      setActiveEvent(match);
    } else {
      setActiveEvent(null);
    }
  }, [events]);

  const severityCounts = events.reduce((acc, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        height: 48,
        background: 'rgba(15,23,42,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'monospace',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 2,
            background: '#2563eb',
            color: '#fff',
            padding: '2px 7px',
            borderRadius: 4,
          }}>ATC</span>
          <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Visualizer
          </span>
        </div>

        {/* URL Input */}
        <div style={{ flex: 1, maxWidth: 640 }}>
          <UrlInput onSubmit={handleAnalyze} loading={loading} />
        </div>

        {/* Event counts */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {severityCounts.HIGH > 0 && (
            <span style={badgeStyle('#ef4444')}>{severityCounts.HIGH} HIGH</span>
          )}
          {severityCounts.MEDIUM > 0 && (
            <span style={badgeStyle('#f59e0b')}>{severityCounts.MEDIUM} MED</span>
          )}
          {events.length > 0 && (
            <span style={badgeStyle('#22c55e')}>{events.length} events</span>
          )}
        </div>
      </header>

      {/* ── Map (full remaining area) ───────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView
          events={events}
          activeEvent={activeEvent}
          onEventClick={setActiveEvent}
          mapRef={mapRef}
        />

        {/* Error toast */}
        {error && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#7f1d1d',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 13,
            fontFamily: 'monospace',
            zIndex: 300,
            maxWidth: 480,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Empty state hint */}
        {!videoUrl && !loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✈</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              Paste a YouTube ATC video URL above to begin
            </div>
            <div style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
              Rule-based analysis · No API key required
            </div>
          </div>
        )}
      </div>

      {/* ── PIP Video player (fixed, top-right) ────────────────────────────── */}
      <VideoPlayer
        url={videoUrl}
        onProgress={handleProgress}
        playerRef={playerRef}
      />

      {/* ── Active event badge (bottom-center) ─────────────────────────────── */}
      <EventBadge event={activeEvent} />
    </div>
  );
}

function badgeStyle(color) {
  return {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    background: `${color}22`,
    color,
    border: `1px solid ${color}55`,
    whiteSpace: 'nowrap',
  };
}
