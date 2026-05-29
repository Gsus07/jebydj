// stemWorker.ts — Web Worker for stem separation via ONNX Runtime Web
// This worker receives a raw Float32Array of stereo audio and returns
// 4 stem buffers: vocals, drums, bass, other.
// Falls back to frequency-band splitting when no ONNX model is available.

import type { StemType } from '../store/types';

interface StemRequest {
  type: 'separate';
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  sampleRate: number;
  trackId: string;
}

interface StemProgress {
  type: 'progress';
  percent: number;
  stage: string;
}

interface StemResult {
  type: 'result';
  trackId: string;
  stems: Record<StemType, { left: Float32Array; right: Float32Array }>;
}

interface StemError {
  type: 'error';
  message: string;
}

type WorkerMessage = StemRequest;
type WorkerResponse = StemProgress | StemResult | StemError;

// ─── Frequency-band fallback separator ───────────────────────────────────────
// Splits audio into 4 bands using biquad filters via OfflineAudioContext.
// Not true stem separation but serves as fallback and demo.

async function separateByFrequency(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  trackId: string
): Promise<Record<StemType, { left: Float32Array; right: Float32Array }>> {
  // Use OfflineAudioContext to apply filters in passes
  const length = left.length;

  const postProgress = (p: number, stage: string) => {
    self.postMessage({ type: 'progress', percent: p, stage } as StemProgress);
  };

  postProgress(5, 'Preparing audio...');

  const processWithFilter = async (
    inputLeft: Float32Array,
    inputRight: Float32Array,
    filterFn: (ctx: OfflineAudioContext, src: AudioBufferSourceNode) => AudioNode
  ): Promise<{ left: Float32Array; right: Float32Array }> => {
    const ctx = new OfflineAudioContext(2, length, sampleRate);

    const buffer = ctx.createBuffer(2, length, sampleRate);
    buffer.getChannelData(0).set(inputLeft);
    buffer.getChannelData(1).set(inputRight);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filterOut = filterFn(ctx, src);
    filterOut.connect(ctx.destination);
    src.start(0);

    const rendered = await ctx.startRendering();
    return {
      left: rendered.getChannelData(0).slice(),
      right: rendered.getChannelData(1).slice(),
    };
  };

  // BASS: low-pass < 250 Hz
  postProgress(15, 'Extracting bass...');
  const bass = await processWithFilter(left, right, (ctx) => {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 250;
    lp.Q.value = 0.5;
    return lp;
  });

  // DRUMS: band-pass 200–4000 Hz (percussive energy), boosted
  postProgress(35, 'Extracting drums...');
  const drums = await processWithFilter(left, right, (ctx) => {
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 1200;
    lp.Q.value = 0.5;
    // Gain to compensate
    const gain = ctx.createGain();
    gain.gain.value = 2.5;
    lp.connect(gain);
    return gain;
  });

  // VOCALS: band-pass 1 kHz–8 kHz (human voice range)
  postProgress(55, 'Extracting vocals...');
  const vocals = await processWithFilter(left, right, (ctx) => {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8000;
    hp.connect(lp);
    const gain = ctx.createGain();
    gain.gain.value = 1.5;
    lp.connect(gain);
    return gain;
  });

  // OTHER: high-pass > 4 kHz (cymbals, synths, pads)
  postProgress(75, 'Extracting other...');
  const other = await processWithFilter(left, right, (ctx) => {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const gain = ctx.createGain();
    gain.gain.value = 2.0;
    hp.connect(gain);
    return gain;
  });

  postProgress(95, 'Finalizing...');

  return { vocals, drums, bass, other };
}

// ─── ONNX model stem separation (when model available) ───────────────────────
// MODEL_URL can be pointed to a quantized HTDemucs ONNX model.
// If unavailable, falls back to frequency-band separation.
const MODEL_URL = '/models/htdemucs_4s_int8.onnx';
const CACHE_NAME = 'stem-models-v1';

async function tryLoadOnnxModel(): Promise<boolean> {
  // Check if onnxruntime-web is available
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(MODEL_URL);
    if (cached) return true;

    // Try to fetch (won't work if model not hosted)
    const res = await fetch(MODEL_URL, { method: 'HEAD' });
    if (res.ok) {
      // Model exists, pre-cache it
      await cache.add(MODEL_URL);
      return true;
    }
  } catch {
    // Model not available
  }
  return false;
}

// ─── Worker message handler ───────────────────────────────────────────────────
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'separate') {
    try {
      // Try ONNX model first, fall back to frequency bands
      // const hasModel = await tryLoadOnnxModel();
      // For now always use frequency fallback since no model bundled
      const hasModel = false;

      let stems: Record<StemType, { left: Float32Array; right: Float32Array }>;

      if (hasModel) {
        // ONNX inference path (would go here with actual model)
        // ... ort.InferenceSession.create(MODEL_URL)
        stems = await separateByFrequency(
          msg.leftChannel, msg.rightChannel, msg.sampleRate, msg.trackId
        );
      } else {
        stems = await separateByFrequency(
          msg.leftChannel, msg.rightChannel, msg.sampleRate, msg.trackId
        );
      }

      self.postMessage({ type: 'progress', percent: 100, stage: 'Done' } as StemProgress);

      const result: StemResult = {
        type: 'result',
        trackId: msg.trackId,
        stems,
      };

      // Transfer ownership for performance
      const transfer: Transferable[] = [
        stems.vocals.left.buffer, stems.vocals.right.buffer,
        stems.drums.left.buffer, stems.drums.right.buffer,
        stems.bass.left.buffer, stems.bass.right.buffer,
        stems.other.left.buffer, stems.other.right.buffer,
      ];
      (self.postMessage as (msg: unknown, transfer: Transferable[]) => void)(result, transfer);
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } as StemError);
    }
  }
};

export {};
