/**
 * MapView — Full-screen Mapbox GL base map with aircraft animation & vehicle icons
 * Uses react-map-gl v7
 */
import { useCallback, useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, Source } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN_NEW;

const SEVERITY_COLOR = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

const VEHICLE_ICONS = {
  aircraft:   '✈',
  fire_truck: '🚒',
  ambulance:  '🚑',
  police:     '🚔',
};

// Camera settings per flight phase
const PHASE_CAMERA = {
  TAKEOFF:    { zoom: 14, pitch: 60, duration: 2000 },
  APPROACH:   { zoom: 11, pitch: 40, duration: 2500 },
  LANDING:    { zoom: 13, pitch: 55, duration: 2000 },
  DESCENDING: { zoom: 10, pitch: 35, duration: 2500 },
  AIRBORNE:   { zoom: 9,  pitch: 25, duration: 3000 },
  GO_AROUND:  { zoom: 12, pitch: 50, duration: 2000 },
  EMERGENCY:  { zoom: 13, pitch: 55, duration: 1500 },
  TAXI:       { zoom: 15, pitch: 55, duration: 2000 },
  GROUND:     { zoom: 13, pitch: 50, duration: 2000 },
};

// Animation duration per phase (ms)
const PHASE_ANIM_MS = {
  TAKEOFF:    5000,
  APPROACH:   8000,
  LANDING:    6000,
  DESCENDING: 5000,
  AIRBORNE:   4000,
  GO_AROUND:  4000,
  default:    2000,
};

