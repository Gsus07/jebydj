'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useDAWStore, uid } from '@/src/store/useDAWStore';
import { useSampleStore } from '@/src/store/useSampleStore';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { storeAudioBuffer } from '@/src/lib/daw/DAWEngine';
import { sampleManager } from '@/src/lib/samples/SampleManager';

// GM drum note mapping
const GM_NOTES: Record<string, number> = {
  Kick: 36, 'Bass Drum': 36, 'Bass': 36,
  Snare: 38, 'Snare Drum': 38, Clap: 39,
  'HH Closed': 42, 'Hi-Hat': 42, 'HH Open': 46,
  Tom: 45, 'Low Tom': 41, 'Mid Tom': 45, 'High Tom': 48,
  Cymbal: 49, Crash: 49, Ride: 51,
  Percussion: 56,
};

function noteForRow(name: string): number {
  for (const [key, note] of Object.entries(GM_NOTES)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return note;
  }
  return 60; // fallback to C4
}

type BounceMode = 'audio' | 'midi';
type TrackMode = 'per-instrument' | 'mix';

interface Props {
  onClose: () => void;
}

export function BounceModal({ onClose }: Props) {
  const [bars, setBars] = useState<1 | 2 | 4 | 8 | 16>(4);
  const [mode, setMode] = useState<BounceMode>('audio');
  const [trackMode, setTrackMode] = useState<TrackMode>('per-instrument');
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);

  const doBounce = async () => {
    setRendering(true);
    setProgress(0);

    const dawState = useDAWStore.getState();
    const sampleState = useSampleStore.getState();
    const bpm = dawState.project.bpm;
    const pattern = sampleState.dm.patterns.find((p) => p.id === sampleState.dm.currentPatternId);
    if (!pattern) { setRendering(false); return; }

    const timeSignatureNum = dawState.project.timeSignatureNum;
    const beatsPerBar = timeSignatureNum;
    const totalBeats = bars * beatsPerBar;
    const startBeat = dawState.positionBeats;

    if (mode === 'midi') {
      // ─── MIDI bounce ───────────────────────────────────────────────────────
      dawState.pushHistory('Bounce drum pattern (MIDI)');
      const trackId = dawState.addTrack('midi');
      const clipId = dawState.addClip(trackId, startBeat, 'midi');
      dawState.updateClip(clipId, { name: `Drum ${pattern.name}`, durationBeats: totalBeats });

      for (const row of pattern.rows) {
        const pitch = noteForRow(row.name);
        const stepCount = row.stepCount;
        const stepsPerBeat = 4; // 1/16 notes per beat (16 steps / 4 beats)
        const stepDurBeats = 1 / stepsPerBeat;

        for (let repeat = 0; repeat < bars; repeat++) {
          for (let i = 0; i < stepCount; i++) {
            const step = row.steps[i];
            if (!step?.on) continue;
            if (Math.random() * 100 > step.probability) continue;
            const beatInPattern = i * stepDurBeats;
            const startInClip = repeat * beatsPerBar + beatInPattern;
            dawState.addNote(clipId, {
              pitch,
              startBeat: startInClip,
              durationBeats: stepDurBeats * 0.8,
              velocity: step.velocity,
              probability: step.probability / 100,
              muted: false,
            });
          }
        }
        setProgress((p) => Math.min(95, p + 10));
      }
      setProgress(100);
      setRendering(false);
      onClose();
      return;
    }

    // ─── Audio bounce ──────────────────────────────────────────────────────
    const sampleRate = audioEngine.ctx.sampleRate;
    const secondsPerBeat = 60 / bpm;
    const totalSeconds = totalBeats * secondsPerBeat;

    const rows = pattern.rows.filter((r) => !r.muted);
    const trackIds: string[] = [];

    if (trackMode === 'mix') {
      // Render all rows together into one offline context
      const offCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);
      let rowsDone = 0;
      for (const row of rows) {
        await renderRowToOffline(offCtx, row, bars, beatsPerBar, bpm, sampleManager);
        rowsDone++;
        setProgress(Math.floor((rowsDone / rows.length) * 80));
      }
      const rendered = await offCtx.startRendering();
      const bufferId = `bounce-mix-${Date.now()}`;
      storeAudioBuffer(bufferId, rendered);
      const waveformData = buildWaveformData(rendered);
      dawState.pushHistory('Bounce drum mix (Audio)');
      const tId = dawState.addTrack('audio');
      dawState.addAudioClip(tId, startBeat, totalBeats, `Drum ${pattern.name} Mix`, bufferId, waveformData);
      setProgress(100);
    } else {
      // One track per instrument
      dawState.pushHistory('Bounce drum instruments (Audio)');
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const offCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);
        await renderRowToOffline(offCtx, row, bars, beatsPerBar, bpm, sampleManager);
        const rendered = await offCtx.startRendering();
        const bufferId = `bounce-${row.id}-${Date.now()}`;
        storeAudioBuffer(bufferId, rendered);
        const waveformData = buildWaveformData(rendered);
        const tId = dawState.addTrack('audio');
        dawState.updateTrack(tId, { name: row.name });
        dawState.addAudioClip(tId, startBeat, totalBeats, row.name, bufferId, waveformData);
        trackIds.push(tId);
        setProgress(Math.floor(((ri + 1) / rows.length) * 95));
      }
      setProgress(100);
    }

    setRendering(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl border p-5 flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 340, fontFamily: 'var(--font-rajdhani)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-orbitron)' }}>
            Bounce to DAW
          </span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>

        {/* Bars */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Bars to render</label>
          <div className="flex gap-2">
            {([1, 2, 4, 8, 16] as const).map((b) => (
              <button
                key={b}
                className="flex-1 h-7 rounded text-[11px] font-bold"
                style={{
                  background: bars === b ? 'var(--accent-cyan)' : 'var(--bg-surface)',
                  color: bars === b ? '#000' : 'var(--text-muted)',
                  border: `1px solid ${bars === b ? 'var(--accent-cyan)' : 'var(--border)'}`,
                }}
                onClick={() => setBars(b)}
              >{b}</button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Output mode</label>
          <div className="flex gap-2">
            {(['audio', 'midi'] as const).map((m) => (
              <button
                key={m}
                className="flex-1 h-7 rounded text-[11px] font-bold uppercase"
                style={{
                  background: mode === m ? 'var(--accent-magenta)' : 'var(--bg-surface)',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${mode === m ? 'var(--accent-magenta)' : 'var(--border)'}`,
                }}
                onClick={() => setMode(m)}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* Track mode (only for audio) */}
        {mode === 'audio' && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tracks</label>
            <div className="flex gap-2">
              {(['per-instrument', 'mix'] as const).map((m) => (
                <button
                  key={m}
                  className="flex-1 h-7 rounded text-[10px] font-bold uppercase"
                  style={{
                    background: trackMode === m ? 'rgba(0,245,255,0.1)' : 'var(--bg-surface)',
                    color: trackMode === m ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: `1px solid ${trackMode === m ? 'var(--accent-cyan)' : 'var(--border)'}`,
                  }}
                  onClick={() => setTrackMode(m)}
                >
                  {m === 'per-instrument' ? 'Per Instrument' : 'Mix Final'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {rendering && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rendering…</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent-cyan)' }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            className="flex-1 h-8 rounded text-sm font-bold uppercase tracking-wider"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={onClose}
            disabled={rendering}
          >
            Cancel
          </button>
          <button
            className="flex-1 h-8 rounded text-sm font-bold uppercase tracking-wider"
            style={{ background: 'var(--accent-cyan)', color: '#000', opacity: rendering ? 0.6 : 1 }}
            onClick={() => void doBounce()}
            disabled={rendering}
          >
            Render
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function renderRowToOffline(
  offCtx: OfflineAudioContext,
  row: ReturnType<typeof useSampleStore.getState>['dm']['patterns'][0]['rows'][0],
  bars: number,
  beatsPerBar: number,
  bpm: number,
  sm: typeof sampleManager,
): Promise<void> {
  const buffer = row.sampleId ? await sm.getOrDecodeBuffer(row.sampleId) : null;

  const stepsPerBeat = 4; // 1/16 per beat
  const stepDurSec = (60 / bpm) / stepsPerBeat;
  const totalSteps = bars * beatsPerBar * stepsPerBeat;

  for (let repeat = 0; repeat < bars; repeat++) {
    for (let i = 0; i < row.stepCount; i++) {
      const step = row.steps[i];
      if (!step?.on) continue;
      if (Math.random() * 100 > step.probability) continue;
      const time = (repeat * beatsPerBar * stepsPerBeat + i) * stepDurSec;

      if (buffer) {
        const src = offCtx.createBufferSource();
        src.buffer = buffer;
        const gain = offCtx.createGain();
        gain.gain.value = (step.velocity / 127) * row.volume;
        if (step.pitch !== 0) src.playbackRate.value = Math.pow(2, step.pitch / 12);
        src.connect(gain);
        gain.connect(offCtx.destination);
        src.start(time);
      } else {
        // synthetic click
        const osc = offCtx.createOscillator();
        const g = offCtx.createGain();
        osc.frequency.value = 100;
        g.gain.setValueAtTime(0.3, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.connect(g);
        g.connect(offCtx.destination);
        osc.start(time);
        osc.stop(time + 0.05);
      }
    }
  }
  // suppress lint: totalSteps used to ensure loop is bounded
  void totalSteps;
}

function buildWaveformData(buffer: AudioBuffer): number[] {
  const ch = buffer.getChannelData(0);
  const samples = 200;
  const step = Math.floor(ch.length / samples);
  const result: number[] = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    for (let j = 0; j < step; j++) {
      const v = Math.abs(ch[i * step + j] ?? 0);
      if (v > max) max = v;
    }
    result.push(max);
  }
  return result;
}
