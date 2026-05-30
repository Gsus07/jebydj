'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface CrossFaderProps {
  position: number; // -1 to +1
  onChange: (position: number) => void;
  curve: 'linear' | 'cut' | 'power';
  onCurveChange: (curve: 'linear' | 'cut' | 'power') => void;
}

export function CrossFader({ position, onChange, curve, onCurveChange }: CrossFaderProps) {
  const sliderRef = useRef<HTMLInputElement>(null);

  const sliderValue = ((position + 1) / 2) * 1000;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 1000;
    onChange(v * 2 - 1);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-2 px-3 py-2 rounded bg-card border border-[#2a2a3a]">
      {/* Labels */}
      <div className="flex justify-between text-[9px] font-orbitron text-muted">
        <span style={{ color: '#00f5ff' }}>A</span>
        <span className="text-[8px] uppercase font-rajdhani">CROSSFADER</span>
        <span style={{ color: '#ff006e' }}>B</span>
      </div>

      {/* Fader */}
      <div className="relative flex items-center" style={{ minHeight: 44 }}>
        <div className="absolute left-0 right-0 h-1 rounded" style={{ backgroundColor: '#1a1a24' }} />
        <div
          className="absolute h-1 rounded"
          style={{
            left: '50%',
            right: `${100 - ((position + 1) / 2) * 100}%`,
            backgroundColor: position > 0 ? '#ff006e' : '#00f5ff',
            ...(position < 0 ? { left: `${((position + 1) / 2) * 100}%`, right: '50%' } : {}),
          }}
        />
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max="1000"
          value={Math.round(sliderValue)}
          onChange={handleChange}
          className="w-full relative z-10"
          style={{ accentColor: position > 0 ? '#ff006e' : '#00f5ff', minHeight: 44 }}
        />
      </div>

      {/* Curve selector */}
      <div className="flex gap-1 justify-center">
        {(['linear', 'cut', 'power'] as const).map((c) => (
          <button
            key={c}
            onClick={() => onCurveChange(c)}
            className="text-[8px] font-rajdhani px-2 py-0.5 rounded border uppercase"
            style={{
              borderColor: curve === c ? '#ffbe0b' : '#2a2a3a',
              color: curve === c ? '#ffbe0b' : '#555566',
              backgroundColor: curve === c ? '#ffbe0b22' : 'transparent',
            }}
          >
            {c === 'cut' ? 'SCRATCH' : c}
          </button>
        ))}
      </div>
    </div>
  );
}
