'use client';

import React from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import type { CompressorParams } from '@/src/store/dawTypes';

interface CompressorPluginProps {
  trackId: string;
  pluginId: string;
}

export default function CompressorPlugin({ trackId, pluginId }: CompressorPluginProps) {
  const store = useDAWStore();
  const track = store.project.tracks.find((t) => t.id === trackId);
  const plugin = track?.plugins.find((p) => p.id === pluginId);
  const params = plugin?.params as CompressorParams | undefined;

  if (!plugin || !params) return null;

  const update = (patch: Partial<CompressorParams>) =>
    store.updatePluginParams<'compressor'>(trackId, pluginId, patch);

  const knob = (label: string, value: number, min: number, max: number, step: number, key: keyof CompressorParams, format?: (v: number) => string) => (
    <div className="flex flex-col items-center gap-1" style={{ minWidth: 52 }}>
      <div className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => update({ [key]: parseFloat(e.target.value) } as Partial<CompressorParams>)}
        className="w-12 h-1 appearance-none rounded cursor-pointer"
        style={{ accentColor: 'var(--accent-magenta)', writingMode: 'vertical-lr' as const, height: 50, width: 8 }}
        title={format ? format(value) : String(value)}
      />
      <div className="text-[9px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-orbitron)' }}>
        {format ? format(value) : value.toFixed(1)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 p-2" style={{ fontFamily: 'var(--font-rajdhani)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent-magenta)' }}>
        Compressor
      </div>
      <div className="flex items-end gap-2 justify-around">
        {knob('Thresh', params.threshold, -60, 0, 1, 'threshold', (v) => `${v}dB`)}
        {knob('Ratio', params.ratio, 1, 20, 0.5, 'ratio', (v) => `${v}:1`)}
        {knob('Attack', params.attack * 1000, 0.1, 500, 0.1, 'attack', (v) => `${v.toFixed(1)}ms`)}
        {knob('Release', params.release * 1000, 10, 2000, 1, 'release', (v) => `${v}ms`)}
        {knob('Knee', params.knee, 0, 30, 0.5, 'knee', (v) => `${v}dB`)}
        {knob('Makeup', params.makeupGain, -6, 24, 0.5, 'makeupGain', (v) => `+${v.toFixed(1)}dB`)}
      </div>

      {/* GR meter */}
      <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
        <span>GR</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
          <div className="h-full rounded-full" style={{ width: '0%', background: 'var(--accent-magenta)' }} />
        </div>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-orbitron)' }}>0dB</span>
      </div>
    </div>
  );
}
