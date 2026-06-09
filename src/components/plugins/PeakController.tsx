'use client';

import React, { useEffect, useState } from 'react';
import { PeakControllerProcessor } from '@/src/lib/plugins/PeakControllerProcessor';
import { Knob } from '@/src/components/ui/Knob';
import { Activity } from 'lucide-react';

export function PeakController({ processor }: { processor: PeakControllerProcessor }) {
  const [, setTick] = useState(0);
  const [meter, setMeter] = useState(0);

  // Params state for UI sync
  const [params, setParams] = useState({
    base: 0.5,
    volume: 0.5,
    tension: 0.5,
    lfoSpeed: 2,
    lfoAmount: 0.5,
    lfoShape: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const vals = processor.getControlValues();
      setMeter(vals.peak);
    }, 30);
    return () => clearInterval(timer);
  }, [processor]);

  const updateParam = (p: string, v: number) => {
    processor.setParam(p, v);
    setParams(prev => ({ ...prev, [p]: v }));
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[400px] bg-[#1a1a1a] rounded-lg border border-white/10 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: '#00f5ff' }}>
          <Activity size={18} /> Peak Controller
        </div>
      </div>

      <div className="flex gap-4">
        {/* PEAK */}
        <div className="flex-1 bg-white/5 p-3 rounded border border-white/10 flex flex-col items-center">
           <div className="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-2">PEAK</div>
           
           <div className="flex gap-2 mb-3">
             <Knob label="BASE" value={params.base} onChange={v => updateParam('base', v)} size={36} color="#00f5ff" />
             <Knob label="VOL" value={params.volume} onChange={v => updateParam('volume', v)} size={36} color="#00f5ff" />
             <Knob label="TENS" value={params.tension} onChange={v => updateParam('tension', v)} size={36} color="#00f5ff" />
           </div>

           {/* Meter */}
           <div className="w-full h-4 bg-black/50 rounded overflow-hidden border border-white/10 relative">
             <div 
               className="absolute top-0 left-0 h-full bg-[#00f5ff] transition-all duration-75" 
               style={{ width: `${meter * 100}%` }} 
             />
           </div>
        </div>

        {/* LFO */}
        <div className="flex-1 bg-white/5 p-3 rounded border border-white/10 flex flex-col items-center">
           <div className="text-xs font-bold text-[#ffbe0b] uppercase tracking-wider mb-2">LFO</div>
           <div className="flex gap-2 mb-3">
             <Knob label="SPEED" value={params.lfoSpeed / 20} onChange={v => updateParam('lfoSpeed', v * 20)} size={36} color="#ffbe0b" />
             <Knob label="AMT" value={params.lfoAmount} onChange={v => updateParam('lfoAmount', v)} size={36} color="#ffbe0b" />
           </div>
           
           {/* Shape selector */}
           <div className="flex gap-1">
             {['Sine', 'Tri', 'Sqr', 'Saw'].map((s, i) => (
                <button 
                  key={s}
                  className={`text-[9px] px-2 py-1 rounded transition-colors ${params.lfoShape === i ? 'bg-[#ffbe0b] text-black font-bold' : 'bg-white/10 hover:bg-white/20'}`}
                  onClick={() => updateParam('lfoShape', i)}
                >
                  {s}
                </button>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
