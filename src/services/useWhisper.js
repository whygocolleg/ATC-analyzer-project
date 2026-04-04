import { useState, useRef, useCallback } from 'react';

/**
 * 브라우저 Web Worker 기반 Whisper STT 훅
 * audioFile: { file: File, url: string }
 * 반환: { transcribe, status, progress, segments, isLoading }
 */
export function useWhisper() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [segments, setSegments] = useState([]);
  const workerRef = useRef(null);

  const transcribe = useCallback(async (file) => {
    setStatus('decoding');
    setProgress(0);
    setSegments([]);

    // 오디오 파일 → Float32Array (AudioContext로 디코딩)
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    // 모노 채널로 병합
    let float32;
    if (decoded.numberOfChannels > 1) {
      const ch0 = decoded.getChannelData(0);
      const ch1 = decoded.getChannelData(1);
      float32 = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) float32[i] = (ch0[i] + ch1[i]) / 2;
    } else {
      float32 = decoded.getChannelData(0);
    }

    // 기존 Worker 종료
    if (workerRef.current) workerRef.current.terminate();

    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('./whisperWorker.js', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'status') {
          setStatus(msg.message);
        } else if (msg.type === 'progress') {
          setStatus(msg.message);
          setProgress(msg.value);
        } else if (msg.type === 'done') {
          const chunks = msg.result.chunks || [];
          const parsed = chunks.map(c => ({
            start: c.timestamp?.[0] ?? 0,
            end: c.timestamp?.[1] ?? 0,
            text: c.text.trim(),
          })).filter(c => c.text);
          setSegments(parsed);
          setStatus('done');
          setProgress(100);
          worker.terminate();
          resolve(parsed);
        } else if (msg.type === 'error') {
          setStatus('error');
          worker.terminate();
          reject(new Error(msg.message));
        }
      };

      worker.postMessage({
        type: 'transcribe',
        audioData: float32.buffer,
        sampleRate: decoded.sampleRate,
      }, [float32.buffer]);
    });
  }, []);

  const isLoading = !['idle', 'done', 'error'].includes(status);

  return { transcribe, status, progress, segments, isLoading };
}
