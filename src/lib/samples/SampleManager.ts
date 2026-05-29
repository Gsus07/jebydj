// ─── SampleManager — LRU cache + preview engine ───────────────────────────────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { dbLoadBuffer, dbSaveBuffer } from './SampleDatabase';
import { useSampleStore } from '@/src/store/useSampleStore';

// ─── LRU Cache ────────────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, val: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.capacity) {
      this.map.delete(this.map.keys().next().value as K);
    }
  }

  has(key: K): boolean { return this.map.has(key); }
  delete(key: K): void { this.map.delete(key); }
  size(): number { return this.map.size; }
}

// ─── SampleManagerClass ───────────────────────────────────────────────────────

class SampleManagerClass {
  // LRU: 200 AudioBuffers for samples < 5s
  private bufferCache = new LRUCache<string, AudioBuffer>(200);
  // Raw ArrayBuffer store for import (before decode)
  private rawCache = new LRUCache<string, ArrayBuffer>(50);

  private previewSource: AudioBufferSourceNode | null = null;
  private previewGain: GainNode | null = null;
  private previewStartTime = 0;
  private previewDuration = 0;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private currentPreviewId: string | null = null;

  // ─── Store buffer in cache + IndexedDB ─────────────────────────────────────

  storeBuffer(id: string, buffer: AudioBuffer): void {
    this.bufferCache.set(id, buffer);
  }

  storeRaw(id: string, raw: ArrayBuffer): void {
    this.rawCache.set(id, raw);
  }

