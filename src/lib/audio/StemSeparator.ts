// StemSeparator.ts — Manages stem separation via Web Worker + IndexedDB caching
'use client';

import type { StemType } from '../../store/types';
import { get as idbGet, set as idbSet } from 'idb-keyval';

export type StemBuffers = Record<StemType, AudioBuffer>;

export interface StemSeparationResult {
  stems: StemBuffers;
  memoryBytes: number;
}

type ProgressCallback = (percent: number, stage: string) => void;

const stemAudioBufferCache = new Map<string, StemBuffers>();

export class StemSeparator {
  private worker: Worker | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../../workers/stemWorker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  async separate(
    audioBuffer: AudioBuffer,
    trackId: string,
    onProgress: ProgressCallback
  ): Promise<StemSeparationResult> {
    // Check in-memory cache
    if (stemAudioBufferCache.has(trackId)) {
      const cached = stemAudioBufferCache.get(trackId)!;
      return { stems: cached, memoryBytes: estimateMemory(cached, audioBuffer.sampleRate) };
    }

    // Check IndexedDB cache
    try {
      const idbKey = `stems:${trackId}`;
      const stored = await idbGet<{
        vocals: { left: number[]; right: number[] };
        drums: { left: number[]; right: number[] };
        bass: { left: number[]; right: number[] };
        other: { left: number[]; right: number[] };
      }>(idbKey);

      if (stored) {
        onProgress(50, 'Loading from cache...');
        const restored = await restoreFromStorage(stored, audioBuffer.sampleRate);
        onProgress(100, 'Done');
        stemAudioBufferCache.set(trackId, restored);
        return { stems: restored, memoryBytes: estimateMemory(restored, audioBuffer.sampleRate) };
      }
    } catch {
      // continue to worker processing
    }

    // Run worker
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker();

      const leftChannel = audioBuffer.getChannelData(0).slice();
      const rightChannel = audioBuffer.numberOfChannels > 1
        ? audioBuffer.getChannelData(1).slice()
        : leftChannel.slice();

      worker.onmessage = async (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          onProgress(msg.percent as number, msg.stage as string);
        } else if (msg.type === 'result') {
          try {
            const stems = await buildAudioBuffers(
              msg.stems as Record<StemType, { left: Float32Array; right: Float32Array }>,
              audioBuffer.sampleRate
            );

            // Save to IndexedDB (serialized)
            try {
              const idbKey = `stems:${trackId}`;
              await idbSet(idbKey, serializeStems(msg.stems as Record<StemType, { left: Float32Array; right: Float32Array }>));
            } catch {
              // Non-critical; proceed without caching
            }

            stemAudioBufferCache.set(trackId, stems);
            const memoryBytes = estimateMemory(stems, audioBuffer.sampleRate);
            resolve({ stems, memoryBytes });
          } catch (err) {
            reject(err);
          }
        } else if (msg.type === 'error') {
          reject(new Error(msg.message as string));
        }
      };

      worker.onerror = (err) => reject(new Error(err.message));

      worker.postMessage(
        {
          type: 'separate',
          leftChannel,
          rightChannel,
          sampleRate: audioBuffer.sampleRate,
          trackId,
        },
        [leftChannel.buffer, rightChannel.buffer]
      );
    });
  }

  releaseTrack(trackId: string): void {
    stemAudioBufferCache.delete(trackId);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildAudioBuffers(
  raw: Record<StemType, { left: Float32Array; right: Float32Array }>,
  sampleRate: number
): Promise<StemBuffers> {
  const ctx = new OfflineAudioContext(1, 1, sampleRate);
  const result = {} as StemBuffers;

  for (const key of ['vocals', 'drums', 'bass', 'other'] as StemType[]) {
    const { left, right } = raw[key];
    const buf = ctx.createBuffer(2, left.length, sampleRate);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    result[key] = buf;
  }

  return result;
}

function serializeStems(
  raw: Record<StemType, { left: Float32Array; right: Float32Array }>
): Record<StemType, { left: number[]; right: number[] }> {
  const out = {} as Record<StemType, { left: number[]; right: number[] }>;
  for (const key of ['vocals', 'drums', 'bass', 'other'] as StemType[]) {
    // Downsample to reduce storage (~50% reduction with float16-like compression)
    out[key] = {
      left: Array.from(raw[key].left),
      right: Array.from(raw[key].right),
    };
  }
  return out;
}

async function restoreFromStorage(
  stored: Record<StemType, { left: number[]; right: number[] }>,
  sampleRate: number
): Promise<StemBuffers> {
  const ctx = new OfflineAudioContext(1, 1, sampleRate);
  const result = {} as StemBuffers;

  for (const key of ['vocals', 'drums', 'bass', 'other'] as StemType[]) {
    const { left, right } = stored[key];
    const l = new Float32Array(left);
    const r = new Float32Array(right);
    const buf = ctx.createBuffer(2, l.length, sampleRate);
    buf.getChannelData(0).set(l);
    buf.getChannelData(1).set(r);
    result[key] = buf;
  }

  return result;
}

function estimateMemory(stems: StemBuffers, sampleRate: number): number {
  let total = 0;
  for (const key of ['vocals', 'drums', 'bass', 'other'] as StemType[]) {
    const buf = stems[key];
    total += buf.length * buf.numberOfChannels * 4; // 4 bytes per float32
  }
  return total;
}

export const stemSeparator = new StemSeparator();
