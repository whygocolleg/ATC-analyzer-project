import React, { useState, useEffect } from 'react';
import { Map, Marker, NavigationControl, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import YouTube from 'react-youtube';
import TrainerMode from './components/TrainerMode';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
// ==================== 확장 가능한 사고 데이터 구조 ====================
const INCIDENT_DATA = {
  videoId: 'w5WMP494pgU',
  flightCallsign: 'JBU2892',
  airport: 'JFK',
  
  locations: [
    { id: '4L_F', name: '4L-F', lat: 40.64257, lng: -73.76618 },
    { id: '4R_Y', name: '4R-Y', lat: 40.64758, lng: -73.75833 },
    { id: '31R_E', name: '31R-E', lat: 40.64766, lng: -73.76782 },
    { id: '4R_TH', name: '4R Threshold', lat: 40.62585, lng: -73.77001 },
    { id: 'FIRE_STN', name: 'ARFF Station', lat: 40.65158, lng: -73.78314 },
  ],
  
  timeline: {
    planeApproach: 10,
    planeLanding: 40,
    planeLanded: 70,
    truckDispatch: 80,
    runwayClosure: 330
  },
  
  flightPath: {
    initial: { lng: -73.78500, lat: 40.61000 },
    approach: { lng: -73.77001, lat: 40.62585 },
    landing: { lng: -73.76618, lat: 40.64257 }
  },
  
  emergencyUnit: {
    startPos: { lng: -73.78314, lat: 40.65158 },
    targetPos: { lng: -73.76618, lat: 40.64257 }
  },
  
  subtitles: [
    { time: 13, text: "JBU2892: Likely to declare an emergency." },
    { time: 21, text: "JBU2892: We have a massive fuel imbalance." },
    { time: 80, text: "TWR: Emergency equipment's on their way now." },
    { time: 114, text: "JBU2892: Check for any fuel leak on our left side." },
    { time: 157, text: "TWR: They're coming to the left side right now." },
    { time: 330, text: "ATC: Runway 4 Right will be closed due to contamination." }
  ],
  
  runwayCenterline: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          coordinates: [
            [-73.77010724488446, 40.625749318504546],
            [-73.75531349788288, 40.644750861539194]
          ],
          type: 'LineString'
        }
      },
      {
        type: 'Feature',
        geometry: {
          coordinates: [
            [-73.75523644961586, 40.644790021958414],
            [-73.75603177740095, 40.64651418475694],
            [-73.75832069926795, 40.64768100644412]
          ],
          type: 'LineString'
        }
      }
    ]
  },
  
  contaminationPath: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          coordinates: [
            [-73.77023895799424, 40.62575226265656],
            [-73.76057412055097, 40.638253175876685],
            [-73.76082624674459, 40.64003882956894],
            [-73.76477622378694, 40.641760664678344]
          ],
          type: 'LineString'
        }
      }
    ]
  }
};

// ==================== 주요 이벤트 북마크 ====================
const CRITICAL_EVENTS = [
  { id: 1, time: 13, label: '🚨 Emergency Declaration', color: '#ff0000' },
  { id: 2, time: 40, label: '🛬 Landing Sequence Start', color: '#ffaa00' },
  { id: 3, time: 70, label: '✅ Aircraft Landed', color: '#00ff00' },
  { id: 4, time: 80, label: '🚒 ARFF Dispatch', color: '#ff6600' },
  { id: 5, time: 330, label: '🔴 Runway 4R Closure', color: '#ff0000' }
];

const CONTAMINATION_LEVEL = {
  MINOR: { width: 15, opacity: 0.4, color: '#ffff00' },
  MODERATE: { width: 20, opacity: 0.6, color: '#ffaa00' },
  SEVERE: { width: 30, opacity: 0.8, color: '#ff6600' }
};

