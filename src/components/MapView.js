/**
 * MapView — Full-screen Mapbox GL base map
 * Uses react-map-gl v7
 */
import { useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const SEVERITY_COLOR = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

export default function MapView({ events = [], activeEvent, onEventClick, mapRef }) {
  const handleMarkerClick = useCallback((e, evt) => {
    e.originalEvent?.stopPropagation();
    onEventClick?.(evt);
  }, [onEventClick]);

  // Render all events that have coordinates (all should have coords after atcParser fix)
  const geoEvents = events.filter(e => e.lat != null && e.lng != null);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -87.9, latitude: 41.98, zoom: 9 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
    >
      <NavigationControl position="bottom-left" />

      {geoEvents.map((evt) => (
        <Marker
          key={evt.id}
          longitude={evt.lng}
          latitude={evt.lat}
          anchor="center"
          onClick={(e) => handleMarkerClick(e, evt)}
        >
          <div
            title={evt.description}
            style={{
              width: activeEvent?.id === evt.id ? 18 : 14,
              height: activeEvent?.id === evt.id ? 18 : 14,
              borderRadius: '50%',
              background: SEVERITY_COLOR[evt.severity] || '#6b7280',
              border: activeEvent?.id === evt.id ? '3px solid #fff' : '2px solid rgba(255,255,255,0.4)',
              cursor: 'pointer',
              boxShadow: activeEvent?.id === evt.id
                ? `0 0 14px 4px ${SEVERITY_COLOR[evt.severity] || '#6b7280'}`
                : '0 0 8px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
              transform: activeEvent?.id === evt.id ? 'scale(1.6)' : 'scale(1)',
            }}
          />
        </Marker>
      ))}

      {activeEvent?.lat != null && (
        <Popup
          longitude={activeEvent.lng}
          latitude={activeEvent.lat}
          anchor="top"
          closeButton={false}
          closeOnClick={false}
          style={{ maxWidth: 260 }}
        >
          <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
            <div style={{
              fontWeight: 700,
              color: SEVERITY_COLOR[activeEvent.severity] || '#fff',
              marginBottom: 4,
            }}>
              {activeEvent.keyword}
            </div>
            <div style={{ color: '#e5e7eb' }}>{activeEvent.description}</div>
            <div style={{ color: '#9ca3af', marginTop: 4 }}>
              {formatTime(activeEvent.timestamp)}
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
