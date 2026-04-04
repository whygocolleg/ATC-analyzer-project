/**
 * EventBadge — floating alert that appears when a timed event is active
 */
const SEVERITY_COLOR = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function EventBadge({ event }) {
  if (!event) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(15,23,42,0.95)',
      border: `1px solid ${SEVERITY_COLOR[event.severity] || '#6b7280'}`,
      borderLeft: `4px solid ${SEVERITY_COLOR[event.severity] || '#6b7280'}`,
      borderRadius: 8,
      padding: '10px 18px',
      color: '#f1f5f9',
      fontFamily: 'monospace',
      fontSize: 13,
      maxWidth: 480,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      zIndex: 200,
      pointerEvents: 'none',
    }}>
      <span style={{ color: SEVERITY_COLOR[event.severity], fontWeight: 700 }}>
        {formatTime(event.timestamp)}
      </span>
      {' — '}
      {event.description}
    </div>
  );
}