function App() {
  const [mode, setMode] = useState('replay'); // 'replay' | 'trainer'
  const [player, setPlayer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(50);
  
  const [viewState, setViewState] = useState({
    longitude: -73.7781,
    latitude: 40.6413,
    zoom: 12
  });
  const mapRef = React.useRef(null);

  const [truckPos, setTruckPos] = useState(INCIDENT_DATA.emergencyUnit.startPos);
  const [isDeploying, setIsDeploying] = useState(false);
  const [is4RClosed, setIs4RClosed] = useState(false);
  const [contaminationLevel, setContaminationLevel] = useState('MODERATE');

  const [planePos, setPlanePos] = useState(INCIDENT_DATA.flightPath.initial);
  const [isApproaching, setIsApproaching] = useState(false);
  const [isLanding, setIsLanding] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);

  // 유튜브 시간 감시
  useEffect(() => {
    let interval;
    if (player) {
      interval = setInterval(() => {
        const time = player.getCurrentTime();
        setCurrentTime(time);
        const sec = Math.floor(time);

        // 비행기 로직
        if (sec < INCIDENT_DATA.timeline.planeApproach) {
          if (isApproaching || isLanding || hasLanded) {
            setIsApproaching(false);
            setIsLanding(false);
            setHasLanded(false);
            setPlanePos(INCIDENT_DATA.flightPath.initial);
          }
        } else if (sec >= INCIDENT_DATA.timeline.planeApproach && sec < INCIDENT_DATA.timeline.planeLanding) {
          if (!isApproaching) {
            setIsApproaching(true);
            setIsLanding(false);
            setHasLanded(false);
          }
        } else if (sec >= INCIDENT_DATA.timeline.planeLanding && sec < INCIDENT_DATA.timeline.planeLanded) {
          if (!isLanding) {
            setIsApproaching(false);
            setIsLanding(true);
            setHasLanded(false);
          }
        } else if (sec >= INCIDENT_DATA.timeline.planeLanded) {
          if (!hasLanded) {
            setIsApproaching(false);
            setIsLanding(false);
            setHasLanded(true);
          }
        }

        // 소방차 로직
        if (sec < INCIDENT_DATA.timeline.truckDispatch) {
          setIsDeploying(false);
          setTruckPos(INCIDENT_DATA.emergencyUnit.startPos);
        } else if (sec >= INCIDENT_DATA.timeline.truckDispatch && !isDeploying) {
          setIsDeploying(true);
        }

        // 활주로 폐쇄
        if (sec < INCIDENT_DATA.timeline.runwayClosure) {
          setIs4RClosed(false);
        } else if (sec >= INCIDENT_DATA.timeline.runwayClosure && !is4RClosed) {
          setIs4RClosed(true);
          setContaminationLevel('MODERATE');
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [player, isApproaching, isLanding, hasLanded, isDeploying, is4RClosed]);

  // 소방차 애니메이션
  useEffect(() => {
    let moveInterval;
    if (isDeploying) {
      moveInterval = setInterval(() => {
        setTruckPos(prev => {
          const dLng = (INCIDENT_DATA.emergencyUnit.targetPos.lng - prev.lng) * 0.05;
          const dLat = (INCIDENT_DATA.emergencyUnit.targetPos.lat - prev.lat) * 0.05;
          if (Math.abs(dLng) < 0.00001) {
            clearInterval(moveInterval);
            return INCIDENT_DATA.emergencyUnit.targetPos;
          }
          return { lng: prev.lng + dLng, lat: prev.lat + dLat };
        });
      }, 50);
    }
    return () => clearInterval(moveInterval);
  }, [isDeploying]);

  // 비행기 접근 애니메이션
  useEffect(() => {
    let approachInterval;
    if (isApproaching) {
      approachInterval = setInterval(() => {
        setPlanePos(prev => {
          const dLng = (INCIDENT_DATA.flightPath.approach.lng - prev.lng) * 0.02;
          const dLat = (INCIDENT_DATA.flightPath.approach.lat - prev.lat) * 0.02;
          if (Math.abs(dLng) < 0.0001) {
            clearInterval(approachInterval);
            return INCIDENT_DATA.flightPath.approach;
          }
          return { lng: prev.lng + dLng, lat: prev.lat + dLat };
        });
      }, 50);
    }
    return () => clearInterval(approachInterval);
  }, [isApproaching]);

  // 비행기 착륙 애니메이션
  useEffect(() => {
    let landInterval;
    if (isLanding) {
      landInterval = setInterval(() => {
        setPlanePos(prev => {
          const dLng = (INCIDENT_DATA.flightPath.landing.lng - prev.lng) * 0.03;
          const dLat = (INCIDENT_DATA.flightPath.landing.lat - prev.lat) * 0.03;
          if (Math.abs(dLng) < 0.0001) {
            clearInterval(landInterval);
            return INCIDENT_DATA.flightPath.landing;
          }
          return { lng: prev.lng + dLng, lat: prev.lat + dLat };
        });
      }, 50);
    }
    return () => clearInterval(landInterval);
  }, [isLanding]);

  // 카메라 팔로잉
  useEffect(() => {
    if ((isApproaching || isLanding) && mapRef.current) {
      mapRef.current.flyTo({
        center: [planePos.lng, planePos.lat],
        zoom: 14,
        duration: 2000,
        essential: true
      });
    } else if (hasLanded && mapRef.current) {
      mapRef.current.flyTo({
        center: [-73.765, 40.635],
        zoom: 13,
        duration: 3000,
        essential: true
      });
    }
  }, [isApproaching, isLanding, hasLanded, planePos]);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (player) {
      player.setVolume(newVolume);
    }
  };

  // 이벤트 북마크 클릭
  const jumpToEvent = (time) => {
    if (player) {
      player.seekTo(time);
    }
  };

  const currentSubtitle = [...INCIDENT_DATA.subtitles].reverse().find(s => s.time <= currentTime);

  const getFlightData = () => {
    const sec = Math.floor(currentTime);
    
    if (sec < INCIDENT_DATA.timeline.planeApproach) {
      return { altitude: 3500, speed: 180, status: 'INBOUND', distance: 15.2 };
    } else if (isApproaching) {
      const progress = (sec - INCIDENT_DATA.timeline.planeApproach) / 
                       (INCIDENT_DATA.timeline.planeLanding - INCIDENT_DATA.timeline.planeApproach);
      return {
        altitude: Math.round(3500 - (3500 - 1500) * progress),
        speed: Math.round(180 - (180 - 150) * progress),
        status: 'APPROACH',
        distance: Math.round(15.2 - 15.2 * progress * 10) / 10
      };
    } else if (isLanding) {
      const progress = (sec - INCIDENT_DATA.timeline.planeLanding) / 
                       (INCIDENT_DATA.timeline.planeLanded - INCIDENT_DATA.timeline.planeLanding);
      return {
        altitude: Math.round(1500 - 1500 * progress),
        speed: Math.round(150 - (150 - 60) * progress),
        status: 'LANDING',
        distance: Math.round(5.0 - 5.0 * progress * 10) / 10
      };
    } else if (hasLanded) {
      return { altitude: 0, speed: 0, status: 'LANDED', distance: 0 };
    }
    
    return { altitude: 3500, speed: 180, status: 'INBOUND', distance: 15.2 };
  };

  const flightData = getFlightData();
  const contaminationStyle = CONTAMINATION_LEVEL[contaminationLevel];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a' }}>

      {/* 상단 헤더 */}
      <div style={{ height: '60px', background: 'linear-gradient(90deg, #1a1a1a 0%, #0a0a0a 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', borderBottom: '2px solid #00ff00', boxShadow: '0 4px 20px rgba(0,255,0,0.3)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ fontSize: '20px', color: '#00ff00', margin: 0, fontWeight: 'bold', letterSpacing: '2px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
            📡 ATC INCIDENT ANALYZER
          </h1>
          {mode === 'replay' && (
            <span style={{ fontSize: '13px', color: '#666', fontFamily: 'monospace' }}>
              {INCIDENT_DATA.airport} | {INCIDENT_DATA.flightCallsign}
            </span>
          )}
          {mode === 'trainer' && (
            <span style={{ fontSize: '13px', color: '#0088ff', fontFamily: 'monospace', letterSpacing: '1px' }}>
              🎓 PILOT COMMUNICATION TRAINER
            </span>
          )}
        </div>

        {/* Mode toggle + clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Mode switcher */}
          <div style={{ display: 'flex', border: '2px solid #333', borderRadius: '6px', overflow: 'hidden' }}>
            {[
              { key: 'replay', label: '▶ INCIDENT REPLAY' },
              { key: 'trainer', label: '🎓 AI TRAINER' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: mode === key ? '#00ff00' : '#111',
                  color: mode === key ? '#000' : '#666',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'replay' && (
            <div style={{ fontSize: '16px', color: '#00ff00', fontFamily: 'monospace', fontWeight: 'bold', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
              ⏱ {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </div>

      {/* ── TRAINER MODE ── */}
      {mode === 'trainer' && <TrainerMode />}

      {/* ── REPLAY MODE (existing) ── */}
      {/* 경고 배너 */}
      {mode === 'replay' && is4RClosed && (
        <div style={{ 
          height: '50px', 
          backgroundColor: '#ff0000', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontSize: '18px', 
          fontWeight: 'bold',
          animation: 'blink 1s infinite',
          borderBottom: '3px solid #ffffff'
        }}>
          <style>{`@keyframes blink { 0%, 50% { opacity: 1; } 25%, 75% { opacity: 0.3; } }`}</style>
          ⚠️ WARNING: RUNWAY 4R CLOSED - FUEL SPILL CONTAMINATION ⚠️
        </div>
      )}

      <div style={{ flex: 1, display: mode === 'replay' ? 'flex' : 'none', gap: '2px', backgroundColor: '#0a0a0a' }}>
        
        {/* 왼쪽: 지도 */}
        <div style={{ flex: 3, position: 'relative', border: '2px solid #333' }}>
          <Map 
            ref={mapRef}
            {...viewState} 
            onMove={evt => setViewState(evt.viewState)} 
            style={{ width: '100%', height: '100%' }} 
            mapStyle="mapbox://styles/mapbox/satellite-v9" 
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            <NavigationControl position="top-right" />

            {hasLanded && (
              <Source type="geojson" data={INCIDENT_DATA.contaminationPath}>
                <Layer
                  id="fuel-contamination"
                  type="line"
                  paint={{
                    'line-color': contaminationStyle.color,
                    'line-width': contaminationStyle.width,
                    'line-opacity': contaminationStyle.opacity
                  }}
                />
              </Source>
            )}

            {is4RClosed && (
              <Source type="geojson" data={INCIDENT_DATA.runwayCenterline}>
                <Layer
                  id="runway-4r-closed"
                  type="line"
                  paint={{
                    'line-color': '#ff0000',
                    'line-width': 25,
                    'line-opacity': 0.5
                  }}
                />
              </Source>
            )}

            {INCIDENT_DATA.locations.map(loc => (
              <Marker key={loc.id} longitude={loc.lng} latitude={loc.lat}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '20px' }}>{(is4RClosed && loc.id.includes('4R')) ? '❌' : '📍'}</span>
                  <div style={{ color: (is4RClosed && loc.id.includes('4R')) ? 'red' : 'yellow', fontWeight: 'bold', fontSize: '10px', textShadow: '0 0 5px black' }}>
                    {loc.name}
                  </div>
                </div>
              </Marker>
            ))}
            
            <Marker longitude={truckPos.lng} latitude={truckPos.lat}>
              <div style={{ fontSize: '30px', backgroundColor: 'rgba(255, 0, 0, 0.3)', borderRadius: '50%', padding: '5px' }}>🚒</div>
            </Marker>
            
            {(isApproaching || isLanding || hasLanded) && (
              <Marker longitude={planePos.lng} latitude={planePos.lat}>
                <div style={{ fontSize: '35px', transform: 'rotate(45deg)' }}>✈️</div>
              </Marker>
            )}
          </Map>
          
          {currentSubtitle && (
            <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.9)', color: '#00ff00', padding: '15px 30px', borderRadius: '10px', border: '2px solid #00ff00', fontSize: '16px', zIndex: 10, boxShadow: '0 0 20px rgba(0,255,0,0.5)' }}>
              {currentSubtitle.text}
            </div>
          )}
        </div>

        {/* 오른쪽 패널 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          
          {/* 상단: 유튜브 + Flight Info */}
          <div style={{ flex: 1, backgroundColor: '#0f0f0f', padding: '20px', overflowY: 'auto', border: '2px solid #333' }}>
            <div style={{ marginBottom: '20px', border: '2px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
              <YouTube 
                videoId={INCIDENT_DATA.videoId}
                opts={{ width: '100%', height: '200px', playerVars: { autoplay: 0 } }} 
                onReady={(event) => {
                  setPlayer(event.target);
                  event.target.setVolume(volume);
                }} 
              />
              
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#1a1a1a' }}>
                <span style={{ marginRight: '10px', fontSize: '16px' }}>🔊</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume}
                  onChange={handleVolumeChange}
                  style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: '#00ff00' }}
                />
                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#00ff00', minWidth: '35px' }}>{volume}%</span>
              </div>
            </div>

            <div style={{ border: '2px solid #00ff00', padding: '15px', backgroundColor: '#0a0a0a', borderRadius: '8px', boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#00ff00', borderBottom: '2px solid #00ff00', paddingBottom: '8px', fontSize: '16px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                ✈️ FLIGHT DATA
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>CALLSIGN</div>
                  <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '15px' }}>{INCIDENT_DATA.flightCallsign}</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>STATUS</div>
                  <div style={{ 
                    color: flightData.status === 'LANDED' ? '#ff0000' : 
                           flightData.status === 'LANDING' ? '#ffaa00' : '#00ff00',
                    fontWeight: 'bold',
                    fontSize: '15px'
                  }}>
                    {flightData.status}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>ALTITUDE</div>
                  <div style={{ color: '#00ff00', fontWeight: 'bold' }}>{flightData.altitude} ft</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>SPEED</div>
                  <div style={{ color: '#00ff00', fontWeight: 'bold' }}>{flightData.speed} kts</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>DISTANCE</div>
                  <div style={{ color: '#00ff00', fontWeight: 'bold' }}>{flightData.distance} nm</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>RUNWAY</div>
                  <div style={{ color: is4RClosed ? '#ff0000' : '#00ff00', fontWeight: 'bold' }}>4R</div>
                </div>
              </div>
            </div>
          </div>

          {/* 하단: 이벤트 북마크 & 분석 로그 */}
          <div style={{ flex: 1, backgroundColor: '#0f0f0f', padding: '20px', overflowY: 'auto', border: '2px solid #333' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#00ff00', borderBottom: '2px solid #00ff00', paddingBottom: '8px', fontSize: '16px', marginBottom: '15px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                📌 CRITICAL EVENTS
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CRITICAL_EVENTS.map(event => (
                  <button
                    key={event.id}
                    onClick={() => jumpToEvent(event.time)}
                    style={{
                      padding: '12px 15px',
                      backgroundColor: currentTime >= event.time ? '#1a3a1a' : '#1a1a1a',
                      color: event.color,
                      border: `2px solid ${event.color}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      boxShadow: `0 0 10px ${event.color}33`
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = event.color;
                      e.target.style.color = '#000';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = currentTime >= event.time ? '#1a3a1a' : '#1a1a1a';
                      e.target.style.color = event.color;
                    }}
                  >
                    [{Math.floor(event.time / 60)}:{(event.time % 60).toString().padStart(2, '0')}] {event.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ color: '#00ff00', borderBottom: '2px solid #00ff00', paddingBottom: '8px', fontSize: '16px', marginBottom: '15px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                📋 LIVE STATUS
              </h3>
              <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#888', fontFamily: 'monospace' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>ARFF:</span> <span style={{ color: isDeploying ? '#ffaa00' : '#00ff00' }}>{isDeploying ? '🚨 EN ROUTE' : '🅿️ STANDBY'}</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Aircraft:</span> <span style={{ color: '#00ff00' }}>{flightData.status}</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Runway 4R:</span> <span style={{ color: is4RClosed ? '#ff0000' : '#00ff00' }}>{is4RClosed ? '🔴 CLOSED' : '🟢 OPEN'}</span>
                </div>
                {hasLanded && (
                  <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#2a1a00', border: '2px solid #ffaa00', borderRadius: '6px' }}>
                    <div style={{ color: '#ffaa00', fontWeight: 'bold' }}>⚠️ CONTAMINATION: {contaminationLevel}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '5px' }}>Fuel spill detected on taxiway</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;