'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GrossBeatProcessor } from '@/src/lib/plugins/GrossBeatProcessor';

export function GrossBeat({ processor }: { processor: GrossBeatProcessor }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 100 points for the time curve (Y axis is playback offset, X is time)
  const [timeCurve, setTimeCurve] = useState<Float32Array>(() => new Float32Array(100).fill(1.0));
  const [volumeCurve, setVolumeCurve] = useState<Float32Array>(() => new Float32Array(100).fill(1.0));
  
  const [activeSlot, setActiveSlot] = useState(0);

  // Sync to processor when curves change
  useEffect(() => {
    processor.updateCurves(timeCurve, volumeCurve, 120); // hardcoded BPM for now
  }, [timeCurve, volumeCurve, processor]);

  // Drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background grid
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = (i / 4) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Time Curve (Green)
    ctx.strokeStyle = '#06d6a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 100; i++) {
      const x = (i / 99) * w;
      const y = (1.0 - timeCurve[i]) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Volume Curve (Yellow)
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < 100; i++) {
      const x = (i / 99) * w;
      const y = (1.0 - volumeCurve[i]) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }, [timeCurve, volumeCurve]);

  // Handle drawing on canvas
  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.buttons !== 2) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const index = Math.min(99, Math.max(0, Math.floor((x / rect.width) * 100)));
    const val = 1.0 - (y / rect.height);
    const clampedVal = Math.max(0, Math.min(1, val));

    // Left click edits Time, Right click edits Volume
    if (e.buttons === 1) {
      setTimeCurve(prev => {
        const next = new Float32Array(prev);
        next[index] = clampedVal;
        return next;
      });
    } else if (e.buttons === 2) {
      setVolumeCurve(prev => {
        const next = new Float32Array(prev);
        next[index] = clampedVal;
        return next;
      });
    }
  };

  const loadPreset = (preset: 'normal' | 'halfSpeed' | 'gate' | 'reverse') => {
    const tCurve = new Float32Array(100);
    const vCurve = new Float32Array(100).fill(1.0);
    
    if (preset === 'normal') {
      tCurve.fill(1.0);
    } else if (preset === 'halfSpeed') {
      for (let i = 0; i < 100; i++) {
        // Starts at 1.0, goes to 0.5 at end. 
        // GrossBeat time offset: y=1 is normal time, y=0 is -1 bar.
        // For half speed, we want to gradually delay up to -0.5 bars over 1 bar.
        tCurve[i] = 1.0 - (i / 99) * 0.5;
      }
    } else if (preset === 'reverse') {
      for (let i = 0; i < 100; i++) {
        // Start at -1 bar offset, go to 0 bar offset
        tCurve[i] = (i / 99);
      }
    } else if (preset === 'gate') {
      tCurve.fill(1.0);
      for (let i = 0; i < 100; i++) {
        // Mute every other 16th note (100 points / 16 steps = ~6.25 points per step)
        const step = Math.floor(i / 6.25);
        vCurve[i] = step % 2 === 0 ? 1.0 : 0.0;
      }
    }
    
    setTimeCurve(tCurve);
    setVolumeCurve(vCurve);
  };

  return (
    <div className="p-4 flex gap-4 font-rajdhani text-[var(--text-primary)] w-[700px] bg-black/50 rounded-lg border border-white/10">
      
      {/* Side Slots (Presets) */}
      <div className="w-32 flex flex-col gap-1 border-r border-white/10 pr-4">
        <div className="text-xs font-bold text-[var(--accent-magenta)] mb-2">TIME SLOTS</div>
        {[
          { id: 'normal', name: 'Empty' },
          { id: 'halfSpeed', name: '1/2 Speed' },
          { id: 'reverse', name: 'Reverse' },
          { id: 'gate', name: 'Trance Gate' },
        ].map((p, i) => (
          <button
            key={i}
            className={`text-left px-2 py-1 text-xs rounded transition-colors ${activeSlot === i ? 'bg-[var(--accent-magenta)] text-black font-bold' : 'bg-white/5 hover:bg-white/10'}`}
            onClick={() => {
              setActiveSlot(i);
              loadPreset(p.id as any);
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <div className="flex gap-4">
            <span style={{ color: '#06d6a0' }}>● Time</span>
            <span style={{ color: '#ffbe0b' }}>● Volume (Right Click)</span>
          </div>
          <span className="text-white/40">1 Bar</span>
        </div>
        
        <canvas
          ref={canvasRef}
          width={500}
          height={300}
          className="rounded cursor-crosshair border border-white/20"
          onMouseMove={handleDraw}
          onMouseDown={handleDraw}
          onContextMenu={e => e.preventDefault()}
        />
      </div>
    </div>
  );
}
