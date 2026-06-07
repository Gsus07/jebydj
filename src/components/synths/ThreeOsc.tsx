'use client';

import React, { useEffect, useState } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';
import type { ThreeOscEngine } from '@/src/lib/synths/ThreeOscEngine';
import { Knob } from '@/src/components/ui/Knob';

export function ThreeOsc({ channelId }: { channelId: string }) {
  const [engine, setEngine] = useState<ThreeOscEngine | null>(null);
  const channel = useChannelRackStore((s) => s.channels.find((c) => c.id === channelId));

  // Force re-render periodically to get current param values
  // In a real app we'd use an event emitter from the engine or sync via store, 
  // but for simplicity we'll just poll or use local state.
  const [, setTick] = useState(0);

  useEffect(() => {
    const e = getSynth(channelId) as ThreeOscEngine | undefined;
    if (e) setEngine(e);
  }, [channelId]);

  if (!engine || !channel) return null;

  const updateParam = (name: string, value: number) => {
    engine.setParam(name, value);
    setTick((t) => t + 1);
  };

  const renderOsc = (num: 1 | 2 | 3) => {
    const osc = engine[`osc${num}`];
    return (
      <div className="flex flex-col gap-2 p-3 rounded bg-white/5 border border-white/10 flex-1">
        <div className="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-1">
          Oscillator {num}
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          {['sine', 'triangle', 'square', 'sawtooth'].map((w) => (
            <button
              key={w}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${osc.waveform === w ? 'bg-[var(--accent-cyan)] text-black' : 'bg-white/10 hover:bg-white/20'}`}
              onClick={() => updateParam(`osc${num}.waveform`, w as any)}
              title={w}
            >
              {/* crude shape icons */}
              {w === 'sine' && '∿'}
              {w === 'triangle' && '△'}
              {w === 'square' && '⎍'}
              {w === 'sawtooth' && '◿'}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <Knob
            label="Vol"
            value={osc.volume}
            onChange={(v) => updateParam(`osc${num}.volume`, v)}
            size={32}
            color="var(--accent-cyan)"
          />
          <Knob
            label="CRS"
            value={(osc.coarse + 24) / 48}
            onChange={(v: number) => updateParam(`osc${num}.coarse`, Math.round(v * 48 - 24))}
            size={32}
            color="var(--accent-magenta)"
          />
          <Knob
            label="FIN"
            value={(osc.fine + 100) / 200}
            onChange={(v: number) => updateParam(`osc${num}.fine`, Math.round(v * 200 - 100))}
            size={32}
            color="#ffbe0b"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[600px]">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold text-[var(--accent-magenta)] tracking-widest uppercase flex items-center gap-2">
          3xOsc <span className="text-xs text-[var(--text-muted)]">— {channel.name}</span>
        </div>
        <Knob
          label="Master"
          value={engine.masterVolume}
          onChange={(v) => updateParam('volume', v)}
          size={36}
          color="#ff4444"
        />
      </div>

      <div className="flex gap-4">
        {/* OSCILLATORS */}
        <div className="flex flex-col gap-2 w-[220px]">
          {renderOsc(1)}
          {renderOsc(2)}
          {renderOsc(3)}
        </div>

        {/* ENVELOPES & FILTER */}
        <div className="flex flex-col gap-4 flex-1">
          {/* AMP ENV */}
          <div className="p-3 rounded bg-white/5 border border-white/10">
            <div className="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-2">Volume Envelope</div>
            <div className="flex gap-4">
              <Knob label="ATT" value={engine.ampADSR.attack} onChange={v => updateParam('amp.attack', v)} size={32} />
              <Knob label="DEC" value={engine.ampADSR.decay} onChange={v => updateParam('amp.decay', v)} size={32} />
              <Knob label="SUS" value={engine.ampADSR.sustain} onChange={v => updateParam('amp.sustain', v)} size={32} />
              <Knob label="REL" value={engine.ampADSR.release} onChange={v => updateParam('amp.release', v)} size={32} />
            </div>
          </div>

          {/* FILTER */}
          <div className="p-3 rounded bg-white/5 border border-white/10 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-wider">Filter</div>
              <select
                value={engine.filter.type}
                onChange={(e) => updateParam('filter.type', e.target.value as any)}
                className="bg-black/50 border border-white/10 text-xs rounded px-1 outline-none"
              >
                <option value="none">Off</option>
                <option value="lowpass">LowPass</option>
                <option value="highpass">HighPass</option>
                <option value="bandpass">BandPass</option>
              </select>
            </div>
            
            <div className="flex gap-4 mb-4">
              <Knob 
                label="CUT" 
                value={Math.log2(engine.filter.cutoff / 20) / Math.log2(20000 / 20)} 
                onChange={v => {
                  const freq = 20 * Math.pow(2, v * Math.log2(20000 / 20));
                  updateParam('filter.cutoff', freq);
                }} 
                size={40} 
                color="var(--accent-magenta)" 
              />
              <Knob 
                label="RES" 
                value={engine.filter.resonance / 20} 
                onChange={v => updateParam('filter.resonance', v * 20)} 
                size={40} 
                color="var(--accent-magenta)" 
              />
              <Knob 
                label="ENV" 
                value={(engine.filter.envAmount + 1) / 2} 
                onChange={(v: number) => updateParam('filter.envAmount', v * 2 - 1)} 
                size={40} 
                color="#ffbe0b" 
              />
            </div>

            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Filter Envelope</div>
            <div className="flex gap-4">
              <Knob label="ATT" value={engine.filterADSR.attack} onChange={v => updateParam('filter.attack', v)} size={28} />
              <Knob label="DEC" value={engine.filterADSR.decay} onChange={v => updateParam('filter.decay', v)} size={28} />
              <Knob label="SUS" value={engine.filterADSR.sustain} onChange={v => updateParam('filter.sustain', v)} size={28} />
              <Knob label="REL" value={engine.filterADSR.release} onChange={v => updateParam('filter.release', v)} size={28} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
