'use client';

import React, { useEffect, useState } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';
import type { SytrusEngine } from '@/src/lib/synths/SytrusEngine';
import { Knob } from '@/src/components/ui/Knob';

export function Sytrus({ channelId }: { channelId: string }) {
  const [engine, setEngine] = useState<SytrusEngine | null>(null);
  const channel = useChannelRackStore((s) => s.channels.find((c) => c.id === channelId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const e = getSynth(channelId) as SytrusEngine | undefined;
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
      <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/10" style={{ width: 140 }}>
        <div className="text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-1">
          Op {num}
        </div>
        <div className="flex gap-2 justify-center mb-1">
          <Knob
            label="Ratio"
            value={Math.log2(op.ratio) / 4 + 0.5}
            onChange={(v: number) => {
               const ratios = [0.5, 1, 2, 3, 4, 5, 6, 7, 8];
               updateParam(`op${num}.ratio`, ratios[Math.floor(v * (ratios.length - 1))]);
            }}
            size={28}
            color="var(--accent-magenta)"
          />
          <Knob
            label="Level"
            value={op.level}
            onChange={(v: number) => updateParam(`op${num}.level`, v)}
            size={28}
            color="#ffbe0b"
          />
        </div>
        <div className="flex gap-1 justify-center">
          <Knob label="A" value={op.attack} onChange={(v: number) => updateParam(`op${num}.attack`, v)} size={20} />
          <Knob label="D" value={op.decay} onChange={(v: number) => updateParam(`op${num}.decay`, v)} size={20} />
          <Knob label="S" value={op.sustain} onChange={(v: number) => updateParam(`op${num}.sustain`, v)} size={20} />
          <Knob label="R" value={op.release} onChange={(v: number) => updateParam(`op${num}.release`, v)} size={20} />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[700px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold text-[var(--accent-magenta)] tracking-widest uppercase flex items-center gap-2">
          Sytrus <span className="text-xs text-[var(--text-muted)]">— {channel.name}</span>
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
        {/* Operators */}
        <div className="grid grid-cols-2 gap-2">
          {renderOp(1)} {renderOp(2)}
          {renderOp(3)} {renderOp(4)}
          {renderOp(5)} {renderOp(6)}
        </div>

        {/* Modulation Matrix */}
        <div className="flex-1 p-3 rounded bg-white/5 border border-white/10 flex flex-col">
          <div className="text-xs font-bold text-[var(--accent-magenta)] uppercase tracking-wider mb-2 text-center">
            Modulation Matrix
          </div>
          
          <div className="grid grid-cols-7 gap-1 flex-1">
            <div /> {/* Top left corner */}
            {[1,2,3,4,5,6].map(c => (
               <div key={c} className="text-[9px] text-center text-white/50 pt-2">Op {c}</div>
            ))}
            
            {[1,2,3,4,5,6].map(mod => (
              <React.Fragment key={mod}>
                <div className="text-[9px] text-right text-white/50 pr-2 flex items-center justify-end">Op {mod}</div>
                {[1,2,3,4,5,6].map(car => (
                  <div key={`${mod}-${car}`} className="flex items-center justify-center bg-black/20 rounded">
                    <Knob
                      label=""
                      value={engine.modMatrix[mod-1][car-1]}
                      onChange={(v: number) => updateParam(`mod.${mod-1}.${car-1}`, v)}
                      size={24}
                      color="#00f5ff"
                    />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          <div className="mt-4 border-t border-white/10 pt-2 grid grid-cols-7 gap-1">
             <div className="text-[9px] text-right text-[var(--accent-cyan)] font-bold pr-2 flex items-center justify-end">OUT</div>
             {[1,2,3,4,5,6].map(idx => (
               <div key={idx} className="flex items-center justify-center bg-[var(--accent-magenta)]/10 rounded">
                 <Knob
                    label=""
                    value={engine.outMatrix[idx-1]}
                    onChange={(v: number) => updateParam(`out.${idx-1}`, v)}
                    size={28}
                    color="var(--accent-magenta)"
                 />
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
