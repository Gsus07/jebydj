'use client';

import React, { useEffect, useState } from 'react';
import { MaximusProcessor } from '@/src/lib/plugins/MaximusProcessor';
import { Knob } from '@/src/components/ui/Knob';

export function Maximus({ processor }: { processor: MaximusProcessor }) {
  const [, setTick] = useState(0);
  const [reductions, setReductions] = useState({ low: 0, mid: 0, high: 0, master: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      setReductions(processor.getReduction());
    }, 50);
    return () => clearInterval(timer);
  }, [processor]);

  // Initial params state
  const [params, setParams] = useState({
    low: { threshold: -24, ratio: 12, gain: 1 },
    mid: { threshold: -24, ratio: 12, gain: 1 },
    high: { threshold: -24, ratio: 12, gain: 1 },
    master: { threshold: -0.5, ratio: 20 },
    split1: 200,
    split2: 2000,
  });

  const updateBandParam = (band: 'low' | 'mid' | 'high' | 'master', p: string, v: number) => {
    processor.setParam(band, p, v);
    setParams(prev => ({ ...prev, [band]: { ...(prev as any)[band], [p]: v } }));
  };

  const updateSplit = (split: 1 | 2, v: number) => {
    processor.setCrossover(split, v);
    setParams(prev => ({ ...prev, [`split${split}`]: v }));
  };

  const renderBand = (band: 'low' | 'mid' | 'high', title: string, color: string) => {
    const p = (params as any)[band];
    const red = (reductions as any)[band] || 0;
    
    return (
      <div className="flex flex-col gap-2 p-3 bg-white/5 rounded border border-white/10 w-[140px]">
        <div className="text-xs font-bold text-center tracking-widest uppercase" style={{ color }}>{title}</div>
        
        {/* Gain Reduction Meter */}
        <div className="h-2 w-full bg-black rounded overflow-hidden mt-1 mb-2">
          <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${Math.min(100, Math.abs(red) * 4)}%` }} />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Knob
            label="THRES"
            value={(p.threshold + 60) / 60}
            onChange={(v: number) => updateBandParam(band, 'threshold', v * 60 - 60)}
            size={36}
            color={color}
          />
          <Knob
            label="RATIO"
            value={(p.ratio - 1) / 19}
            onChange={(v: number) => updateBandParam(band, 'ratio', 1 + v * 19)}
            size={36}
            color={color}
          />
          <Knob
            label="GAIN"
            value={p.gain / 4}
            onChange={(v: number) => updateBandParam(band, 'gain', v * 4)}
            size={36}
            color={color}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[650px] bg-black/50 rounded-lg border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold text-[var(--accent-magenta)] tracking-widest uppercase flex items-center gap-2">
          Maximus <span className="text-xs text-[var(--text-muted)]">— Multiband Compressor</span>
        </div>
      </div>

      <div className="flex gap-4">
        {renderBand('low', 'LOW', '#ff4444')}
        {renderBand('mid', 'MID', '#ffbe0b')}
        {renderBand('high', 'HIGH', '#06d6a0')}

        <div className="w-px bg-white/10" />

        {/* Master & Crossovers */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Master */}
          <div className="p-3 bg-white/5 rounded border border-white/10">
             <div className="text-xs font-bold text-center tracking-widest uppercase text-[var(--accent-magenta)] mb-2">MASTER LIMITER</div>
             <div className="h-2 w-full bg-black rounded overflow-hidden mb-2">
               <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${Math.min(100, Math.abs(reductions.master) * 4)}%` }} />
             </div>
             <div className="flex justify-center gap-4">
                <Knob
                  label="CEIL"
                  value={(params.master.threshold + 20) / 20}
                  onChange={(v: number) => updateBandParam('master', 'threshold', v * 20 - 20)}
                  size={48}
                  color="var(--accent-magenta)"
                />
             </div>
          </div>

          {/* Crossovers */}
          <div className="p-3 bg-white/5 rounded border border-white/10 flex justify-around">
            <div className="flex flex-col items-center">
               <span className="text-[9px] text-white/50 uppercase mb-1">Low / Mid</span>
               <input type="range" min="50" max="500" value={params.split1} onChange={e => updateSplit(1, Number(e.target.value))} className="w-24" />
               <span className="text-[10px]">{Math.round(params.split1)} Hz</span>
            </div>
            <div className="flex flex-col items-center">
               <span className="text-[9px] text-white/50 uppercase mb-1">Mid / High</span>
               <input type="range" min="1000" max="10000" value={params.split2} onChange={e => updateSplit(2, Number(e.target.value))} className="w-24" />
               <span className="text-[10px]">{Math.round(params.split2)} Hz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
