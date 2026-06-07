'use client';

import React, { useEffect, useState } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';
import type { FMSynthEngine } from '@/src/lib/synths/FMSynthEngine';
import { Knob } from '@/src/components/ui/Knob';

export function FMSynth({ channelId }: { channelId: string }) {
  const [engine, setEngine] = useState<FMSynthEngine | null>(null);
  const channel = useChannelRackStore((s) => s.channels.find((c) => c.id === channelId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const e = getSynth(channelId) as FMSynthEngine | undefined;
    if (e) setEngine(e);
  }, [channelId]);

  if (!engine || !channel) return null;

  const updateParam = (name: string, value: number) => {
    engine.setParam(name, value);
    setTick((t) => t + 1);
  };

  const renderOp = (num: number) => {
    const op = engine.ops[num - 1];
    return (
      <div className="flex flex-col gap-2 p-3 rounded bg-white/5 border border-white/10 flex-1">
        <div className="text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-1 flex justify-between">
          <span>Operator {num}</span>
          <span className="text-white/40">{num === 1 ? '(Carrier)' : '(Modulator)'}</span>
        </div>

        <div className="flex gap-4 mb-2">
          <Knob
            label="Ratio"
            value={Math.log2(op.ratio) / 4 + 0.5} // simplified mapping for UI
            onChange={(v: number) => {
               const ratios = [0.5, 1, 2, 3, 4, 5, 6, 7, 8];
               const ratio = ratios[Math.floor(v * (ratios.length - 1))];
               updateParam(`op${num}.ratio`, ratio);
            }}
            size={36}
            color="var(--accent-magenta)"
          />
          <Knob
            label="Level"
            value={op.level}
            onChange={(v: number) => updateParam(`op${num}.level`, v)}
            size={36}
            color="#ffbe0b"
          />
        </div>

        <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Envelope</div>
        <div className="flex gap-3">
          <Knob label="A" value={op.attack} onChange={(v: number) => updateParam(`op${num}.attack`, v)} size={24} />
          <Knob label="D" value={op.decay} onChange={(v: number) => updateParam(`op${num}.decay`, v)} size={24} />
          <Knob label="S" value={op.sustain} onChange={(v: number) => updateParam(`op${num}.sustain`, v)} size={24} />
          <Knob label="R" value={op.release} onChange={(v: number) => updateParam(`op${num}.release`, v)} size={24} />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[500px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold text-[var(--accent-magenta)] tracking-widest uppercase flex items-center gap-2">
          FM Synth <span className="text-xs text-[var(--text-muted)]">— {channel.name}</span>
        </div>
        <Knob
          label="Master"
          value={engine.masterVolume}
          onChange={(v: number) => updateParam('volume', v)}
          size={36}
          color="#ff4444"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {renderOp(4)}
        {renderOp(3)}
        {renderOp(2)}
        {renderOp(1)}
      </div>

      <div className="text-[10px] text-center text-white/40 mt-2">
        Signal Flow: Op 4 → Op 3 → Op 2 → Op 1 → Out
      </div>
    </div>
  );
}
