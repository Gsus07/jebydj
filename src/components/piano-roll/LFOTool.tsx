'use client';

import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { Knob } from '@/src/components/ui/Knob';

interface LFOToolProps {
  onApply: (params: { target: 'velocity'|'pan'|'pitch', shape: 'sine'|'triangle'|'square', speed: number, depth: number, phase: number }) => void;
  onClose: () => void;
}

export function LFOTool({ onApply, onClose }: LFOToolProps) {
  const [target, setTarget] = useState<'velocity'|'pan'|'pitch'>('velocity');
  const [shape, setShape] = useState<'sine'|'triangle'|'square'>('sine');
  const [speed, setSpeed] = useState(0.5); // normalized frequency
  const [depth, setDepth] = useState(0.5); // 0 to 1 amount
  const [phase, setPhase] = useState(0); // 0 to 1

  return (
    <div className="flex flex-col bg-[#1a1a1a] border border-white/10 rounded p-4 text-xs w-64 shadow-2xl font-rajdhani">
      <div className="flex items-center justify-between mb-4 text-[#06d6a0] font-bold pb-2 border-b border-white/10 text-lg uppercase tracking-widest">
        <div className="flex items-center gap-2"><Activity size={18} /> Note LFO Tool</div>
        <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between items-center bg-white/5 p-2 rounded">
          <span className="text-white/70">Target</span>
          <select 
             className="bg-black border border-white/20 rounded px-1 outline-none text-[#06d6a0]"
             value={target}
             onChange={e => setTarget(e.target.value as any)}
          >
            <option value="velocity">Velocity</option>
            <option value="pan">Pan</option>
            <option value="pitch">Pitch</option>
          </select>
        </div>

        <div className="flex justify-between items-center bg-white/5 p-2 rounded">
          <span className="text-white/70">Shape</span>
          <select 
             className="bg-black border border-white/20 rounded px-1 outline-none text-white"
             value={shape}
             onChange={e => setShape(e.target.value as any)}
          >
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
          </select>
        </div>

        <div className="flex justify-around items-center bg-white/5 p-2 rounded py-4">
           <Knob label="SPEED" value={speed} onChange={v => setSpeed(v)} size={36} color="#06d6a0" />
           <Knob label="DEPTH" value={depth} onChange={v => setDepth(v)} size={36} color="#06d6a0" />
           <Knob label="PHASE" value={phase} onChange={v => setPhase(v)} size={36} color="#ffbe0b" />
        </div>
      </div>

      <button 
        className="bg-[#06d6a0] text-black font-bold py-2 rounded hover:bg-[#06d6a0]/80 transition-colors uppercase tracking-widest"
        onClick={() => {
          onApply({ target, shape, speed, depth, phase });
          onClose();
        }}
      >
        Apply
      </button>
    </div>
  );
}
