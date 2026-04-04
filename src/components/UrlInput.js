/**
 * UrlInput — YouTube URL form + analysis trigger
 */
import { useState } from 'react';

export default function UrlInput({ onSubmit, loading }) {
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="url"
        placeholder="YouTube ATC URL (e.g. https://youtu.be/…)"
        value={url}
        onChange={e => setUrl(e.target.value)}
        disabled={loading}
        style={{
          flex: 1,
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.07)',
          color: '#f1f5f9',
          fontSize: 13,
          outline: 'none',
          minWidth: 0,
        }}
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        style={{
          padding: '6px 16px',
          borderRadius: 6,
          border: 'none',
          background: loading ? '#374151' : '#2563eb',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  );
}
