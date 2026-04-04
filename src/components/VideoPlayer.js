/**
 * VideoPlayer — 1/4-screen PIP player (top-right, position:fixed)
 * Uses react-player for YouTube playback
 */
import ReactPlayer from 'react-player/youtube';

export default function VideoPlayer({ url, onProgress, playerRef }) {
  if (!url) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 56,           // below header
      right: 16,
      width: '25vw',
      minWidth: 240,
      maxWidth: 400,
      aspectRatio: '16/9',
      zIndex: 100,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        controls
        onProgress={onProgress}
        progressInterval={500}
        config={{
          playerVars: { modestbranding: 1, rel: 0 },
        }}
      />
    </div>
  );
}
