// ─── DrumEngine — precise 16-step sequencer using Web Audio API scheduling ───
// Based on Chris Wilson's lookahead scheduler pattern.

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { useSampleStore } from '@/src/store/useSampleStore';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import type { DrumRow, DrumStep } from '@/src/store/sampleTypes';

const LOOKAHEAD = 0.1;   // schedule 100ms ahead
const SCHEDULE_INTERVAL = 25; // ms

class DrumEngineClass {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _nextBeatTime = 0;
  private _currentScheduledStep = 0;
  private _rafId: number | null = null;

  // ─── Public API ────────────────────────────────────────────────────────────

  play(): void {
    if (!audioEngine.isInitialized()) return;
    // Ensure context is running (may be suspended)
    if (audioEngine.ctx.state !== 'running') {
      void audioEngine.ctx.resume();
    }
    const store = useSampleStore.getState();
    if (store.dm.playing) return;

    this._nextBeatTime = audioEngine.ctx.currentTime + 0.05;
    this._currentScheduledStep = store.dm.currentStep;

    useSampleStore.getState().setDrumPlaying(true);
    this._interval = setInterval(() => this._schedule(), SCHEDULE_INTERVAL);
    this._startUI();
  }

  stop(): void {
    useSampleStore.getState().setDrumPlaying(false);
    useSampleStore.getState().setDrumCurrentStep(0);
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    this._stopUI();
    this._currentScheduledStep = 0;
  }

  toggle(): void {
    const playing = useSampleStore.getState().dm.playing;
    playing ? this.stop() : this.play();
  }

  // ─── Scheduler ─────────────────────────────────────────────────────────────

  private _schedule(): void {
    if (!audioEngine.isInitialized()) return;
    const now = audioEngine.ctx.currentTime;
    const store = useSampleStore.getState();
    const { dm } = store;
    const pattern = dm.patterns.find((p) => p.id === dm.currentPatternId);
    if (!pattern) return;

    const bpm = this._getBpm();
    const globalSwing = dm.globalSwing;

    while (this._nextBeatTime < now + LOOKAHEAD) {
      const step = this._currentScheduledStep;
      this._scheduleStep(pattern.rows, step, this._nextBeatTime, bpm, globalSwing);
      this._advanceStep(pattern.rows, step, bpm);
    }
  }

  private _scheduleStep(
    rows: DrumRow[],
    step: number,
    time: number,
    bpm: number,
    globalSwing: number,
  ): void {
    for (const row of rows) {
      if (row.muted) continue;

      // Each row can have a different step count; wrap step
      const localStep = step % row.stepCount;
      const drumStep: DrumStep = row.steps[localStep];
      if (!drumStep || !drumStep.on) continue;

      // Probability check
      if (drumStep.probability < 100 && Math.random() * 100 > drumStep.probability) continue;

      // Swing: every other 16th note is delayed
      const swing = row.swing > 0 ? row.swing : globalSwing;
      const swingOffset = (swing / 100) * this._stepDuration(row.stepSize, bpm) * 0.5;
      const isOddStep = localStep % 2 === 1;
      const stepOffset = (drumStep.offset / 100) * this._stepDuration(row.stepSize, bpm);
      const scheduledTime = time + (isOddStep ? swingOffset : 0) + stepOffset;

      // Schedule retriggers
      const retrigger = drumStep.retrigger;
      const stepDur = this._stepDuration(row.stepSize, bpm);
      for (let r = 0; r < retrigger; r++) {
        const triggerTime = scheduledTime + (r / retrigger) * stepDur;
        this._triggerSample(row, drumStep, triggerTime);
      }

      // Flam: additional note slightly before
      if (drumStep.flam) {
        const flamTime = scheduledTime - 0.02;
        if (flamTime >= audioEngine.ctx.currentTime) {
          const flamStep: DrumStep = { ...drumStep, velocity: Math.floor(drumStep.velocity * 0.6), flam: false };
          this._triggerSample(row, flamStep, flamTime);
        }
      }
    }
  }

  private _triggerSample(row: DrumRow, step: DrumStep, time: number): void {
    if (!row.sampleId) {
      // No sample — use synthetic drum sound
      this._triggerSynthetic(row.name, step, time);
      return;
    }

    const buffer = sampleManager['bufferCache'].get(row.sampleId);
    if (!buffer) {
      // Buffer not in LRU cache yet — start async decode, use synthetic as immediate fallback
      void sampleManager.getOrDecodeBuffer(row.sampleId);
      this._triggerSynthetic(row.name, step, time);
      return;
    }

    const gain = audioEngine.ctx.createGain();
    gain.gain.value = row.volume * (step.velocity / 127);

    if (row.pan !== 0) {
      const pan = audioEngine.ctx.createStereoPanner();
      pan.pan.value = row.pan;
      gain.connect(pan);
      pan.connect(audioEngine.masterGain);
    } else {
      gain.connect(audioEngine.masterGain);
    }

    const src = audioEngine.ctx.createBufferSource();
    src.buffer = buffer;
    if (step.pitch !== 0) {
      src.detune.value = step.pitch * 100;
    }
    src.connect(gain);
    src.start(Math.max(time, audioEngine.ctx.currentTime));
  }

