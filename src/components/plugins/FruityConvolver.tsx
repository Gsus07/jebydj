'use client';

import React, { useState } from 'react';
import { ConvolverProcessor } from '@/src/lib/plugins/ConvolverProcessor';
import { Knob } from '@/src/components/ui/Knob';
import { Waves } from 'lucide-react';

export function FruityConvolver({ processor }: { processor: ConvolverProcessor }) {
  const [params, setParams] = useState({
    dry: 1.0,
    wet: 0.5,
    eqLow: 0,
    eqHigh: 0,
  });

  const updateParam = (p: string, v: number) => {
    processor.setParam(p, v);
    setParams(prev => ({ ...prev, [p]: v }));
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[400px] bg-black/80 rounded-lg border border-white/20 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: '#00f5ff' }}>
          <Waves size={18} /> Fruity Convolver
        </div>
      </div>

      {/* Main Display (Mock IR Waveform) */}
      <div className="h-24 bg-white/5 border border-white/10 rounded overflow-hidden flex items-center justify-center relative">
        <div className="absolute inset-0 opacity-30 flex">
           {/* Mock decaying waveform */}
           {Array.from({ length: 40 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 bg-[#00f5ff] mx-[1px]" 
                style={{ height: `${Math.max(2, 100 * Math.exp(-i / 10))}%`, alignSelf: 'center' }}
              />
           ))}
        </div>
        <span className="text-xs text-white/50 z-10 font-bold bg-black/50 px-2 rounded">Default Impulse</span>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-start bg-white/5 p-3 rounded border border-white/10">
        
        {/* EQ */}
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-bold text-white/50 tracking-widest mb-2">PRE-EQ</div>
          <div className="flex gap-2">
            <Knob 
              label="LOW" 
              value={(params.eqLow + 12) / 24} 
              onChange={v => updateParam('eqLow', v * 24 - 12)} 
              size={36} 
              color="#ffbe0b" 
            />
            <Knob 
              label="HIGH" 
              value={(params.eqHigh + 12) / 24} 
              onChange={v => updateParam('eqHigh', v * 24 - 12)} 
              size={36} 
              color="#ffbe0b" 
            />
          </div>
        </div>

        <div className="w-px h-16 bg-white/10 mx-2" />

        {/* Mix */}
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-bold text-white/50 tracking-widest mb-2">MIX</div>
          <div className="flex gap-2">
            <Knob 
              label="DRY" 
              value={params.dry} 
              onChange={v => updateParam('dry', v)} 
              size={40} 
              color="white" 
            />
            <Knob 
              label="WET" 
              value={params.wet} 
              onChange={v => updateParam('wet', v)} 
              size={40} 
              color="#00f5ff" 
            />
          </div>
        </div>

      </div>
    </div>
  );
}
