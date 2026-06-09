'use client';

import React, { useEffect, useState } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';
import type { BooBassEngine } from '@/src/lib/synths/BooBassEngine';
import { Knob } from '@/src/components/ui/Knob';

export function BooBass({ channelId }: { channelId: string }) {
  const [engine, setEngine] = useState<BooBassEngine | null>(null);
  const channel = useChannelRackStore((s) => s.channels.find((c) => c.id === channelId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const e = getSynth(channelId) as BooBassEngine | undefined;
    if (e) setEngine(e);
  }, [channelId]);

  if (!engine || !channel) return null;

  const updateParam = (name: string, value: number) => {
    engine.setParam(name, value);
    setTick((t) => t + 1);
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[300px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: '#ffb703' }}>
          BooBass <span className="text-xs text-[var(--text-muted)]">— {channel.name}</span>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10">
        <Knob
          label="BASS"
          value={engine.bass}
          onChange={(v: number) => updateParam('bass', v)}
          size={40}
          color="#ffb703"
        />
        <Knob
          label="MID"
          value={engine.mid}
          onChange={(v: number) => updateParam('mid', v)}
          size={40}
          color="#ffb703"
        />
        <Knob
          label="HIGH"
          value={engine.high}
          onChange={(v: number) => updateParam('high', v)}
          size={40}
          color="#ffb703"
        />
        <div className="w-px h-10 bg-white/10 mx-2" />
        <Knob
          label="DECAY"
          value={engine.decay}
          onChange={(v: number) => updateParam('decay', v)}
          size={40}
          color="#06d6a0"
        />
      </div>
    </div>
  );
}
