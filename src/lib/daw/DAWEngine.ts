// DAWEngine.ts — Audio scheduling engine, shares AudioContext with DJ engine
// Uses Web Audio clock for all timing — never setTimeout for audio events.

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { useDAWStore } from '@/src/store/useDAWStore';
import { beatsToSeconds, secondsToBeats, bpmToInterval } from './TimeSignature';
import type { DAWClip, DAWTrack } from '@/src/store/dawTypes';

const SCHEDULE_AHEAD = 0.15; // seconds to schedule ahead
const SCHEDULER_INTERVAL = 25; // ms between scheduler ticks

// ─── Audio Buffer Cache ───────────────────────────────────────────────────────

const audioBuffers = new Map<string, AudioBuffer>();

export function storeAudioBuffer(id: string, buffer: AudioBuffer): void {
  audioBuffers.set(id, buffer);
}

export function getAudioBuffer(id: string): AudioBuffer | undefined {
  return audioBuffers.get(id);
}

export function removeAudioBuffer(id: string): void {
  audioBuffers.delete(id);
}

// ─── Track Audio Nodes ────────────────────────────────────────────────────────

interface TrackNodes {
  gain: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
}

const trackNodes = new Map<string, TrackNodes>();

function getOrCreateTrackNodes(trackId: string): TrackNodes {
  if (trackNodes.has(trackId)) return trackNodes.get(trackId)!;
  const ctx = audioEngine.ctx;
  const gain = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  gain.connect(pan);
  pan.connect(analyser);
  analyser.connect(audioEngine.masterGain);
  const nodes: TrackNodes = { gain, pan, analyser };
  trackNodes.set(trackId, nodes);
  return nodes;
}

export function removeTrackNodes(trackId: string): void {
  const nodes = trackNodes.get(trackId);
  if (nodes) {
    try {
      nodes.gain.disconnect();
      nodes.pan.disconnect();
      nodes.analyser.disconnect();
    } catch { /* ignore */ }
    trackNodes.delete(trackId);
  }
}

// ─── Scheduled Sources ────────────────────────────────────────────────────────

interface ScheduledSource {
  source: AudioBufferSourceNode;
  clipId: string;
  endTime: number; // ctx.currentTime when it will end
}

const scheduledSources = new Map<string, ScheduledSource[]>();

function getScheduledSources(clipId: string): ScheduledSource[] {
  if (!scheduledSources.has(clipId)) scheduledSources.set(clipId, []);
  return scheduledSources.get(clipId)!;
}

// ─── Metronome ────────────────────────────────────────────────────────────────

function scheduleMetronomeClick(
  ctx: AudioContext,
  time: number,
  isDownbeat: boolean,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.connect(env);
  env.connect(audioEngine.masterGain);

  osc.frequency.value = isDownbeat ? 1200 : 800;
  osc.type = 'sine';

  env.gain.setValueAtTime(volume * 0.5, time);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  osc.start(time);
  osc.stop(time + 0.06);
}

// ─── DAW Engine Class ─────────────────────────────────────────────────────────

class DAWEngineClass {
  private _schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private _rafId: number | null = null;
  private _playStartContextTime = 0;
  private _playStartPositionBeats = 0;
  private _scheduledUpTo = 0; // ctx.currentTime up to which we've scheduled

  // Metronome tracking
  private _nextMetronomeTime = 0;
  private _metronomeBeat = 0;

  get isPlaying(): boolean {
    return useDAWStore.getState().isPlaying;
  }