  async getOrDecodeBuffer(id: string): Promise<AudioBuffer | null> {
    // 1. LRU memory cache
    const cached = this.bufferCache.get(id);
    if (cached) return cached;

    // 2. IndexedDB
    const raw = await dbLoadBuffer(id);
    if (!raw) return null;

    if (!audioEngine.isInitialized()) return null;
    try {
      const decoded = await audioEngine.ctx.decodeAudioData(raw.slice(0));
      this.bufferCache.set(id, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  // ─── Import a File → decode + analyze + cache ──────────────────────────────

  async importFile(file: File): Promise<{ id: string; buffer: AudioBuffer; raw: ArrayBuffer }> {
    const raw = await file.arrayBuffer();
    if (!audioEngine.isInitialized()) await audioEngine.initialize();
    const buffer = await audioEngine.ctx.decodeAudioData(raw.slice(0));
    const id = await hashArrayBuffer(raw);
    this.bufferCache.set(id, buffer);
    this.rawCache.set(id, raw);
    // Persist if small enough (< 10MB)
    if (raw.byteLength < 10 * 1024 * 1024) {
      await dbSaveBuffer(id, raw);
    }
    return { id, buffer, raw };
  }

  // ─── Preview playback ──────────────────────────────────────────────────────

  async playPreview(sampleId: string, volume: number, bpmSync?: { sampleBpm: number; masterBpm: number }): Promise<void> {
    this.stopPreview();

    // Ensure AudioContext is running (browsers suspend it until user gesture)
    if (!audioEngine.isInitialized()) audioEngine.initialize();
    if (audioEngine.ctx.state !== 'running') {
      await audioEngine.ctx.resume();
    }

    const buffer = await this.getOrDecodeBuffer(sampleId);
    if (!buffer) return;

    this.currentPreviewId = sampleId;

    const gain = audioEngine.ctx.createGain();
    gain.gain.value = volume;
    gain.connect(audioEngine.masterGain);

    const src = audioEngine.ctx.createBufferSource();
    src.buffer = buffer;

    // BPM sync: stretch playback rate
    if (bpmSync && bpmSync.sampleBpm > 0) {
      src.playbackRate.value = bpmSync.masterBpm / bpmSync.sampleBpm;
    }

    src.connect(gain);
    this.previewSource = src;
    this.previewGain = gain;
    this.previewStartTime = audioEngine.ctx.currentTime;
    this.previewDuration = buffer.duration / (src.playbackRate.value || 1);

    src.start(0);
    src.onended = () => {
      this.stopProgressTracking();
      useSampleStore.getState().setPreview(null);
      this.currentPreviewId = null;
    };

    this.startProgressTracking();
  }

  stopPreview(): void {
    if (this.previewSource) {
      try { this.previewSource.stop(); } catch { /* already stopped */ }
      this.previewSource.disconnect();
      this.previewSource = null;
    }
    if (this.previewGain) {
      this.previewGain.disconnect();
      this.previewGain = null;
    }
    this.stopProgressTracking();
    this.currentPreviewId = null;
  }

  setPreviewVolume(volume: number): void {
    if (this.previewGain) this.previewGain.gain.value = volume;
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    this.progressInterval = setInterval(() => {
      if (!audioEngine.isInitialized() || !this.currentPreviewId) return;
      const elapsed = audioEngine.ctx.currentTime - this.previewStartTime;
      const progress = Math.min(elapsed / this.previewDuration, 1);
      useSampleStore.getState().setPreviewProgress(progress);
    }, 50);
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    useSampleStore.getState().setPreviewProgress(0);
  }

  // ─── Analysis (run in main thread — callers should use a worker for bulk) ──

  analyzeBuffer(buffer: AudioBuffer): {
    waveformData: number[];
    rms: number;
    peak: number;
    duration: number;
  } {
    const ch = buffer.getChannelData(0);
    const POINTS = 200;
    const blockSize = Math.floor(ch.length / POINTS);
    const waveformData: number[] = [];
    let rmsSum = 0;
    let peak = 0;

    for (let i = 0; i < POINTS; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const abs = Math.abs(ch[i * blockSize + j] ?? 0);
        if (abs > max) max = abs;
      }
      waveformData.push(max);
      if (max > peak) peak = max;
      rmsSum += max * max;
    }

    const rms = Math.sqrt(rmsSum / POINTS);
    return { waveformData, rms, peak, duration: buffer.duration };
  }

  computeFeatures(buffer: AudioBuffer): import('@/src/store/sampleTypes').SampleFeatures {
    const ch = buffer.getChannelData(0);
    const len = ch.length;
    const sr = buffer.sampleRate;

    // RMS
    let sumSq = 0;
    for (let i = 0; i < len; i++) sumSq += ch[i] * ch[i];
    const rms = Math.sqrt(sumSq / len);

    // Zero crossing rate
    let zcr = 0;
    for (let i = 1; i < len; i++) {
      if ((ch[i] >= 0) !== (ch[i - 1] >= 0)) zcr++;
    }
    const zeroCrossingRate = zcr / len;

    // Attack time (time to reach 90% of peak)
    let peak = 0;
    for (let i = 0; i < len; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
    const threshold = peak * 0.9;
    let attackSamples = 0;
    for (let i = 0; i < len; i++) { if (Math.abs(ch[i]) >= threshold) { attackSamples = i; break; } }
    const attackTime = attackSamples / sr;

    // Spectral centroid (simplified: use short FFT on first 4096 samples)
    const fftSize = Math.min(4096, ch.length);
    let weightedFreq = 0;
    let totalMag = 0;
    for (let i = 0; i < fftSize / 2; i++) {
      const re = ch[i * 2] ?? 0;
      const im = ch[i * 2 + 1] ?? 0;
      const mag = Math.sqrt(re * re + im * im);
      const freq = (i / fftSize) * sr;
      weightedFreq += freq * mag;
      totalMag += mag;
    }
    const centroid = totalMag > 0 ? weightedFreq / totalMag : 0;
    const spectralCentroid = Math.min(centroid / (sr / 2), 1);

    // Spectral flatness (ratio of geometric to arithmetic mean of magnitude spectrum)
    let geoSum = 0;
    let arithSum = 0;
    const N = fftSize / 2;
    for (let i = 0; i < N; i++) {
      const re = ch[i * 2] ?? 0;
      const im = ch[i * 2 + 1] ?? 0;
      const mag = Math.sqrt(re * re + im * im) + 1e-10;
      geoSum += Math.log(mag);
      arithSum += mag;
    }
    const geoMean = Math.exp(geoSum / N);
    const arithMean = arithSum / N;
    const spectralFlatness = arithMean > 0 ? Math.min(geoMean / arithMean, 1) : 0;

    return {
      spectralCentroid,
      spectralFlatness,
      rms: Math.min(rms, 1),
      zeroCrossingRate: Math.min(zeroCrossingRate * 100, 1),
      attackTime,
      duration: buffer.duration,
    };
  }

  similarityScore(a: import('@/src/store/sampleTypes').SampleFeatures, b: import('@/src/store/sampleTypes').SampleFeatures): number {
    const keys: (keyof import('@/src/store/sampleTypes').SampleFeatures)[] = [
      'spectralCentroid', 'spectralFlatness', 'rms', 'zeroCrossingRate', 'attackTime',
    ];
    let dist = 0;
    for (const k of keys) {
      const diff = (a[k] as number) - (b[k] as number);
      dist += diff * diff;
    }
    return Math.max(0, 1 - Math.sqrt(dist));
  }

  async findSimilar(refId: string, candidates: import('@/src/store/sampleTypes').SampleItem[]): Promise<string[]> {
    const refItem = candidates.find((c) => c.id === refId);
    if (!refItem?.features) return [];
    const scored = candidates
      .filter((c) => c.id !== refId && c.features)
      .map((c) => ({ id: c.id, score: this.similarityScore(refItem.features!, c.features!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return scored.map((s) => s.id);
  }
}

// ─── SHA-256 hex hash of an ArrayBuffer ──────────────────────────────────────

export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const sampleManager = new SampleManagerClass();
