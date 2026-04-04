import { useRef, useState, useEffect } from 'react';

export default function AudioPlayer({ audioFile, onFileSelected }) {
  const inputRef = useRef(null);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 파일이 바뀌면 재생 상태 초기화
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioFile]);

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) onFileSelected(file);
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }

  function handleSeek(e) {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 16px' }}>

      {/* 섹션 레이블 */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
        Audio Source
      </div>

      {/* 드롭 존 */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${audioFile ? 'var(--accent-blue)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '32px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: audioFile ? 'rgba(59,130,246,0.06)' : 'var(--input-bg)',
          transition: 'border-color 0.2s, background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.6 }}>🎙</div>
        {audioFile ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {audioFile.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>클릭해서 다른 파일로 교체</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              MP3 파일을 드래그하거나 클릭하여 업로드
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>mp3, wav, m4a, ogg 지원</div>
          </>
        )}
        <input ref={inputRef} type="file" accept="audio/*" onChange={handleFileInput} style={{ display: 'none' }} />
      </div>

      {/* 오디오 플레이어 */}
      {audioFile && (
        <div style={{
          marginTop: 20,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px',
          flexShrink: 0,
        }}>
          {/* 숨겨진 네이티브 오디오 */}
          <audio
            ref={audioRef}
            src={audioFile.url}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onEnded={() => setPlaying(false)}
          />

          {/* 재생 버튼 + 시간 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <button
              onClick={togglePlay}
              style={{
                width: 40, height: 40,
                borderRadius: '50%',
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#fff',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, fontFamily: 'monospace' }}>
                {fmt(currentTime)} / {fmt(duration)}
              </div>
            </div>
          </div>

          {/* 시크 바 */}
          <div style={{ position: 'relative', height: 4, background: 'var(--border)', borderRadius: 2, cursor: 'pointer' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${progress}%`,
              background: 'var(--accent-blue)',
              borderRadius: 2,
              pointerEvents: 'none',
            }} />
            <input
              type="range" min={0} max={duration || 0} step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer', margin: 0,
              }}
            />
          </div>
        </div>
      )}

      {/* 안내 */}
      <div style={{ marginTop: 'auto', paddingTop: 24, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          무료 ATC 오디오 소스
        </div>
        liveatc.net에서 실제 관제 녹음 파일을 무료로 다운로드할 수 있습니다.
      </div>
    </div>
  );
}