  get ctx(): AudioContext {
    return audioEngine.ctx;
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  play(): void {
    if (!audioEngine.isInitialized()) return;
    const state = useDAWStore.getState();

    this._playStartContextTime = this.ctx.currentTime + 0.01; // tiny offset
    this._playStartPositionBeats = state.positionBeats;
    this._scheduledUpTo = this._playStartContextTime;
    this._metronomeBeat = Math.ceil(state.positionBeats);
    this._nextMetronomeTime = this._playStartContextTime +
      beatsToSeconds(this._metronomeBeat - state.positionBeats, state.project.bpm);

    useDAWStore.getState().setPlaying(true);

    // Start scheduler
    this._schedulerTimer = setInterval(() => this._schedule(), SCHEDULER_INTERVAL);
    this._schedule(); // immediate first tick

    // Start UI update loop
    this._uiLoop();
  }

  pause(): void {
    const state = useDAWStore.getState();
    const currentBeat = this._getCurrentBeat();
    useDAWStore.getState().setPositionBeats(currentBeat);
    useDAWStore.getState().setPlaying(false);
    this._stopAll();
  }

  stop(): void {
    useDAWStore.getState().setPositionBeats(0);
    useDAWStore.getState().setPlaying(false);
    this._stopAll();
  }

  seekTo(beats: number): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this._stopAll(false);
    useDAWStore.getState().setPositionBeats(beats);
    if (wasPlaying) {
      this._playStartContextTime = this.ctx.currentTime + 0.01;
      this._playStartPositionBeats = beats;
      this._scheduledUpTo = this._playStartContextTime;
      this._schedule();
    }
  }

  nudge(beats: number): void {
    const state = useDAWStore.getState();
    this.seekTo(Math.max(0, state.positionBeats + beats));
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  private _getCurrentBeat(): number {
    const elapsed = this.ctx.currentTime - this._playStartContextTime;
    const state = useDAWStore.getState();
    return this._playStartPositionBeats + secondsToBeats(Math.max(0, elapsed), state.project.bpm);
  }

  private _schedule(): void {
    const state = useDAWStore.getState();
    if (!state.isPlaying) return;

    const ctx = this.ctx;
    const lookaheadEnd = ctx.currentTime + SCHEDULE_AHEAD;
    const { bpm, tracks, loopEnabled, loopStart, loopEnd } = state.project;

    // Schedule clips
    for (const track of tracks) {
      if (track.muted) continue;
      const nodes = getOrCreateTrackNodes(track.id);
      nodes.gain.gain.setTargetAtTime(track.volume, ctx.currentTime, 0.01);
      nodes.pan.pan.setTargetAtTime(track.pan, ctx.currentTime, 0.01);

      for (const clip of track.clips) {
        if (clip.type !== 'audio' || !clip.audioFileId) continue;
        const buffer = getAudioBuffer(clip.audioFileId);
        if (!buffer) continue;

        const clipStartTime = this._playStartContextTime +
          beatsToSeconds(clip.startBeat - this._playStartPositionBeats, bpm);
        const clipEndTime = clipStartTime +
          beatsToSeconds(clip.durationBeats * clip.timeStretchRatio, bpm);

        if (clipEndTime < this._scheduledUpTo) continue;
        if (clipStartTime > lookaheadEnd) continue;

        // Check if already scheduled
        const sources = getScheduledSources(clip.id);
        if (sources.some((s) => s.endTime > ctx.currentTime)) continue;

        const startOffset = Math.max(0,
          beatsToSeconds(this._playStartPositionBeats - clip.startBeat, bpm));
        const when = Math.max(ctx.currentTime, clipStartTime);

        this._scheduleClip(clip, track, buffer, when, startOffset);
      }
    }

    // Schedule metronome
    if (state.metronomeEnabled) {
      while (this._nextMetronomeTime < lookaheadEnd) {
        const isDownbeat = this._metronomeBeat % state.project.timeSignatureNum === 0;
        scheduleMetronomeClick(ctx, this._nextMetronomeTime, isDownbeat, state.metronomeVolume);
        this._metronomeBeat++;
        this._nextMetronomeTime += beatsToSeconds(1, bpm);
      }
    }

    // Loop
    if (loopEnabled) {
      const currentBeat = this._getCurrentBeat();
      if (currentBeat >= loopEnd) {
        this.seekTo(loopStart);
        return;
      }
    }

    this._scheduledUpTo = lookaheadEnd;
  }

  private _scheduleClip(
    clip: DAWClip,
    track: DAWTrack,
    buffer: AudioBuffer,
    when: number,
    offset: number,
  ): void {
    const ctx = this.ctx;
    const state = useDAWStore.getState();
    const { bpm } = state.project;
    const nodes = getOrCreateTrackNodes(track.id);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clip.timeStretchRatio;

    if (clip.reversed) {
      // Create a reversed buffer copy
      const rev = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch).slice().reverse();
        rev.copyToChannel(data, ch);
      }
      source.buffer = rev;
    }