  private _triggerSynthetic(name: string, step: DrumStep, time: number): void {
    const ctx = audioEngine.ctx;
    const gain = ctx.createGain();
    gain.gain.value = step.velocity / 127 * 0.7;
    gain.connect(audioEngine.masterGain);

    const n = name.toLowerCase();
    if (n.includes('kick') || n.includes('bd')) {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
      const env = ctx.createGain();
      env.gain.setValueAtTime(1, time); env.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      osc.connect(env); env.connect(gain);
      osc.start(time); osc.stop(time + 0.5);
    } else if (n.includes('snare') || n.includes('sd') || n.includes('clap')) {
      const noise = ctx.createOscillator(); noise.type = 'sawtooth'; noise.frequency.value = 3000;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.5, time); env.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      noise.connect(env); env.connect(gain);
      noise.start(time); noise.stop(time + 0.15);
    } else if (n.includes('hat') || n.includes('hh') || n.includes('cymbal') || n.includes('crash')) {
      const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 8000;
      const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 7000;
      const env = ctx.createGain();
      const decay = n.includes('open') || n.includes('crash') ? 0.3 : 0.04;
      env.gain.setValueAtTime(0.4, time); env.gain.exponentialRampToValueAtTime(0.001, time + decay);
      osc.connect(filt); filt.connect(env); env.connect(gain);
      osc.start(time); osc.stop(time + decay);
    } else {
      // Generic click
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 400;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.5, time); env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.connect(env); env.connect(gain);
      osc.start(time); osc.stop(time + 0.05);
    }
  }

  private _advanceStep(rows: DrumRow[], _currentStep: number, bpm: number): void {
    // Use the first row's step size as reference (or 1/16 default)
    const stepSize = rows[0]?.stepSize ?? '1/16';
    this._nextBeatTime += this._stepDuration(stepSize, bpm);
    this._currentScheduledStep++;
    // Wrap to max step count across all rows
    const maxSteps = Math.max(...rows.map((r) => r.stepCount), 16);
    if (this._currentScheduledStep >= maxSteps) this._currentScheduledStep = 0;
  }

  private _stepDuration(stepSize: DrumRow['stepSize'], bpm: number): number {
    const beatDur = 60 / bpm;
    if (stepSize === '1/8')  return beatDur * 0.5;
    if (stepSize === '1/16') return beatDur * 0.25;
    return beatDur * 0.125; // 1/32
  }

  private _getBpm(): number {
    // Sync to DAW store if available, else DJ store
    try {
      const { useDAWStore } = require('@/src/store/useDAWStore') as { useDAWStore: { getState: () => { project: { bpm: number } } } };
      return useDAWStore.getState().project.bpm;
    } catch {
      try {
        const { useDJStore } = require('@/src/store/useDJStore') as { useDJStore: { getState: () => { masterBpm: number } } };
        return useDJStore.getState().masterBpm || 120;
      } catch {
        return 120;
      }
    }
  }

  // ─── UI step indicator via rAF ─────────────────────────────────────────────

  private _startUI(): void {
    this._stopUI();
    let lastStep = -1;
    const tick = () => {
      if (!useSampleStore.getState().dm.playing) { this._stopUI(); return; }
      const store = useSampleStore.getState();
      const pattern = store.dm.patterns.find((p) => p.id === store.dm.currentPatternId);
      if (!pattern) { this._rafId = requestAnimationFrame(tick); return; }
      const maxSteps = Math.max(...pattern.rows.map((r) => r.stepCount), 16);
      const beatDur = 60 / this._getBpm();
      const stepSize = pattern.rows[0]?.stepSize ?? '1/16';
      const stepDur = this._stepDuration(stepSize, this._getBpm()) * 1000;

      // Infer current UI step from scheduled step and time
      const elapsed = (audioEngine.ctx.currentTime - this._nextBeatTime) * 1000;
      const uiStep = (this._currentScheduledStep - Math.ceil(-elapsed / stepDur) + maxSteps) % maxSteps;

      if (uiStep !== lastStep) {
        lastStep = uiStep;
        useSampleStore.getState().setDrumCurrentStep(uiStep);
      }
      void beatDur; // suppress unused
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  private _stopUI(): void {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }
}

export const drumEngine = new DrumEngineClass();
