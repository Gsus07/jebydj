'use client';

import React, { useState } from 'react';
import { AlignJustify } from 'lucide-react';
import { Knob } from '@/src/components/ui/Knob';

interface ArpToolProps {
  onApply: (params: { mode: 'up'|'down'|'updown'|'random', range: number, time: number, gate: number }) => void;
  onClose: () => void;
}

export function ArpTool({ onApply, onClose }: ArpToolProps) {
  const [mode, setMode] = useState<'up'|'down'|'updown'|'random'>('up');
  const [range, setRange] = useState(1); // 1 to 4 octaves
  const [time, setTime] = useState(120); // 120 ticks = 1/4 note
  const [gate, setGate] = useState(0.8); // 0.1 to 1.0 length multiplier

  return (
    <div className="flex flex-col bg-[#1a1a1a] border border-white/10 rounded p-4 text-xs w-64 shadow-2xl font-rajdhani">
      <div className="flex items-center justify-between mb-4 text-[#ff006e] font-bold pb-2 border-b border-white/10 text-lg uppercase tracking-widest">
        <div className="flex items-center gap-2"><AlignJustify size={18} /> Arpeggiator</div>
        <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between items-center bg-white/5 p-2 rounded">
          <span className="text-white/70">Mode</span>
          <select 
             className="bg-black border border-white/20 rounded px-1 outline-none text-[#ff006e]"
             value={mode}
             onChange={e => setMode(e.target.value as any)}
          >
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="updown">Up/Down</option>
            <option value="random">Random</option>
          </select>
        </div>

        <div className="flex justify-between items-center bg-white/5 p-2 rounded">
           <span className="text-white/70">Range (Octaves)</span>
           <input type="number" min="1" max="4" value={range} onChange={e => setRange(parseInt(e.target.value))} className="bg-black border border-white/20 rounded w-12 text-center" />
        </div>

        <div className="flex justify-around items-center bg-white/5 p-2 rounded py-4">
           <div className="flex flex-col items-center">
             <Knob label="TIME" value={(time - 30) / 450} onChange={v => setTime(Math.round(30 + v * 450))} size={40} color="#ffbe0b" />
             <span className="text-[10px] text-white/50">{time} ticks</span>
           </div>
           <div className="flex flex-col items-center">
             <Knob label="GATE" value={gate} onChange={v => setGate(Math.max(0.05, v))} size={40} color="#06d6a0" />
             <span className="text-[10px] text-white/50">{Math.round(gate * 100)}%</span>
           </div>
        </div>
      </div>

      <button 
        className="bg-[#ff006e] text-white font-bold py-2 rounded hover:bg-[#ff006e]/80 transition-colors uppercase tracking-widest"
        onClick={() => {
          onApply({ mode, range, time, gate });
          onClose();
        }}
      >
        Accept
      </button>
    </div>
  );
}
