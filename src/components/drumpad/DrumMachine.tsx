'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Play, Square, Shuffle, Trash2, Plus } from 'lucide-react';
import { StepSequencer } from './StepSequencer';
import { PatternManager } from './PatternManager';
import { BounceModal } from './BounceModal';
import { useSampleStore } from '@/src/store/useSampleStore';
import { drumEngine } from '@/src/lib/samples/DrumEngine';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { useDAWStore } from '@/src/store/useDAWStore';

interface DrumMachineProps {
  dawMode?: boolean;
}

export function DrumMachine({ dawMode = false }: DrumMachineProps) {
  const store = useSampleStore();
  const { dm } = store;
  const [showBounce, setShowBounce] = useState(false);
  const dawPlaying = useDAWStore((s) => s.isPlaying);

  const pattern = dm.patterns.find((p) => p.id === dm.currentPatternId);

  const togglePlay = useCallback(async () => {
    if (!audioEngine.isInitialized()) await audioEngine.initialize();
    if (dawMode) {
      const { dawEngine } = await import('@/src/lib/daw/DAWEngine');
      const dawState = useDAWStore.getState();
      if (dawState.isPlaying) {
        dawEngine.stop();
        drumEngine.stop();
      } else {
        drumEngine.play();
        dawEngine.play();
      }
    } else {
      drumEngine.toggle();
    }
  }, [dawMode]);

  // In DAW mode, sync stop when DAW stops externally
  useEffect(() => {
    if (dawMode && !dawPlaying && dm.playing) {
      drumEngine.stop();
    }
  }, [dawMode, dawPlaying, dm.playing]);

  const clear = () => { if (pattern) store.clearPattern(pattern.id); };
  const randomize = () => { if (pattern) store.randomizePattern(pattern.id, 30); };
  const addRow = () => { if (pattern && pattern.rows.length < 16) store.addRow(pattern.id); };

  useEffect(() => {
    return () => { if (dm.playing) drumEngine.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pattern) return null;

  return (
    <div
      className="flex flex-col border-t"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        fontFamily: 'var(--font-rajdhani)',
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--border)', minHeight: 36 }}>
        {/* Play/Stop */}
        <button
          className="flex items-center gap-1 px-3 h-6 rounded font-bold text-[11px] uppercase tracking-wider"
          style={{
            background: dm.playing ? 'rgba(255,0,110,0.15)' : 'rgba(0,245,255,0.1)',
            color: dm.playing ? '#ff006e' : 'var(--accent-cyan)',
            border: `1px solid ${dm.playing ? '#ff006e44' : 'rgba(0,245,255,0.3)'}`,
          }}
          onClick={togglePlay}
        >
          {dm.playing ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
          {dm.playing ? 'Stop' : 'Play'}
        </button>

        {/* Pattern manager */}
        <PatternManager />

        <div className="flex-1" />

        {/* Global swing */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Swing</span>
          <input
            type="range" min={0} max={80} step={1}
            value={dm.globalSwing}
            onChange={(e) => store.setGlobalSwing(parseInt(e.target.value))}
            className="w-16 h-1 accent-cyan-400 cursor-pointer"
          />
          <span className="text-[9px] w-5 text-right" style={{ color: 'var(--text-primary)' }}>
            {dm.globalSwing}%
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={randomize}
            title="Randomize pattern"
          >
            <Shuffle size={10} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={clear}
            title="Clear pattern"
          >
            <Trash2 size={10} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={addRow}
            title="Add instrument row"
          >
            <Plus size={10} />
          </button>
        </div>

        {/* Bounce to DAW (dawMode only) */}
        {dawMode && (
          <button
            className="flex items-center gap-1 px-2 h-6 rounded font-bold text-[10px] uppercase tracking-wider ml-1"
            style={{ background: 'rgba(255,0,110,0.1)', color: 'var(--accent-magenta)', border: '1px solid rgba(255,0,110,0.3)' }}
            onClick={() => setShowBounce(true)}
            title="Bounce drum pattern to DAW"
          >
            ↓ BOUNCE
          </button>
        )}
      </div>

      {showBounce && <BounceModal onClose={() => setShowBounce(false)} />}

      {/* Step beat indicator */}
      <div className="flex items-center px-2 h-5 shrink-0 border-b" style={{ borderColor: 'var(--border)', paddingLeft: 134 }}>
        {Array.from({ length: Math.max(...pattern.rows.map((r) => r.stepCount), 16) }).map((_, i) => {
          const isBeat = i % 4 === 0;
          const isCurrentGroup = Math.floor(dm.currentStep / 4) === Math.floor(i / 4) && dm.playing;
          return (
            <div
              key={i}
              className="text-[7px] text-center"
              style={{
                width: Math.max(...pattern.rows.map((r) => r.stepCount), 16) > 16 ? 12 : 20,
                color: isBeat ? 'var(--accent-cyan)' : 'var(--text-muted)',
                opacity: isCurrentGroup ? 1 : 0.3,
                fontFamily: 'var(--font-orbitron)',
              }}
            >
              {isBeat ? Math.floor(i / 4) + 1 : '·'}
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 240 }}>
        {pattern.rows.map((row) => (
          <StepSequencer
            key={row.id}
            row={row}
            patternId={pattern.id}
            currentStep={dm.currentStep}
            dawMode={dawMode}
          />
        ))}
      </div>
    </div>
  );
}
