import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Map, Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  analyzeDialog,
  fetchAnalyses,
  fetchAnalysis,
  deleteAnalysis,
  fetchCategories,
  searchAnalyses,
  getIncidentMarkerPositions,
  INCIDENT_COLORS,
  SEVERITY_COLORS,
} from '../services/atcAnalyzer';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// ── Sample dialog pre-loaded for demo ──────────────────────────────────────
const SAMPLE_DIALOG = `JFK Tower: JetBlue 2892, winds 040 at 8, runway 4 Right cleared to land.
JBU2892: Cleared to land 4 Right, JetBlue 2892. Tower, we may need to declare an emergency — we have a massive fuel imbalance.
JFK Tower: JetBlue 2892, say again — are you declaring an emergency?
JBU2892: Affirmative, JetBlue 2892 declaring emergency. Fuel imbalance issue on the left side.
JFK Tower: JetBlue 2892, emergency declared. ARFF is standing by on runway 4 Right. Wind 040 at 8, cleared to land.
JBU2892: Cleared to land 4 Right, JetBlue 2892. Request ARFF check left engine for fuel leak after landing.
JFK Tower: JetBlue 2892, ARFF will check left side. Traffic behind you is a 737, 5 miles final.
JBU2892: JetBlue 2892, we're on the ground. Looks like fuel on the left wing.
JFK Tower: JetBlue 2892, exit at taxiway Delta if able. All traffic, runway 4 Right is now closed — fuel contamination. Expect delays, stand by for revised routing.`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function btnStyle(bg, textColor, active = true) {
  return {
    padding: '8px 18px',
    backgroundColor: active ? bg : '#1a1a1a',
    color: active ? textColor : '#444',
    border: `2px solid ${active ? bg : '#333'}`,
    borderRadius: '4px',
    cursor: active ? 'pointer' : 'not-allowed',
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    transition: 'all 0.2s',
  };
}

function badge(color, size = '11px') {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: `${color}22`,
    color,
    border: `1px solid ${color}66`,
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: size,
    fontWeight: 'bold',
  };
}

// ── Dialog with highlighted incident spans ───────────────────────────────────

