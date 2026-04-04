const SEVERITY_COLOR = { HIGH: 'var(--accent-red)', MEDIUM: 'var(--accent-amber)', LOW: 'var(--accent-green)' };

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TranscriptPanel({ analyzed, activeTime, onSegmentClick }) {
  const incidents = analyzed.filter(s => s.hasIncident || s.hasWarning);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* 이벤트 사이드바 */}
      {incidents.length > 0 && (
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          background: 'var(--navy-light)',
          padding: '12px 0',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 12px', marginBottom: 8 }}>
            감지된 이벤트
          </div>
          {incidents.map((seg, i) => {
            const topEvent = seg.events.sort((a, b) =>
              ['HIGH','MEDIUM','LOW'].indexOf(a.severity) - ['HIGH','MEDIUM','LOW'].indexOf(b.severity)
            )[0];
            return (
              <div
                key={i}
                onClick={() => onSegmentClick(seg.start)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${SEVERITY_COLOR[topEvent.severity]}`,
                  margin: '2px 0',
                  background: Math.abs(activeTime - seg.start) < 3 ? 'var(--navy-mid)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 2 }}>
                  {fmt(seg.start)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLOR[topEvent.severity] }}>
                  {topEvent.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {seg.text}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 전체 트랜스크립트 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 16px', marginBottom: 4 }}>
          Full Transcript
        </div>
        {analyzed.map((seg, i) => {
          const isActive = Math.abs(activeTime - seg.start) < 3;
          const topEvent = seg.events?.[0];
          const borderColor = topEvent ? SEVERITY_COLOR[topEvent.severity] : null;

          return (
            <div
              key={i}
              onClick={() => onSegmentClick(seg.start)}
              style={{
                margin: '2px 10px',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: isActive ? 'var(--navy-mid)' : 'transparent',
                borderLeft: borderColor ? `3px solid ${borderColor}` : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', minWidth: 36 }}>
                  {fmt(seg.start)}
                </span>
                {seg.events?.map((ev, j) => (
                  <span key={j} style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    color: '#fff', background: SEVERITY_COLOR[ev.severity],
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {ev.label}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: seg.hasIncident ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5 }}>
                {seg.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
