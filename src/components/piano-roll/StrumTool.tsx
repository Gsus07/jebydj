'use client';

import React, { useState } from 'react';
import { Logs } from 'lucide-react';
import { Knob } from '@/src/components/ui/Knob';

interface StrumToolProps {
  onApply: (params: { time: number, velocity: number, tension: number, altDirection: boolean }) => void;
  onClose: () => void;
}

export function StrumTool({ onApply, onClose }: StrumToolProps) {
  // Strum settings
  const [time, setTime] = useState(0.5); // determines strum offset per note
  const [velocity, setVelocity] = useState(0.5); // decay of velocity
  const [tension, setTension] = useState(0.5); // acceleration of strum
  const [altDirection, setAltDirection] = useState(false);

  return (
    <div className="flex flex-col bg-[#1a1a1a] border border-white/10 rounded p-4 text-xs w-64 shadow-2xl font-rajdhani">
      <div className="flex items-center justify-between mb-4 text-[#ffbe0b] font-bold pb-2 border-b border-white/10 text-lg uppercase tracking-widest">
        <div className="flex items-center gap-2"><Logs size={18} /> Strumizer</div>
        <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-around items-center bg-white/5 p-2 rounded py-4">
           <Knob label="TIME" value={time} onChange={v => setTime(v)} size={40} color="#ffbe0b" />
           <Knob label="VEL" value={velocity} onChange={v => setVelocity(v)} size={40} color="#00f5ff" />
           <Knob label="TENS" value={tension} onChange={v => setTension(v)} size={40} color="#ff006e" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded">
          <input type="checkbox" checked={altDirection} onChange={e => setAltDirection(e.target.checked)} className="accent-[#ffbe0b]" />
          <span className="text-white/70">Alternate Direction</span>
        </label>
      </div>

      <button 
        className="bg-[#ffbe0b] text-black font-bold py-2 rounded hover:bg-[#ffbe0b]/80 transition-colors uppercase tracking-widest"
        onClick={() => {
          onApply({ time, velocity, tension, altDirection });
          onClose();
        }}
      >
        Accept
      </button>
    </div>
  );
}
