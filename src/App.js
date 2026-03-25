import React, { useState, useEffect } from 'react';
import { Map, Marker, NavigationControl, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import YouTube from 'react-youtube';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function App() {
  const [incidentData, setIncidentData] = useState(null);

  const [player, setPlayer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(50);

  const [viewState, setViewState] = useState({
    longitude: -73.7781,
    latitude: 40.6413,
    zoom: 12
  });
  const mapRef = React.useRef(null);

  const [truckPos, setTruckPos] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [is4RClosed, setIs4RClosed] = useState(false);
  const [contaminationLevel, setContaminationLevel] = useState('MODERATE');

  const [planePos, setPlanePos] = useState(null);
  const [isApproaching, setIsApproaching] = useState(false);
  const [isLanding, setIsLanding] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);

  // 새 데이터 로드 시 상태 초기화
  useEffect(() => {
    if (incidentData) {
      setTruckPos(incidentData.emergencyUnit.startPos);
      setPlanePos(incidentData.flightPath.initial);
      setIsDeploying(false);
      setIs4RClosed(false);
      setIsApproaching(false);
      setIsLanding(false);
      setHasLanded(false);
      setCurrentTime(0);
    }
  }, [incidentData]);

  // JSON 파일 업로드 핸들러
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setIncidentData(data);
      } catch {
        alert('올바른 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
    // 같은 파일 재업로드 허용
    e.target.value = '';
  };

  // 유튜브 시간 감시
  useEffect(() => {
    if (!incidentData) return;
    let interval;
    if (player) {
      interval = setInterval(() => {
        const time = player.getCurrentTime();
        setCurrentTime(time);
        const sec = Math.floor(time);

        // 비행기 로직
        if (sec < incidentData.timeline.planeApproach) {
          if (isApproaching || isLanding || hasLanded) {
            setIsApproaching(false);
            setIsLanding(false);
            setHasLanded(false);
            setPlanePos(incidentData.flightPath.initial);
          }
        } else if (sec >= incidentData.timeline.planeApproach && sec < incidentData.timeline.planeLanding) {
          if (!isApproaching) {
            setIsApproaching(true);
            setIsLanding(false);
            setHasLanded(false);
          }
        } else if (sec >= incidentData.timeline.planeLanding && sec < incidentData.timeline.planeLanded) {
          if (!isLanding) {
            setIsApproaching(false);
            setIsLanding(true);
            setHasLanded(false);
          }
        } else if (sec >= incidentData.timeline.planeLanded) {
          if (!hasLanded) {
            setIsApproaching(false);
            setIsLanding(false);
            setHasLanded(true);
          }
        }

        // 소방차 로직
        if (sec < incidentData.timeline.truckDispatch) {
          setIsDeploying(false);
          setTruckPos(incidentData.emergencyUnit.startPos);
        } else if (sec >= incidentData.timeline.truckDispatch && !isDeploying) {
          setIsDeploying(true);
        }

        // 활주로 폐쇄
        if (sec < incidentData.timeline.runwayClosure) {
          setIs4RClosed(false);
        } else if (sec >= incidentData.timeline.runwayClosure && !is4RClosed) {
          setIs4RClosed(true);
          setContaminationLevel('MODERATE');
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [player, isApproaching, isLanding, hasLanded, isDeploying, is4RClosed, incidentData]);

  // 소방차 애니메이션
  useEffect(() => {
    if (!incidentData || !isDeploying) return;
    const moveInterval = setInterval(() => {
      setTruckPos(prev => {
        if (!prev) return prev;
        const dLng = (incidentData.emergencyUnit.targetPos.lng - prev.lng) * 0.05;
        const dLat = (incidentData.emergencyUnit.targetPos.lat - prev.lat) * 0.05;
        if (Math.abs(dLng) < 0.00001) {
          clearInterval(moveInterval);
          return incidentData.emergencyUnit.targetPos;
        }
        return { lng: prev.lng + dLng, lat: prev.lat + dLat };
      });
    }, 50);
    return () => clearInterval(moveInterval);
  }, [isDeploying, incidentData]);

  // 비행기 접근 애니메이션
  useEffect(() => {
    if (!incidentData || !isApproaching) return;
    const approachInterval = setInterval(() => {
      setPlanePos(prev => {
        if (!prev) return prev;
        const dLng = (incidentData.flightPath.approach.lng - prev.lng) * 0.02;
        const dLat = (incidentData.flightPath.approach.lat - prev.lat) * 0.02;
        if (Math.abs(dLng) < 0.0001) {
          clearInterval(approachInterval);
          return incidentData.flightPath.approach;
        }
        return { lng: prev.lng + dLng, lat: prev.lat + dLat };
      });
    }, 50);
    return () => clearInterval(approachInterval);
  }, [isApproaching, incidentData]);

  // 비행기 착륙 애니메이션
  useEffect(() => {
    if (!incidentData || !isLanding) return;
    const landInterval = setInterval(() => {
      setPlanePos(prev => {
        if (!prev) return prev;
        const dLng = (incidentData.flightPath.landing.lng - prev.lng) * 0.03;
        const dLat = (incidentData.flightPath.landing.lat - prev.lat) * 0.03;
        if (Math.abs(dLng) < 0.0001) {
          clearInterval(landInterval);
          return incidentData.flightPath.landing;
        }
        return { lng: prev.lng + dLng, lat: prev.lat + dLat };
      });
    }, 50);
    return () => clearInterval(landInterval);
  }, [isLanding, incidentData]);

  // 카메라 팔로잉
  useEffect(() => {
    if (!planePos) return;
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
    if (player) player.setVolume(newVolume);
  };

  const jumpToEvent = (time) => {
    if (player) player.seekTo(time);
  };

  const currentSubtitle = incidentData
    ? [...incidentData.subtitles].reverse().find(s => s.time <= currentTime)
    : null;

  const getFlightData = () => {
    if (!incidentData) return { altitude: 0, speed: 0, status: 'NO DATA', distance: 0 };
    const sec = Math.floor(currentTime);

    if (sec < incidentData.timeline.planeApproach) {
      return { altitude: 3500, speed: 180, status: 'INBOUND', distance: 15.2 };
    } else if (isApproaching) {
      const progress = (sec - incidentData.timeline.planeApproach) /
                       (incidentData.timeline.planeLanding - incidentData.timeline.planeApproach);
      return {
        altitude: Math.round(3500 - (3500 - 1500) * progress),
        speed: Math.round(180 - (180 - 150) * progress),
        status: 'APPROACH',
        distance: Math.round(15.2 - 15.2 * progress * 10) / 10
      };
    } else if (isLanding) {
      const progress = (sec - incidentData.timeline.planeLanding) /
                       (incidentData.timeline.planeLanded - incidentData.timeline.planeLanding);
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
  const contaminationLevels = incidentData?.contaminationLevels || {};
  const contaminationStyle = contaminationLevels[contaminationLevel] || { width: 20, opacity: 0.6, color: '#ffaa00' };
  const criticalEvents = incidentData?.criticalEvents || [];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a' }}>

      {/* 상단 헤더 */}
      <div style={{ height: '60px', background: 'linear-gradient(90deg, #1a1a1a 0%, #0a0a0a 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', borderBottom: '2px solid #00ff00', boxShadow: '0 4px 20px rgba(0,255,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ fontSize: '22px', color: '#00ff00', margin: 0, fontWeight: 'bold', letterSpacing: '2px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
            📡 ATC INCIDENT ANALYZER
          </h1>
          <span style={{ fontSize: '14px', color: '#888', fontFamily: 'monospace' }}>
            {incidentData ? `${incidentData.airport} | ${incidentData.flightCallsign}` : 'NO DATA LOADED'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* 파일 업로드 버튼 */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px',
            backgroundColor: '#1a1a1a',
            border: '2px solid #00ff00',
            borderRadius: '6px',
            color: '#00ff00',
            fontSize: '13px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            boxShadow: '0 0 8px rgba(0,255,0,0.3)',
            transition: 'background-color 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#003300'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a1a1a'}
          >
            📂 LOAD JSON
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          <div style={{ fontSize: '18px', color: '#00ff00', fontFamily: 'monospace', fontWeight: 'bold', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
            ⏱ {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* 데이터 미로드 안내 */}
      {!incidentData && (
        <div style={{
          height: '50px',
          backgroundColor: '#1a1a00',
          color: '#ffff00',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          fontFamily: 'monospace',
          borderBottom: '2px solid #ffff00'
        }}>
          ⚠ JSON 파일을 업로드하면 비행 경로 시뮬레이션이 시작됩니다 — 우측 상단의 📂 LOAD JSON 버튼을 클릭하세요.
        </div>
      )}

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

      <div style={{ flex: 1, display: 'flex', gap: '2px', backgroundColor: '#0a0a0a' }}>

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

            {incidentData && hasLanded && (
              <Source type="geojson" data={incidentData.contaminationPath}>
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

            {incidentData && is4RClosed && (
              <Source type="geojson" data={incidentData.runwayCenterline}>
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

            {incidentData && incidentData.locations.map(loc => (
              <Marker key={loc.id} longitude={loc.lng} latitude={loc.lat}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '20px' }}>{(is4RClosed && loc.id.includes('4R')) ? '❌' : '📍'}</span>
                  <div style={{ color: (is4RClosed && loc.id.includes('4R')) ? 'red' : 'yellow', fontWeight: 'bold', fontSize: '10px', textShadow: '0 0 5px black' }}>
                    {loc.name}
                  </div>
                </div>
              </Marker>
            ))}

            {truckPos && (
              <Marker longitude={truckPos.lng} latitude={truckPos.lat}>
                <div style={{ fontSize: '30px', backgroundColor: 'rgba(255, 0, 0, 0.3)', borderRadius: '50%', padding: '5px' }}>🚒</div>
              </Marker>
            )}

            {planePos && (isApproaching || isLanding || hasLanded) && (
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
            {incidentData && (
              <div style={{ marginBottom: '20px', border: '2px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                <YouTube
                  videoId={incidentData.videoId}
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
            )}

            <div style={{ border: '2px solid #00ff00', padding: '15px', backgroundColor: '#0a0a0a', borderRadius: '8px', boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#00ff00', borderBottom: '2px solid #00ff00', paddingBottom: '8px', fontSize: '16px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                ✈️ FLIGHT DATA
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '3px' }}>CALLSIGN</div>
                  <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '15px' }}>{incidentData?.flightCallsign ?? '—'}</div>
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
              {criticalEvents.length === 0 ? (
                <div style={{ color: '#555', fontFamily: 'monospace', fontSize: '13px' }}>데이터 없음 — JSON을 업로드하세요.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {criticalEvents.map(event => (
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
              )}
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
