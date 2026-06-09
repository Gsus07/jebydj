'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import type { DAWClip } from '@/src/store/dawTypes';

interface StampToolProps {
  onStampSelect: (notes: { pitch: number, offsetTicks: number, durationTicks: number }[]) => void;
}

// Common chord stamps relative to root (0)
const CHORD_STAMPS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Maj7: [0, 4, 7, 11],
  Min7: [0, 3, 7, 10],
  Dom7: [0, 4, 7, 10],
  Dim: [0, 3, 6],
  Sus2: [0, 2, 7],
  Sus4: [0, 5, 7],
};

export function StampTool({ onStampSelect }: StampToolProps) {
  return (
    <div className="flex flex-col bg-[#1a1a1a] border border-white/10 rounded p-2 text-xs w-48 shadow-lg">
      <div className="flex items-center gap-2 mb-2 text-[#00f5ff] font-bold pb-2 border-b border-white/10">
        <Layers size={14} /> Stamp Tool
      </div>
      
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {Object.entries(CHORD_STAMPS).map(([name, pitches]) => (
          <button
            key={name}
            className="text-left px-2 py-1 rounded hover:bg-white/10 transition-colors flex justify-between"
            onClick={() => {
               // Default 1/4 note duration = 120 ticks (assuming 480 PPQ)
               const notes = pitches.map(p => ({ pitch: p, offsetTicks: 0, durationTicks: 120 }));
               onStampSelect(notes);
            }}
          >
            <span>{name}</span>
            <span className="text-white/40">{pitches.length} notes</span>
          </button>
        ))}
      </div>
    </div>
  );
}