// ── Geo helpers ──────────────────────────────────────────────────────────────
function offsetPos(lat, lng, bearingDeg, distKm) {
  const R = 6371;
  const d = distKm / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ease-in-out quad
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MapView({ events = [], activeEvent, onEventClick, mapRef }) {
  const [aircraftPos, setAircraftPos]     = useState(null);
  const [vehicleMarkers, setVehicleMarkers] = useState([]);
  const animFrameRef  = useRef(null);
  const prevPosRef    = useRef(null);   // last known aircraft position

  const handleMarkerClick = useCallback((e, evt) => {
    e.originalEvent?.stopPropagation();
    onEventClick?.(evt);
  }, [onEventClick]);

  // ── Aircraft animation + camera on every activeEvent ─────────────────────
  useEffect(() => {
    if (!activeEvent) return;

    const airport  = { lat: activeEvent.lat, lng: activeEvent.lng };
    const phase    = activeEvent.flightPhase || 'GROUND';
    const heading  = activeEvent.runwayHeading || 315;

    // Approach bearing = opposite of departure runway heading
    const approachBearing = (heading + 180) % 360;
    const airborneNear    = offsetPos(airport.lat, airport.lng, approachBearing, 8);
    const airborneFar     = offsetPos(airport.lat, airport.lng, approachBearing, 22);

    // Determine start → end position and aircraft rotation
    let fromPos, toPos, rotation;
    switch (phase) {
      case 'TAKEOFF':
        fromPos  = airport;
        toPos    = airborneNear;
        rotation = heading;
        break;
      case 'APPROACH':
        fromPos  = airborneFar;
        toPos    = airborneNear;
        rotation = (heading + 180) % 360;
        break;
      case 'LANDING':
        fromPos  = airborneNear;
        toPos    = airport;
        rotation = (heading + 180) % 360;
        break;
      case 'GO_AROUND':
        fromPos  = airport;
        toPos    = airborneNear;
        rotation = heading;
        break;
      case 'AIRBORNE':
      case 'DESCENDING':
        fromPos  = prevPosRef.current || airport;
        toPos    = phase === 'DESCENDING' ? airborneNear : airborneNear;
        rotation = heading;
        break;
      default:
        fromPos  = prevPosRef.current || airport;
        toPos    = airport;
        rotation = heading;
    }

    // Cancel any ongoing animation
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const duration  = PHASE_ANIM_MS[phase] || PHASE_ANIM_MS.default;
    const startTime = performance.now();

    function animate(now) {
      const raw = Math.min((now - startTime) / duration, 1);
      const t   = easeInOut(raw);
      setAircraftPos({
        lat:      lerp(fromPos.lat, toPos.lat, t),
        lng:      lerp(fromPos.lng, toPos.lng, t),
        rotation,
        phase,
      });
      if (raw < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPosRef.current = toPos;
      }
    }
    animFrameRef.current = requestAnimationFrame(animate);

    // Ground vehicles (fire truck, ambulance etc.) — spawn at airport
    const groundVehicles = (activeEvent.vehicles || ['aircraft']).filter(v => v !== 'aircraft');
    setVehicleMarkers(
      groundVehicles.map((v, i) => ({
        id: `${activeEvent.id}_${v}`,
        type: v,
        lat: airport.lat - 0.002 + i * 0.001,
        lng: airport.lng + 0.002 + i * 0.001,
      }))
    );

    // ── Auto camera ───────────────────────────────────────────────────────
    const cam        = PHASE_CAMERA[phase] || PHASE_CAMERA.GROUND;
    const camCenter  = (phase === 'APPROACH' || phase === 'LANDING') ? fromPos : airport;
    if (mapRef?.current) {
      mapRef.current.flyTo({
        center:   [camCenter.lng, camCenter.lat],
        zoom:     cam.zoom,
        pitch:    cam.pitch,
        bearing:  heading,
        duration: cam.duration,
      });
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeEvent, mapRef]);

  const geoEvents = events.filter(e => e.lat != null && e.lng != null);

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: -87.9,
        latitude:   41.98,
        zoom:       12,
        pitch:      60,
        bearing:   -20,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
      terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
    >
      {/* 3-D terrain DEM */}
      <Source
        id="mapbox-dem"
        type="raster-dem"
        url="mapbox://mapbox.mapbox-terrain-dem-v1"
        tileSize={512}
        maxzoom={14}
      />

      <NavigationControl position="bottom-left" />

      {/* ── Event markers ──────────────────────────────────────────────── */}
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
              width:      activeEvent?.id === evt.id ? 18 : 14,
              height:     activeEvent?.id === evt.id ? 18 : 14,
              borderRadius: '50%',
              background: SEVERITY_COLOR[evt.severity] || '#6b7280',
              border:     activeEvent?.id === evt.id
                ? '3px solid #fff'
                : '2px solid rgba(255,255,255,0.4)',
              cursor:     'pointer',
              boxShadow:  activeEvent?.id === evt.id
                ? `0 0 14px 4px ${SEVERITY_COLOR[evt.severity] || '#6b7280'}`
                : '0 0 8px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
              transform:  activeEvent?.id === evt.id ? 'scale(1.6)' : 'scale(1)',
            }}
          />
        </Marker>
      ))}

      {/* ── Animated aircraft icon ─────────────────────────────────────── */}
      {aircraftPos && (
        <Marker
          longitude={aircraftPos.lng}
          latitude={aircraftPos.lat}
          anchor="center"
        >
          <div style={{
            fontSize:   28,
            lineHeight:  1,
            transform:  `rotate(${aircraftPos.rotation}deg)`,
            filter:     'drop-shadow(0 0 8px rgba(96,165,250,0.9))',
            transition: 'transform 0.1s linear',
            userSelect: 'none',
          }}>
            ✈
          </div>
        </Marker>
      )}

      {/* ── Ground vehicle icons ───────────────────────────────────────── */}
      {vehicleMarkers.map((vm) => (
        <Marker key={vm.id} longitude={vm.lng} latitude={vm.lat} anchor="center">
          <div style={{
            fontSize:   22,
            lineHeight:  1,
            filter:     'drop-shadow(0 0 6px rgba(239,68,68,0.9))',
            userSelect: 'none',
            animation:  'pulse 1s infinite',
          }}>
            {VEHICLE_ICONS[vm.type] || '🚗'}
          </div>
        </Marker>
      ))}

      {/* ── Active event popup ─────────────────────────────────────────── */}
      {activeEvent?.lat != null && (
        <Popup
          longitude={activeEvent.lng}
          latitude={activeEvent.lat}
          anchor="top"
          closeButton={false}
          closeOnClick={false}
          style={{ maxWidth: 280 }}
        >
          <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
            <div style={{
              fontWeight:   700,
              color:        SEVERITY_COLOR[activeEvent.severity] || '#fff',
              marginBottom: 4,
              display:      'flex',
              gap:          6,
              alignItems:   'center',
            }}>
              <span>{activeEvent.keyword}</span>
              {activeEvent.flightPhase && (
                <span style={{
                  fontSize:     10,
                  background:   'rgba(255,255,255,0.15)',
                  padding:      '1px 5px',
                  borderRadius: 3,
                  color:        '#cbd5e1',
                }}>
                  {activeEvent.flightPhase}
                </span>
              )}
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
