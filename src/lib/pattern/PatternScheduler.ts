// ─── PatternScheduler — Integrates patterns into the DAW Arrangement ─────────
// When the DAW plays a PatternClip, this scheduler reads the referenced pattern
// from useChannelRackStore and schedules its steps/notes at the correct timeline position.

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { useDAWStore } from '@/src/store/useDAWStore';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import { getSynth } from './PatternEngine';
import { beatsToSeconds } from '@/src/lib/daw/TimeSignature';
import type { DAWClip } from '@/src/store/dawTypes';

// ─── Schedule a pattern clip within the arrangement timeline ──────────────────

export function schedulePatternClip(
  clip: DAWClip,
  playStartContextTime: number,
  playStartPositionBeats: number,
  bpm: number,
  scheduledUpTo: number,
  lookaheadEnd: number,
): void {
  if (clip.type !== 'pattern' || !clip.patternId) return;

  const crState = useChannelRackStore.getState();
  const pattern = crState.patterns.find((p) => p.id === clip.patternId);
  if (!pattern) return;

  const ctx = audioEngine.ctx;
  const anySoloed = crState.channels.some((c) => c.soloed);

  // The clip starts at clip.startBeat in the arrangement timeline
  const clipStartCtxTime = playStartContextTime +
    beatsToSeconds(clip.startBeat - playStartPositionBeats, bpm);

  for (const channel of crState.channels) {
    if (channel.muted) continue;
    if (anySoloed && !channel.soloed) continue;

    const data = pattern.channelData[channel.id];
    if (!data) continue;

    if (channel.type === 'sample') {
      // Schedule sample steps
      const stepDuration = 60 / bpm / 4; // 1/16th note

      for (let i = 0; i < data.stepCount; i++) {
        const step = data.steps[i];
        if (!step || !step.on) continue;
        if (step.probability < 100 && Math.random() * 100 > step.probability) continue;

        const stepCtxTime = clipStartCtxTime + i * stepDuration + step.offset * stepDuration;
        if (stepCtxTime < scheduledUpTo || stepCtxTime > lookaheadEnd) continue;

        if (!channel.sampleId) continue;
        const buffer = sampleManager.getBuffer(channel.sampleId);
        if (!buffer) continue;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        if (step.pitch !== 0) {
          source.playbackRate.value = Math.pow(2, step.pitch / 12);
        }

        const gain = ctx.createGain();
        gain.gain.value = channel.volume * (step.velocity / 127);

        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, channel.pan + step.pan / 100));

        source.connect(gain);
        gain.connect(panner);
        panner.connect(audioEngine.masterGain);

        source.start(Math.max(ctx.currentTime, stepCtxTime));
      }
    } else {
      // Schedule instrument notes
      const synth = getSynth(channel.id);
      if (!synth) continue;

      const secPerBeat = 60 / bpm;

      for (const note of data.notes) {
        if (note.probability < 100 && Math.random() * 100 > note.probability) continue;

        const noteCtxTime = clipStartCtxTime + note.startBeat * secPerBeat;
        const noteEnd = noteCtxTime + note.durationBeats * secPerBeat;

        if (noteCtxTime < scheduledUpTo || noteCtxTime > lookaheadEnd) continue;

        synth.noteOn(note.pitch, note.velocity, noteCtxTime);
        synth.noteOff(note.pitch, noteEnd);
      }
    }
  }
}
