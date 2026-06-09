'use client';

import React, { useEffect, useState } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';
import type { PluckedEngine } from '@/src/lib/synths/PluckedEngine';
import { Knob } from '@/src/components/ui/Knob';

export function PluckedString({ channelId }: { channelId: string }) {
  const [engine, setEngine] = useState<PluckedEngine | null>(null);
  const channel = useChannelRackStore((s) => s.channels.find((c) => c.id === channelId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const e = getSynth(channelId) as PluckedEngine | undefined;
    if (e) setEngine(e);
  }, [channelId]);

  if (!engine || !channel) return null;

  const updateParam = (name: string, value: number) => {
    engine.setParam(name, value);
    setTick((t) => t + 1);
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[280px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: '#06d6a0' }}>
          Plucked <span className="text-xs text-[var(--text-muted)]">— {channel.name}</span>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10">
        <Knob
          label="DECAY"
          value={(engine.decay - 0.8) / 0.1999}
          onChange={(v: number) => updateParam('decay', 0.8 + v * 0.1999)}
          size={48}
          color="#06d6a0"
        />
        <Knob
          label="BODY"
          value={engine.body}
          onChange={(v: number) => updateParam('body', v)}
          size={48}
          color="#ffbe0b"
        />
        <Knob
          label="COLOR"
          value={engine.brightness}
          onChange={(v: number) => updateParam('brightness', v)}
          size={48}
          color="#ff006e"
        />
      </div>
    </div>
  );
}
