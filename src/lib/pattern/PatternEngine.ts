// ─── PatternEngine — Plays channel rack patterns via Web Audio scheduling ────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import type { SynthEngine } from '@/src/lib/synths/SynthInterface';
import type { Pattern, Channel, StepData } from '@/src/store/useChannelRackStore';

const SCHEDULE_AHEAD = 0.12; // seconds lookahead
const SCHEDULER_INTERVAL = 25; // ms

// ─── Synth Instance Registry ─────────────────────────────────────────────────
// Synth engines are created lazily and cached per channel ID.

const synthInstances = new Map<string, SynthEngine>();

export function registerSynth(channelId: string, synth: SynthEngine): void {
  const existing = synthInstances.get(channelId);
  if (existing) existing.dispose();
  synthInstances.set(channelId, synth);
}

export function unregisterSynth(channelId: string): void {
  const existing = synthInstances.get(channelId);
  if (existing) {
    existing.dispose();
    synthInstances.delete(channelId);
  }
}

export function getSynth(channelId: string): SynthEngine | undefined {
  return synthInstances.get(channelId);
}

export function cleanupSynths(activeIds: Set<string>): void {
  for (const [id, synth] of synthInstances.entries()) {
    if (!activeIds.has(id)) {
      synth.dispose();
      synthInstances.delete(id);
    }
  }
}

// ─── Pattern Engine ──────────────────────────────────────────────────────────

class PatternEngineClass {
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _rafId: number | null = null;
  private _playStartTime = 0;
  private _scheduledUpTo = 0;
  private _stepDuration = 0; // seconds per step

  get isPlaying(): boolean {
    return useChannelRackStore.getState().playing;
  }

  play(): void {
    if (!audioEngine.isInitialized()) return;
    const state = useChannelRackStore.getState();
    const bpm = 120; // TODO: link to DAW BPM
    // stepDuration = seconds per 1/16th note at the given BPM
    this._stepDuration = 60 / bpm / 4;

    const ctx = audioEngine.ctx;
    this._playStartTime = ctx.currentTime + 0.01;
    this._scheduledUpTo = this._playStartTime;

    useChannelRackStore.getState().setPlaying(true);
    useChannelRackStore.getState().setCurrentStep(0);

    this._timer = setInterval(() => this._schedule(), SCHEDULER_INTERVAL);
    this._schedule();
    this._uiLoop();
  }

  stop(): void {
    useChannelRackStore.getState().setPlaying(false);
    useChannelRackStore.getState().setCurrentStep(0);
    this._cleanup();
  }

  toggle(): void {
    if (this.isPlaying) this.stop();
    else this.play();
  }

  private _cleanup(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _schedule(): void {
    if (!this.isPlaying) return;
    const state = useChannelRackStore.getState();
    const ctx = audioEngine.ctx;
    const lookaheadEnd = ctx.currentTime + SCHEDULE_AHEAD;
    const pattern = state.patterns.find((p) => p.id === state.activePatternId);
    if (!pattern) return;

    const anySoloed = state.channels.some((c) => c.soloed);

    for (const channel of state.channels) {
      if (channel.muted) continue;
      if (anySoloed && !channel.soloed) continue;

      const data = pattern.channelData[channel.id];
      if (!data) continue;

      if (channel.type === 'sample') {
        this._scheduleSampleSteps(channel, data, lookaheadEnd);
      } else {
        this._scheduleInstrumentNotes(channel, data, lookaheadEnd);
      }
    }

    this._scheduledUpTo = lookaheadEnd;
  }

  private _scheduleSampleSteps(
    channel: Channel,
    data: { steps: StepData[]; stepCount: number },
    lookaheadEnd: number,
  ): void {
    const ctx = audioEngine.ctx;

    for (let i = 0; i < data.stepCount; i++) {
      const step = data.steps[i];
      if (!step || !step.on) continue;

      // Check probability
      if (step.probability < 100 && Math.random() * 100 > step.probability) continue;

      const stepTime = this._playStartTime + i * this._stepDuration + step.offset * this._stepDuration;
      if (stepTime < this._scheduledUpTo) continue;
      if (stepTime > lookaheadEnd) continue;

      // Get sample buffer
      if (!channel.sampleId) continue;
      const buffer = sampleManager.getBuffer(channel.sampleId);
      if (!buffer) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Apply pitch
      if (step.pitch !== 0) {
        source.playbackRate.value = Math.pow(2, step.pitch / 12);
      }

      // Apply volume + velocity
      const gain = ctx.createGain();
      gain.gain.value = channel.volume * (step.velocity / 127);

      // Apply pan
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (channel.pan + step.pan / 100)));

      source.connect(gain);
      gain.connect(panner);
      panner.connect(audioEngine.masterGain);

      source.start(Math.max(ctx.currentTime, stepTime));
    }

    // Handle looping: when we've scheduled all steps, reset
    const patternDuration = data.stepCount * this._stepDuration;
    if (lookaheadEnd > this._playStartTime + patternDuration) {
      this._playStartTime += patternDuration;
      this._scheduledUpTo = this._playStartTime;
    }
  }

  private _scheduleInstrumentNotes(
    channel: Channel,
    data: { notes: Array<{ pitch: number; startBeat: number; durationBeats: number; velocity: number; probability: number }> },
    lookaheadEnd: number,
  ): void {
    const synth = synthInstances.get(channel.id);
    if (!synth) return;

    const bpm = 120;
    const secPerBeat = 60 / bpm;

    for (const note of data.notes) {
      if (note.probability < 100 && Math.random() * 100 > note.probability) continue;

      const noteStart = this._playStartTime + note.startBeat * secPerBeat;
      const noteEnd = noteStart + note.durationBeats * secPerBeat;

      if (noteStart < this._scheduledUpTo) continue;
      if (noteStart > lookaheadEnd) continue;

      synth.noteOn(note.pitch, note.velocity, noteStart);
      synth.noteOff(note.pitch, noteEnd);
    }
  }

  private _uiLoop(): void {
    const tick = () => {
      if (!this.isPlaying) return;
      const ctx = audioEngine.ctx;
      const elapsed = ctx.currentTime - this._playStartTime;
      const state = useChannelRackStore.getState();
      const pat = state.patterns.find((p) => p.id === state.activePatternId);
      const stepCount = pat?.channelData[state.channels[0]?.id]?.stepCount ?? 16;
      const currentStep = Math.floor(elapsed / this._stepDuration) % stepCount;
      useChannelRackStore.getState().setCurrentStep(currentStep);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}

export const patternEngine = new PatternEngineClass();
