'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ParametricEQProcessor, type EQBand } from '@/src/lib/plugins/ParametricEQProcessor';
import { Activity } from 'lucide-react';

export function ParametricEQ({ processor }: { processor: ParametricEQProcessor }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bands, setBands] = useState<EQBand[]>(() => [...processor.bands]);
  const [selectedBand, setSelectedBand] = useState<number>(0);
  
  const [, setTick] = useState(0);

  // Drawing loop
  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;
    
    // Arrays for frequency response
    const resolution = 200;
    const freqs = new Float32Array(resolution);
    const mag = new Float32Array(resolution);
    const phase = new Float32Array(resolution);
    
    const minFreq = 20;
    const maxFreq = 20000;
    
    for (let i = 0; i < resolution; i++) {
      freqs[i] = minFreq * Math.pow(maxFreq / minFreq, i / (resolution - 1));
    }
    
    const freqData = new Uint8Array(processor['_analyzer'].frequencyBinCount);

    const draw = () => {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
      
      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      [100, 1000, 10000].forEach(f => {
         const x = (Math.log10(f / minFreq) / Math.log10(maxFreq / minFreq)) * w;
         ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      });

      // Draw Analyzer
      processor.getFrequencyData(freqData);
      const binCount = freqData.length;
      const sampleRate = processor['_ctx'].sampleRate;
      
      ctx.fillStyle = 'rgba(0, 245, 255, 0.2)';
      for (let i = 0; i < binCount; i++) {
        const binFreq = i * sampleRate / (binCount * 2);
        if (binFreq < minFreq) continue;
        if (binFreq > maxFreq) break;
        
        const x = (Math.log10(binFreq / minFreq) / Math.log10(maxFreq / minFreq)) * w;
        const v = freqData[i] / 255.0;
        const y = h - (v * h);
        
        ctx.fillRect(x, y, 2, h - y);
      }
      
      // Draw EQ Curve
      processor.getFrequencyResponse(freqs, mag, phase);
      
      ctx.strokeStyle = '#ffbe0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < resolution; i++) {
        const x = (i / (resolution - 1)) * w;
        // mag is linear amplitude. Convert to dB: 20 * log10(mag)
        // Let's say +18dB to -18dB range
        const db = 20 * Math.log10(mag[i] || 0.0001);
        const y = h/2 - (db / 18) * (h/2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw Band Handles
      bands.forEach((b, i) => {
        if (!b.enabled) return;
        const x = (Math.log10(b.frequency / minFreq) / Math.log10(maxFreq / minFreq)) * w;
        const y = h/2 - (b.gain / 18) * (h/2);
        
        ctx.beginPath();
        ctx.arc(x, y, i === selectedBand ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = i === selectedBand ? '#fff' : b.type === 'peaking' ? '#00f5ff' : '#ff4444';
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i+1}`, x, y);
      });
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => cancelAnimationFrame(animationId);
  }, [processor, bands, selectedBand]);

  const updateBand = (i: number, p: keyof EQBand, v: any) => {
    processor.setBandParam(i, p, v);
    setBands([...processor.bands]);
  };

  // Simple drag interaction for canvas
  const handleDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const w = rect.width;
    const h = rect.height;
    
    const minFreq = 20;
    const maxFreq = 20000;
    
    const freq = minFreq * Math.pow(maxFreq / minFreq, x / w);
    const db = ((h/2 - y) / (h/2)) * 18;
    
    updateBand(selectedBand, 'frequency', Math.max(20, Math.min(20000, freq)));
    updateBand(selectedBand, 'gain', Math.max(-18, Math.min(18, db)));
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-rajdhani text-[var(--text-primary)] w-[700px] bg-black/80 rounded-lg border border-white/20 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: '#ffbe0b' }}>
          <Activity size={18} /> Fruity Parametric EQ 2
        </div>
      </div>

      {/* Visualizer */}
      <canvas 
        ref={canvasRef}
        width={668}
        height={300}
        className="bg-black border border-white/10 rounded cursor-crosshair"
        onMouseDown={handleDrag}
        onMouseMove={handleDrag}
      />

      {/* Band Controls */}
      <div className="flex gap-2">
        {bands.map((b, i) => (
          <div 
            key={i} 
            className={`flex-1 p-2 border rounded flex flex-col items-center gap-2 cursor-pointer transition-colors ${selectedBand === i ? 'border-[#ffbe0b] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            onClick={() => setSelectedBand(i)}
          >
            <div className="text-xs font-bold" style={{ color: selectedBand === i ? '#ffbe0b' : 'white' }}>BAND {i+1}</div>
            <select 
              value={b.type} 
              onChange={e => updateBand(i, 'type', e.target.value)}
              className="text-[10px] bg-black border border-white/20 rounded p-1 w-full outline-none"
            >
              <option value="peaking">Peak</option>
              <option value="lowshelf">Low Shelf</option>
              <option value="highshelf">High Shelf</option>
              <option value="lowpass">Low Pass</option>
              <option value="highpass">High Pass</option>
              <option value="bandpass">Band Pass</option>
            </select>
            
            <div className="flex flex-col w-full gap-1 mt-1">
               <div className="flex justify-between text-[10px]">
                 <span>FREQ</span>
                 <span className="text-[#00f5ff]">{Math.round(b.frequency)}Hz</span>
               </div>
               <input type="range" min="20" max="20000" value={b.frequency} onChange={e => updateBand(i, 'frequency', Number(e.target.value))} />
               
               <div className="flex justify-between text-[10px]">
                 <span>GAIN</span>
                 <span className="text-[#ff4444]">{b.gain.toFixed(1)}dB</span>
               </div>
               <input type="range" min="-18" max="18" step="0.1" value={b.gain} onChange={e => updateBand(i, 'gain', Number(e.target.value))} />
               
               <div className="flex justify-between text-[10px]">
                 <span>BW/Q</span>
                 <span className="text-[#06d6a0]">{b.Q.toFixed(2)}</span>
               </div>
               <input type="range" min="0.1" max="10" step="0.1" value={b.Q} onChange={e => updateBand(i, 'Q', Number(e.target.value))} />
            </div>
            
            <button 
              className={`w-full py-1 text-[10px] rounded mt-1 font-bold ${b.enabled ? 'bg-[#ffbe0b] text-black' : 'bg-white/10'}`}
              onClick={(e) => { e.stopPropagation(); updateBand(i, 'enabled', !b.enabled); }}
            >
              {b.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
