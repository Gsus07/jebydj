// Exporter.ts — Bounce project to WAV or MP3

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { getAudioBuffer } from './DAWEngine';
import { beatsToSeconds } from './TimeSignature';
import type { DAWProject, ExportOptions } from '@/src/store/dawTypes';

// ─── WAV Encoding ─────────────────────────────────────────────────────────────

function encodeWAV(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 | 32,
): ArrayBuffer {
  const channels = 2;
  const bytesPerSample = bitDepth === 32 ? 4 : bitDepth === 24 ? 3 : 2;
  const dataLength = left.length * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // 3 = IEEE float, 1 = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < left.length; i++) {
    const L = Math.max(-1, Math.min(1, left[i]));
    const R = Math.max(-1, Math.min(1, right[i]));

    if (bitDepth === 32) {
      view.setFloat32(offset, L, true); offset += 4;
      view.setFloat32(offset, R, true); offset += 4;
    } else if (bitDepth === 24) {
      const lv = Math.floor(L * 8388607);
      const rv = Math.floor(R * 8388607);
      view.setUint8(offset, lv & 0xff); view.setUint8(offset + 1, (lv >> 8) & 0xff); view.setUint8(offset + 2, (lv >> 16) & 0xff);
      view.setUint8(offset + 3, rv & 0xff); view.setUint8(offset + 4, (rv >> 8) & 0xff); view.setUint8(offset + 5, (rv >> 16) & 0xff);
      offset += 6;
    } else {
      view.setInt16(offset, Math.floor(L * 32767), true); offset += 2;
      view.setInt16(offset, Math.floor(R * 32767), true); offset += 2;
    }
  }

  return buffer;
}

// ─── MP3 Encoding ─────────────────────────────────────────────────────────────

async function encodeMP3(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  kbps: number,
): Promise<ArrayBuffer> {
  const { Mp3Encoder } = await import('lamejs');
  const encoder = new Mp3Encoder(2, sampleRate, kbps);
  const BLOCK = 1152;
  const chunks: Int8Array[] = [];

  const toInt16 = (f32: Float32Array): Int16Array => {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      i16[i] = Math.max(-32768, Math.min(32767, Math.floor(f32[i] * 32767)));
    }
    return i16;
  };

  const leftI16 = toInt16(left);
  const rightI16 = toInt16(right);

  for (let i = 0; i < left.length; i += BLOCK) {
    const lChunk = leftI16.subarray(i, i + BLOCK);
    const rChunk = rightI16.subarray(i, i + BLOCK);
    const mp3buf = encoder.encodeBuffer(lChunk, rChunk);
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }

  const flush = encoder.flush();
  if (flush.length > 0) chunks.push(flush);

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
    offset += chunk.length;
  }

  return result.buffer;
}

// ─── Main Bounce ──────────────────────────────────────────────────────────────

export async function bounceProject(
  project: DAWProject,
  options: ExportOptions,
  onProgress?: (progress: number) => void,
): Promise<ArrayBuffer> {
  const startBeat = options.startBeat ?? options.rangeStart ?? 0;
  const endBeat = options.endBeat ?? options.rangeEnd ?? project.totalBeats;
  const kbps = options.kbps ?? 320;
  const { sampleRate, format, bitDepth } = options;
  const durationSec = beatsToSeconds(endBeat - startBeat, project.bpm);

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.connect(offlineCtx.destination);

  // Schedule all audio clips
  for (const track of project.tracks) {
    if (track.muted) continue;

    const trackGain = offlineCtx.createGain();
    trackGain.gain.value = track.volume;
    const trackPan = offlineCtx.createStereoPanner();
    trackPan.pan.value = track.pan;
    trackGain.connect(trackPan);
    trackPan.connect(masterGain);

    for (const clip of track.clips) {
      if (clip.type !== 'audio' || !clip.audioFileId) continue;
      const buffer = getAudioBuffer(clip.audioFileId);
      if (!buffer) continue;

      // Resample buffer for offline context if needed
      const source = offlineCtx.createBufferSource();
      // Transfer buffer data to offline context
      const offlineBuffer = offlineCtx.createBuffer(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate,
      );
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        offlineBuffer.copyToChannel(buffer.getChannelData(ch), ch);
      }
      source.buffer = offlineBuffer;
      source.playbackRate.value = clip.timeStretchRatio;

      const clipGain = offlineCtx.createGain();
      clipGain.gain.value = Math.pow(10, clip.gainDb / 20);
      source.connect(clipGain);
      clipGain.connect(trackGain);

      const clipStartTime = beatsToSeconds(clip.startBeat - startBeat, project.bpm);
      const offset = Math.max(0, beatsToSeconds(startBeat - clip.startBeat, project.bpm));
      const duration = beatsToSeconds(clip.durationBeats, project.bpm) - offset;

      if (clipStartTime + duration > 0 && clipStartTime < durationSec) {
        source.start(Math.max(0, clipStartTime), offset, Math.max(0.001, duration));
      }
    }
  }

  onProgress?.(0.1);

  const rendered = await offlineCtx.startRendering();
  onProgress?.(0.6);

  const left = rendered.getChannelData(0);
  const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0);

  let result: ArrayBuffer;

  if (format === 'mp3') {
    result = await encodeMP3(left, right, sampleRate, kbps ?? 320);
  } else {
    result = encodeWAV(left, right, sampleRate, (bitDepth ?? 24) as 16 | 24 | 32);
  }

  onProgress?.(1.0);
  return result;
}

// ─── Download Helper ──────────────────────────────────────────────────────────

export function downloadAudioFile(buffer: ArrayBuffer, filename: string, mimeType: string): void {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