function HighlightedDialog({ dialogText, incidents, selectedId, onSelect }) {
  if (!incidents || incidents.length === 0) {
    return (
      <pre style={{ color: '#aaa', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
        {dialogText}
      </pre>
    );
  }

  const highlights = [];
  incidents.forEach((inc) => {
    if (!inc.dialogText) return;
    const idx = dialogText.indexOf(inc.dialogText);
    if (idx !== -1) {
      highlights.push({ start: idx, end: idx + inc.dialogText.length, inc });
    }
  });
  highlights.sort((a, b) => a.start - b.start);

  const segments = [];
  let pos = 0;
  for (const h of highlights) {
    if (h.start > pos) segments.push({ text: dialogText.slice(pos, h.start), inc: null });
    segments.push({ text: dialogText.slice(h.start, h.end), inc: h.inc });
    pos = h.end;
  }
  if (pos < dialogText.length) segments.push({ text: dialogText.slice(pos), inc: null });

  return (
    <pre style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: 2, whiteSpace: 'pre-wrap', margin: 0, color: '#aaa' }}>
      {segments.map((seg, i) => {
        if (!seg.inc) return <span key={i}>{seg.text}</span>;
        const color = INCIDENT_COLORS[seg.inc.type] || '#00ffaa';
        const isSelected = selectedId === seg.inc.id;
        return (
          <span
            key={i}
            onClick={() => onSelect(seg.inc.id)}
            title={`#${seg.inc.id} ${seg.inc.title}`}
            style={{
              backgroundColor: isSelected ? color : `${color}33`,
              color: isSelected ? '#000' : color,
              border: `1px solid ${color}`,
              borderRadius: '3px',
              padding: '0 3px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.15s',
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </pre>
  );
}

// ── History Sidebar ─────────────────────────────────────────────────────────

function HistorySidebar({ onLoadAnalysis, currentAnalysisId }) {
  const [analyses, setAnalyses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [analysesData, categoriesData] = await Promise.all([
        fetchAnalyses(selectedCategory),
        fetchCategories(),
      ]);
      setAnalyses(analysesData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh when a new analysis is saved
  useEffect(() => {
    if (currentAnalysisId) loadData();
  }, [currentAnalysisId, loadData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await searchAnalyses(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this analysis?')) return;
    try {
      await deleteAnalysis(id);
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const displayList = searchResults || analyses;

  return (
    <div style={{
      width: '280px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '2px solid #222',
      backgroundColor: '#0d0d0d',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '2px solid #222', backgroundColor: '#111' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#00ff00', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '2px' }}>
          SAVED ANALYSES
        </h3>

        {/* Search */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search..."
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: '#1a1a1a',
              color: '#ccc',
              border: '1px solid #333',
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: '11px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '6px 10px',
              backgroundColor: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '11px',
            }}
          >
            Search
          </button>
        </div>

        {/* Category filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <button
            onClick={() => { setSelectedCategory(null); setSearchResults(null); }}
            style={{
              padding: '3px 8px',
              backgroundColor: !selectedCategory ? '#00ff00' : '#1a1a1a',
              color: !selectedCategory ? '#000' : '#666',
              border: `1px solid ${!selectedCategory ? '#00ff00' : '#333'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 'bold',
            }}
          >
            ALL
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setSearchResults(null); }}
              style={{
                padding: '3px 8px',
                backgroundColor: selectedCategory === cat.id ? cat.color : '#1a1a1a',
                color: selectedCategory === cat.id ? '#000' : cat.color,
                border: `1px solid ${selectedCategory === cat.id ? cat.color : '#333'}`,
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
              title={cat.description}
            >
              {cat.icon} {cat.name} ({cat.analysis_count})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {loading && (
          <div style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace', textAlign: 'center', padding: '20px' }}>
            Loading...
          </div>
        )}

        {!loading && displayList.length === 0 && (
          <div style={{ color: '#444', fontSize: '12px', fontFamily: 'monospace', textAlign: 'center', padding: '20px', lineHeight: 1.6 }}>
            {searchResults !== null ? 'No results found' : 'No saved analyses yet.\nAnalyze a dialog to get started!'}
          </div>
        )}

        {displayList.map(item => {
          const isCurrent = currentAnalysisId === item.id;
          const sevColor = SEVERITY_COLORS[item.overall_severity] || '#666';
          return (
            <div
              key={item.id}
              onClick={() => onLoadAnalysis(item.id)}
              style={{
                padding: '10px 12px',
                marginBottom: '6px',
                backgroundColor: isCurrent ? '#1a2a1a' : '#111',
                border: `1px solid ${isCurrent ? '#00ff00' : '#222'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ color: '#ccc', fontSize: '12px', fontWeight: 'bold', lineHeight: 1.3, flex: 1, marginRight: '8px' }}>
                  {item.title || item.summary?.slice(0, 60) || 'Untitled'}
                </div>
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  style={{
                    padding: '2px 6px',
                    backgroundColor: 'transparent',
                    color: '#555',
                    border: '1px solid #333',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    flexShrink: 0,
                  }}
                  title="Delete"
                >
                  x
                </button>
              </div>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {item.airport && <span style={badge('#4499ff', '9px')}>{item.airport}</span>}
                {item.overall_severity && <span style={badge(sevColor, '9px')}>{item.overall_severity}</span>}
                {item.incident_count > 0 && <span style={badge('#aaa', '9px')}>{item.incident_count} incidents</span>}
              </div>

              {item.category_name && (
                <div style={{ fontSize: '10px', color: item.category_color || '#666', fontFamily: 'monospace' }}>
                  {item.category_icon} {item.category_name}
                </div>
              )}

              <div style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace', marginTop: '4px' }}>
                {new Date(item.created_at + 'Z').toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function TrainerMode() {
  const [dialogText, setDialogText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [viewState, setViewState] = useState({ longitude: -73.7781, latitude: 40.6413, zoom: 13 });
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [savedNotice, setSavedNotice] = useState(null);
  const mapRef = useRef(null);

  const handleAnalyze = async () => {
    if (!dialogText.trim()) return;
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedId(null);
    setCurrentAnalysisId(null);
    setSavedNotice(null);
    try {
      const result = await analyzeDialog(dialogText);
      setAnalysis(result);
      if (result.mapFocus?.coordinates) {
        const { lat, lng } = result.mapFocus.coordinates;
        const zoom = result.mapFocus.zoom || 13;
        setViewState({ longitude: lng, latitude: lat, zoom });
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });
      }
      if (result.incidents?.length > 0) setSelectedId(result.incidents[0].id);

      // Track saved record
      if (result._saved) {
        setCurrentAnalysisId(result._saved.id);
        setSavedNotice(`Saved: ${result._saved.title}`);
        setTimeout(() => setSavedNotice(null), 4000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadAnalysis = async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const record = await fetchAnalysis(id);
      const analysisData = record.analysis_json;
      setDialogText(record.dialog_text);
      setAnalysis(analysisData);
      setCurrentAnalysisId(id);

      if (analysisData.mapFocus?.coordinates) {
        const { lat, lng } = analysisData.mapFocus.coordinates;
        const zoom = analysisData.mapFocus.zoom || 13;
        setViewState({ longitude: lng, latitude: lat, zoom });
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });
      }
      if (analysisData.incidents?.length > 0) setSelectedId(analysisData.incidents[0].id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setError(null);
    setSelectedId(null);
    setDialogText('');
    setCurrentAnalysisId(null);
    setSavedNotice(null);
  };

  const selectedIncident = analysis?.incidents?.find((i) => i.id === selectedId);

  const centerLat = analysis?.mapFocus?.coordinates?.lat || 40.6413;
  const centerLng = analysis?.mapFocus?.coordinates?.lng || -73.7781;
  const incidentMarkers = analysis?.incidents
    ? getIncidentMarkerPositions(analysis.incidents, centerLat, centerLng)
    : [];

  // ── Render ──
  return (
    <div style={{ flex: 1, display: 'flex', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>

      {/* ── HISTORY SIDEBAR ── */}
      <HistorySidebar onLoadAnalysis={handleLoadAnalysis} currentAnalysisId={currentAnalysisId} />

      {/* ── LEFT PANEL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '2px solid #222', overflow: 'hidden' }}>

        {/* Left header */}
        <div style={{ padding: '12px 20px', borderBottom: '2px solid #222', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, color: '#00ff00', fontSize: '13px', fontFamily: 'monospace', letterSpacing: '2px' }}>
              ATC COMMUNICATION DIALOG
            </h3>
            {savedNotice && (
              <span style={{ color: '#00ff00', fontSize: '11px', fontFamily: 'monospace', opacity: 0.8 }}>
                {savedNotice}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!analysis && !isLoading && (
              <button onClick={() => setDialogText(SAMPLE_DIALOG)} style={btnStyle('#1a1a1a', '#aaa')}>
                Load Sample
              </button>
            )}
            {analysis && (
              <button onClick={handleReset} style={btnStyle('#1a1a1a', '#aaa')}>
                New Dialog
              </button>
            )}
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !dialogText.trim()}
              style={btnStyle('#00ff00', '#000', !isLoading && dialogText.trim().length > 0)}
            >
              {isLoading ? 'Analyzing...' : 'Analyze with Claude'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ padding: '10px 20px', backgroundColor: '#1a0000', borderBottom: '2px solid #ff0000', color: '#ff5555', fontSize: '12px', fontFamily: 'monospace', flexShrink: 0 }}>
            {error}
            <div style={{ color: '#666', marginTop: '4px', fontSize: '11px' }}>
              Make sure the backend is running: <strong>npm run start:server</strong>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: '52px', animation: 'spin 2s linear infinite', marginBottom: '20px' }}>📡</div>
            <div style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: '16px', marginBottom: '8px' }}>
              Claude is analyzing...
            </div>
            <div style={{ color: '#555', fontFamily: 'monospace', fontSize: '12px' }}>
              Extracting incidents · safety issues · educational insights
            </div>
          </div>
        )}

        {/* Dialog input (before analysis) */}
        {!analysis && !isLoading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: '10px', overflow: 'hidden' }}>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>
              Paste an ATC / pilot communication dialog and click "Analyze with Claude" to extract incidents and educational insights.
              Results are automatically saved for later study.
            </div>
            <textarea
              value={dialogText}
              onChange={(e) => setDialogText(e.target.value)}
              placeholder={`Example:\nATC: N12345, cleared to land runway 28L.\nPilot: Cleared to land 28L, N12345.\nATC: N12345, go around! Traffic on runway!`}
              style={{
                flex: 1,
                backgroundColor: '#0d0d0d',
                color: '#00ff00',
                border: '2px solid #2a2a2a',
                borderRadius: '6px',
                padding: '14px',
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: 1.8,
                resize: 'none',
                outline: 'none',
                caretColor: '#00ff00',
              }}
            />
          </div>
        )}

        {/* Analyzed dialog (after analysis) */}
        {analysis && !isLoading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Summary banner */}
            <div style={{ padding: '12px 20px', backgroundColor: '#0d0d0d', borderBottom: '2px solid #222', flexShrink: 0 }}>
              <div style={{ color: '#00ff00', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '6px' }}>
                SITUATION SUMMARY
              </div>
              <div style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.5 }}>{analysis.summary}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {analysis.aircraftCallsign && <span style={badge('#00ff00')}>✈️ {analysis.aircraftCallsign}</span>}
                {analysis.airport && <span style={badge('#4499ff')}>{analysis.airport}</span>}
                {analysis.phase && <span style={badge('#ffaa00')}>{analysis.phase}</span>}
                {analysis.overallSeverity && (
                  <span style={badge(SEVERITY_COLORS[analysis.overallSeverity])}>
                    {analysis.overallSeverity} SEVERITY
                  </span>
                )}
              </div>
            </div>

            {/* Highlighted dialog */}
            <div style={{ padding: '14px 20px', borderBottom: '2px solid #222', backgroundColor: '#080808', flexShrink: 0 }}>
              <div style={{ color: '#444', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '8px' }}>
                DIALOG — click highlighted text to select incident
              </div>
              <HighlightedDialog
                dialogText={dialogText}
                incidents={analysis.incidents}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>

            {/* Incident list + key lessons */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={{ color: '#444', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '12px' }}>
                DETECTED INCIDENTS ({analysis.incidents?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysis.incidents?.map((inc) => {
                  const color = INCIDENT_COLORS[inc.type] || '#00ffaa';
                  const isSelected = selectedId === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedId(inc.id)}
                      style={{
                        padding: '10px 14px',
                        border: `2px solid ${isSelected ? color : `${color}44`}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? `${color}18` : '#0d0d0d',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color, fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}>
                          #{inc.id} {inc.title}
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <span style={badge(SEVERITY_COLORS[inc.severity], '10px')}>{inc.severity}</span>
                          <span style={badge(color, '10px')}>{inc.type.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ color: '#999', fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>
                          {inc.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Key lessons */}
              {analysis.keyLessons?.length > 0 && (
                <div style={{ marginTop: '20px', padding: '14px', border: '2px solid #00ff00', borderRadius: '6px', backgroundColor: '#001200' }}>
                  <div style={{ color: '#00ff00', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '10px' }}>
                    KEY LESSONS
                  </div>
                  {analysis.keyLessons.map((lesson, i) => (
                    <div key={i} style={{ color: '#ccc', fontSize: '12px', marginBottom: '8px', lineHeight: 1.6 }}>
                      <span style={{ color: '#00ff00', marginRight: '8px' }}>▸</span>
                      {lesson}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', border: '2px solid #222', minHeight: 0 }}>
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/satellite-v9"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            <NavigationControl position="top-right" />

            {/* Airport pin */}
            {analysis && (
              <Marker longitude={centerLng} latitude={centerLat}>
                <div style={{ fontSize: '26px', filter: 'drop-shadow(0 0 4px #00ff00)' }}>🛫</div>
              </Marker>
            )}

            {/* Incident markers */}
            {incidentMarkers.map((inc) => {
              const color = INCIDENT_COLORS[inc.type] || '#00ffaa';
              const isSelected = selectedId === inc.id;
              return (
                <Marker key={inc.id} longitude={inc.markerLng} latitude={inc.markerLat}>
                  <div
                    onClick={() => setSelectedId(inc.id)}
                    title={`#${inc.id} ${inc.title}`}
                    style={{
                      width: isSelected ? 34 : 26,
                      height: isSelected ? 34 : 26,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? color : `${color}77`,
                      border: `3px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000',
                      fontWeight: 'bold',
                      fontSize: isSelected ? 14 : 11,
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 14px ${color}` : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {inc.id}
                  </div>
                </Marker>
              );
            })}
          </Map>

          {/* Map placeholder overlay */}
          {!analysis && !isLoading && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              backgroundColor: 'rgba(0,0,0,0.85)', padding: '20px 30px', borderRadius: '10px',
              border: '2px solid #222', textAlign: 'center', zIndex: 10,
            }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🗺️</div>
              <div style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.6 }}>
                Analyze a dialog to see<br />incident markers on the map
              </div>
            </div>
          )}
        </div>

        {/* ── Incident detail panel (when an incident is selected) ── */}
        {analysis && selectedIncident && (
          <div style={{
            flexShrink: 0, border: '2px solid #222', backgroundColor: '#0d0d0d',
            padding: '18px 20px', maxHeight: '48%', overflowY: 'auto',
          }}>
            {(() => {
              const inc = selectedIncident;
              const color = INCIDENT_COLORS[inc.type] || '#00ffaa';
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ color, fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
                        #{inc.id} {inc.title}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={badge(SEVERITY_COLORS[inc.severity])}>{inc.severity}</span>
                        <span style={badge(color)}>{inc.type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dialog reference */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ color: '#444', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '6px' }}>DIALOG REFERENCE</div>
                    <div style={{
                      color: color, fontSize: '12px', fontFamily: 'monospace',
                      backgroundColor: `${color}0f`, padding: '8px 12px',
                      borderRadius: '4px', borderLeft: `3px solid ${color}`, lineHeight: 1.6,
                    }}>
                      "{inc.dialogText}"
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ color: '#444', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '6px' }}>DESCRIPTION</div>
                    <div style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.6 }}>{inc.description}</div>
                  </div>

                  {/* Educational note */}
                  <div style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#001800', borderRadius: '6px', border: '1px solid #00ff0022' }}>
                    <div style={{ color: '#00ff00', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '6px' }}>EDUCATIONAL NOTE</div>
                    <div style={{ color: '#aaddbf', fontSize: '13px', lineHeight: 1.6 }}>{inc.educationalNote}</div>
                  </div>

                  {/* ATC best practice */}
                  {inc.atcBestPractice && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#4499ff', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '5px' }}>ATC BEST PRACTICE</div>
                      <div style={{ color: '#aabbdd', fontSize: '12px', lineHeight: 1.5 }}>{inc.atcBestPractice}</div>
                    </div>
                  )}

                  {/* Pilot best practice */}
                  {inc.pilotBestPractice && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#ffaa00', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '5px' }}>PILOT BEST PRACTICE</div>
                      <div style={{ color: '#ddccaa', fontSize: '12px', lineHeight: 1.5 }}>{inc.pilotBestPractice}</div>
                    </div>
                  )}

                  {/* Regulation */}
                  {inc.relatedRegulation && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#111100', borderRadius: '4px', border: '1px solid #ffff0022' }}>
                      <div style={{ color: '#ffff00', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '4px' }}>REGULATION</div>
                      <div style={{ color: '#cccc88', fontSize: '12px', lineHeight: 1.5 }}>{inc.relatedRegulation}</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── Communication quality panel (shown when no incident selected) ── */}
        {analysis && !selectedIncident && analysis.communicationQuality && (
          <div style={{ flexShrink: 0, border: '2px solid #222', backgroundColor: '#0d0d0d', padding: '18px 20px' }}>
            <div style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '14px' }}>
              COMMUNICATION QUALITY
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[
                { label: 'CLARITY', value: analysis.communicationQuality.clarity },
                { label: 'PHRASEOLOGY', value: analysis.communicationQuality.standardPhraseology },
                { label: 'READBACKS', value: analysis.communicationQuality.readbacks },
              ].map((item) => {
                const isGood = ['HIGH', 'CORRECT'].includes(item.value);
                const isMed = ['MEDIUM', 'PARTIAL'].includes(item.value);
                const color = isGood ? '#00dd00' : isMed ? '#ffaa00' : '#ff4444';
                return (
                  <div key={item.label} style={{ textAlign: 'center', padding: '14px', backgroundColor: `${color}10`, border: `1px solid ${color}33`, borderRadius: '6px' }}>
                    <div style={{ color: '#555', fontSize: '10px', fontFamily: 'monospace', marginBottom: '8px' }}>{item.label}</div>
                    <div style={{ color, fontSize: '15px', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainerMode;