    // Gain for clip gain + fades
    const clipGain = ctx.createGain();
    const linearGain = Math.pow(10, clip.gainDb / 20);
    clipGain.gain.value = linearGain;

    // Fade in
    if (clip.fadeInBeats > 0) {
      const fadeInSec = beatsToSeconds(clip.fadeInBeats, bpm);
      clipGain.gain.setValueAtTime(0, when);
      clipGain.gain.linearRampToValueAtTime(linearGain, when + fadeInSec);
    }

    // Fade out
    if (clip.fadeOutBeats > 0) {
      const durationSec = beatsToSeconds(clip.durationBeats, bpm);
      const fadeOutSec = beatsToSeconds(clip.fadeOutBeats, bpm);
      clipGain.gain.setValueAtTime(linearGain, when + durationSec - fadeOutSec);
      clipGain.gain.linearRampToValueAtTime(0, when + durationSec);
    }

    source.connect(clipGain);
    clipGain.connect(nodes.gain);

    const durationSec = beatsToSeconds(clip.durationBeats, bpm);
    source.start(when, offset, durationSec - offset);

    const scheduled = getScheduledSources(clip.id);
    scheduled.push({ source, clipId: clip.id, endTime: when + durationSec - offset });

    source.onended = () => {
      const list = scheduledSources.get(clip.id);
      if (list) {
        const idx = list.findIndex((s) => s.source === source);
        if (idx !== -1) list.splice(idx, 1);
      }
      try { clipGain.disconnect(); } catch { /* ignore */ }
    };
  }

  private _stopAll(resetScheduled = true): void {
    if (this._schedulerTimer !== null) {
      clearInterval(this._schedulerTimer);
      this._schedulerTimer = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (resetScheduled) {
      scheduledSources.forEach((sources) => {
        sources.forEach((s) => {
          try { s.source.stop(); } catch { /* ignore */ }
        });
        sources.length = 0;
      });
    }
  }

  // ── UI Loop ───────────────────────────────────────────────────────────────

  private _uiLoop(): void {
    const tick = () => {
      if (!this.isPlaying) return;
      const beat = this._getCurrentBeat();
      useDAWStore.getState().setPositionBeats(beat);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  // ── VU Metering ───────────────────────────────────────────────────────────

  updateVUMeters(): void {
    const state = useDAWStore.getState();
    for (const track of state.project.tracks) {
      const nodes = trackNodes.get(track.id);
      if (!nodes) continue;
      const buf = new Uint8Array(nodes.analyser.frequencyBinCount);
      nodes.analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] / 128 - 1);
        if (v > peak) peak = v;
      }
      useDAWStore.getState().setTrackVU(track.id, peak, peak);
    }
  }

  // ── Audio File Loading ────────────────────────────────────────────────────

  async loadAudioFile(file: File): Promise<{ id: string; buffer: AudioBuffer; waveformData: number[] }> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));

    // Generate SHA-like ID from content (simplified)
    const id = await this._hashBuffer(arrayBuffer);
    storeAudioBuffer(id, buffer);

    // Generate waveform data (downsampled to ~1000 points)
    const waveformData = this._generateWaveform(buffer, 1000);

    return { id, buffer, waveformData };
  }

  private async _hashBuffer(buf: ArrayBuffer): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const arr = new Uint8Array(hashBuf);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  private _generateWaveform(buffer: AudioBuffer, points: number): number[] {
    const data = buffer.getChannelData(0);
    const blockSize = Math.floor(data.length / points);
    const waveform: number[] = [];
    for (let i = 0; i < points; i++) {
      let peak = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, data.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > peak) peak = v;
      }
      waveform.push(peak);
    }
    return waveform;
  }
}

export const dawEngine = new DAWEngineClass();
