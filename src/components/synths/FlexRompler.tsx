'use client';

import React, { useEffect, useState } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';
import type { FlexRomplerEngine } from '@/src/lib/synths/FlexRomplerEngine';
import { Knob } from '@/src/components/ui/Knob';
import { Layers } from 'lucide-react';

export function FlexRompler({ channelId }: { channelId: string }) {
  const [engine, setEngine] = useState<FlexRomplerEngine | null>(null);
  const channel = useChannelRackStore((s) => s.channels.find((c) => c.id === channelId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const e = getSynth(channelId) as FlexRomplerEngine | undefined;
    if (e) setEngine(e);
  }, [channelId]);

  if (!engine || !channel) return null;

  const updateParam = (name: string, value: number) => {
    engine.setParam(name, value);
    setTick((t) => t + 1);
  };

  const cats = ['pad', 'lead', 'pluck'];

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[380px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: 'var(--accent-cyan)' }}>
          <Layers size={18} /> FLEX <span className="text-xs text-[var(--text-muted)]">— {channel.name}</span>
        </div>
        <Knob
          label="Master"
          value={engine.masterVolume}
          onChange={(v: number) => updateParam('volume', v)}
          size={36}
          color="#ff4444"
        />
      </div>

      <div className="flex gap-4">
        {/* Preset Selector */}
        <div className="flex flex-col gap-2 bg-white/5 p-3 rounded-lg border border-white/10 flex-1">
          <div className="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-1">Preset</div>
          {cats.map((cat, i) => (
            <button
              key={cat}
              className="px-3 py-2 text-left rounded text-xs transition-colors"
              style={{
                background: engine.category === cat ? 'var(--accent-cyan)' : 'rgba(0,0,0,0.3)',
                color: engine.category === cat ? '#000' : 'var(--text-primary)'
              }}
              onClick={() => updateParam('category', i)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)} (Procedural)
            </button>
          ))}
        </div>

        {/* Envelope & Filter */}
        <div className="flex flex-col gap-4">
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-center gap-4">
            <Knob
              label="ATTACK"
              value={engine.attack / 2.0} // max 2s
              onChange={(v: number) => updateParam('attack', v * 2.0)}
              size={40}
              color="var(--accent-magenta)"
            />
            <Knob
              label="RELEASE"
              value={engine.release / 5.0} // max 5s
              onChange={(v: number) => updateParam('release', v * 5.0)}
              size={40}
              color="var(--accent-magenta)"
            />
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex justify-center">
            <Knob
              label="CUTOFF"
              value={Math.log2(engine.cutoff / 20) / Math.log2(20000 / 20)}
              onChange={(v: number) => updateParam('cutoff', 20 * Math.pow(2, v * Math.log2(20000 / 20)))}
              size={48}
              color="#ffbe0b"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
