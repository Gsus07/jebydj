'use client';

import React, { useState, useEffect } from 'react';
import { FloatingWindow } from './FloatingWindow';
import { ClipboardList, Download } from 'lucide-react';
import { getSynth } from '@/src/lib/pattern/PatternEngine';

interface LogEntry {
  id: string;
  timestamp: number;
  pitch: number;
  velocity: number;
}

export function ScoreLog({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Intercept synth noteOn globally. In a real DAW we'd have a global MIDI bus.
    // We'll mock it by listening to our custom event or polling
    const onMidiMessage = (e: CustomEvent<LogEntry>) => {
      setLogs(prev => [e.detail, ...prev].slice(0, 100)); // keep last 100
    };
    
    window.addEventListener('midi-log', onMidiMessage as EventListener);
    return () => window.removeEventListener('midi-log', onMidiMessage as EventListener);
  }, []);

  return (
    <FloatingWindow title="Score Log" icon={<ClipboardList size={14} />} onClose={onClose} initialW={300} initialH={400} initialX={50} initialY={50}>
       <div className="flex flex-col h-full bg-[#111] font-rajdhani">
         <div className="flex justify-between items-center p-2 border-b border-white/10 bg-[#1a1a1a]">
           <span className="text-xs text-white/50">Last 3 minutes of MIDI</span>
           <button className="flex items-center gap-1 text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white/70 transition-colors">
             <Download size={12} /> Dump to Piano Roll
           </button>
         </div>

         <div className="flex-1 overflow-y-auto p-2">
           {logs.length === 0 ? (
             <div className="text-xs text-white/40 p-4 text-center">Play some notes...</div>
           ) : (
             <div className="flex flex-col gap-1">
               {logs.map(log => (
                 <div key={log.id} className="flex justify-between items-center text-xs p-1 px-2 rounded bg-white/5 border border-white/5">
                   <div className="flex items-center gap-2">
                     <span className="text-[#00f5ff] font-bold w-6">{log.pitch}</span>
                     <span className="text-white/40">Vel: {Math.round(log.velocity)}</span>
                   </div>
                   <span className="text-[10px] text-white/30">{new Date(log.timestamp).toLocaleTimeString()}</span>
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>
    </FloatingWindow>
  );
}
