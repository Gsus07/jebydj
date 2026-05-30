'use client';

import React from 'react';
import { Volume2, VolumeX, Mic, ChevronDown } from 'lucide-react';
import { DrumPad } from './DrumPad';
import type { DrumRow, StepCount, StepSize } from '@/src/store/sampleTypes';
import { useSampleStore } from '@/src/store/useSampleStore';
import { WaveformThumb } from '@/src/components/library/WaveformThumb';
import { useDAWStore } from '@/src/store/useDAWStore';

interface Props {
  row: DrumRow;
  patternId: string;
  currentStep: number;
  dawMode?: boolean;
}

export function StepSequencer({ row, patternId, currentStep, dawMode = false }: Props) {
  const store = useSampleStore();
  const samples = store.samples;
  const sample = row.sampleId ? samples.find((s) => s.id === row.sampleId) : null;

  const updateRow = (patch: Partial<DrumRow>) => store.updateRow(patternId, row.id, patch);

  // Visible steps: show stepCount buttons
  const stepsToRender = row.steps.slice(0, row.stepCount);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sampleId = e.dataTransfer.getData('application/x-sample-id');
    if (sampleId) store.setRowSample(patternId, row.id, sampleId);
  };

  return (
    <div
      className="flex items-center gap-1 px-2 h-9 shrink-0"
      style={{
        background: row.muted ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        opacity: row.muted ? 0.5 : 1,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Row label + sample */}
      <div className="flex items-center gap-1 shrink-0" style={{ width: 130 }}>
        {/* Waveform / name */}
        <div className="flex-1 min-w-0">
          {sample ? (
            <div className="flex items-center gap-1">
              <WaveformThumb waveformData={sample.waveformData} width={44} height={18} color="#00f5ff" />
              <span className="text-[9px] truncate" style={{ color: 'var(--text-primary)' }}>{sample.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Mic size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{row.name}</span>
            </div>
          )}
        </div>

        {/* M/S buttons */}
        <div className="flex gap-0.5 shrink-0">
          <button
            className="w-4 h-4 rounded text-[8px] font-bold"
            style={{
              background: row.muted ? '#ff006e22' : 'var(--bg-surface)',
              color: row.muted ? '#ff006e' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            onClick={() => updateRow({ muted: !row.muted })}
            title="Mute"
          >M</button>
          <button
            className="w-4 h-4 rounded text-[8px] font-bold"
            style={{
              background: row.soloed ? '#ffbe0b22' : 'var(--bg-surface)',
              color: row.soloed ? '#ffbe0b' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            onClick={() => updateRow({ soloed: !row.soloed })}
            title="Solo"
          >S</button>
          {dawMode && (
            <button
              className="w-5 h-4 rounded text-[7px] font-bold ml-0.5"
              style={{ background: 'var(--bg-surface)', color: 'var(--accent-cyan)', border: '1px solid rgba(0,245,255,0.3)' }}
              title="Route to new DAW track"
              onClick={() => {
                const daw = useDAWStore.getState();
                daw.pushHistory('Route drum row to track');
                const tId = daw.addTrack('audio');
                daw.updateTrack(tId, { name: row.name });
              }}
            >→T</button>
          )}
        </div>

        {/* Volume */}
        <input
          type="range" min={0} max={1} step={0.01}
          value={row.volume}
          onChange={(e) => updateRow({ volume: parseFloat(e.target.value) })}
          className="w-10 h-1 accent-cyan-400 cursor-pointer shrink-0"
          title={`Volume: ${Math.round(row.volume * 100)}%`}
        />
      </div>

      {/* Steps grid */}
      <div className="flex items-center gap-px flex-1 overflow-x-auto scroll-x-hide">
        {stepsToRender.map((step, i) => (
          <DrumPad
            key={i}
            step={step}
            stepIdx={i}
            patternId={patternId}
            rowId={row.id}
            isCurrentStep={currentStep % row.stepCount === i}
            stepCount={row.stepCount}
          />
        ))}
      </div>

      {/* Step count selector */}
      <select
        value={row.stepCount}
        onChange={(e) => store.setStepCount(patternId, row.id, parseInt(e.target.value) as StepCount)}
        className="w-10 h-5 text-[9px] rounded outline-none cursor-pointer shrink-0"
        style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      >
        {[8, 16, 32, 64].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
