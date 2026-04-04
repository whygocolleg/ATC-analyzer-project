/* eslint-disable no-restricted-globals */
// Web Worker — 브라우저 메인 스레드를 블록하지 않고 Whisper 추론을 실행합니다.
import { pipeline, env } from '@xenova/transformers';

// 캐시를 로컬에 저장 (재시작 시 재다운로드 방지)
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

async function getTranscriber(progressCallback) {
  if (!transcriber) {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        progress_callback: progressCallback,
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      }
    );
  }
  return transcriber;
}

self.addEventListener('message', async (e) => {
  const { type, audioData, sampleRate } = e.data;

  if (type !== 'transcribe') return;

  try {
    self.postMessage({ type: 'status', message: '모델 로딩 중...' });

    const t = await getTranscriber((progress) => {
      if (progress.status === 'downloading') {
        self.postMessage({
          type: 'progress',
          message: `모델 다운로드 중... ${Math.round(progress.progress || 0)}%`,
          value: progress.progress || 0,
        });
      }
    });

    self.postMessage({ type: 'status', message: '음성 인식 중...' });

    // Float32Array로 변환
    const float32 = new Float32Array(audioData);

    const result = await t(float32, {
      sampling_rate: sampleRate,
      return_timestamps: true,
    });

    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
});
