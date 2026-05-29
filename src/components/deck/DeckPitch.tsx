'use client';

import { useCallback } from 'react';
import { DisplayNumber } from '@/src/components/ui/DisplayNumber';
import type { DeckId } from '@/src/store/types';

interface DeckPitchProps {
  deckId: DeckId;
  tempo: number; // 1.0 = 100%
  bpm: number;
  detectedBpm: number;
  tempoRange: 8 | 16 | 100;
  onTempoChange: (tempo: number) => void;
  onTempoRangeChange: (range: 8 | 16 | 100) => void;
  onNudgeForward: () => void;
  onNudgeBack: () => void;
  /** Compact horizontal mode for mobile */
  compact?: boolean;
}

export function DeckPitch({
  deckId,
  tempo,
  bpm,
  detectedBpm,
  tempoRange,
  onTempoChange,
  onTempoRangeChange,
  onNudgeForward,
  onNudgeBack,
  compact = false,
}: DeckPitchProps) {
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';
  const percentChange = ((tempo - 1) * 100).toFixed(1);
  const sign = tempo >= 1 ? '+' : '';
  const currentBpm = detectedBpm > 0 ? (detectedBpm * tempo).toFixed(1) : bpm.toFixed(1);

  const rangeMin = 1 - tempoRange / 100;
  const rangeMax = 1 + tempoRange / 100;
  const sliderValue = (tempo - rangeMin) / (rangeMax - rangeMin);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 1000;
    onTempoChange(rangeMin + v * (rangeMax - rangeMin));
  }, [rangeMin, rangeMax, onTempoChange]);

  const handleReset = useCallback(() => onTempoChange(1.0), [onTempoChange]);

  // ── Compact (mobile horizontal) ──────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 p-2 rounded bg-card border border-[#2a2a3a] w-full">
        {/* Top row: BPM + pitch% + reset */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-orbitron" style={{ color: accentColor }}>
            {currentBpm} <span className="text-[7px] opacity-60">BPM</span>
          </span>
          <span className="text-[9px] font-orbitron" style={{ color: tempo === 1 ? '#555566' : accentColor }}>
            {sign}{percentChange}%
          </span>
          <button
            onClick={handleReset}
            className="ml-auto text-[8px] font-rajdhani text-muted hover:text-white border border-[#2a2a3a] rounded px-1.5 py-0.5 uppercase"
          >
            RESET
          </button>
        </div>

        {/* Horizontal slider */}
        <div className="flex items-center gap-1">
          <button onClick={onNudgeBack} className="text-[10px] text-muted border border-[#2a2a3a] rounded px-1.5 py-0.5 shrink-0">◄</button>
          <input
            type="range"
            min="0"
            max="1000"
            value={Math.round(sliderValue * 1000)}
            onChange={handleSliderChange}
            className="flex-1 h-1 cursor-pointer"
            style={{ accentColor }}
          />
          <button onClick={onNudgeForward} className="text-[10px] text-muted border border-[#2a2a3a] rounded px-1.5 py-0.5 shrink-0">►</button>
        </div>

        {/* Range buttons */}
        <div className="flex gap-1">
          {([8, 16, 100] as const).map((r) => (
            <button
              key={r}
              onClick={() => onTempoRangeChange(r)}
              className="flex-1 text-[8px] font-rajdhani rounded px-1 py-0.5 border"
              style={{
                borderColor: tempoRange === r ? accentColor : '#2a2a3a',
                color: tempoRange === r ? accentColor : '#555566',
                backgroundColor: tempoRange === r ? `${accentColor}22` : 'transparent',
              }}
            >
              ±{r}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Desktop vertical ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-2 p-2 rounded bg-card border border-[#2a2a3a] min-w-[80px]">
      <DisplayNumber value={currentBpm} label="BPM" color={accentColor} size="md" />
      <DisplayNumber value={`${sign}${percentChange}%`} label="PITCH" color={tempo === 1 ? '#555566' : accentColor} size="sm" />

      {/* Vertical pitch slider */}
      <div className="relative flex flex-col items-center" style={{ height: 120 }}>
        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round(sliderValue * 1000)}
          onChange={handleSliderChange}
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            WebkitAppearance: 'slider-vertical',
            width: 24,
            height: 110,
            cursor: 'pointer',
            accentColor,
          }}
        />
        <div className="absolute left-1/2 -translate-x-1/2 w-8 h-0.5 pointer-events-none" style={{ top: '50%', backgroundColor: '#2a2a3a' }} />
      </div>

      <button onClick={handleReset} className="text-[9px] font-rajdhani text-muted hover:text-white border border-[#2a2a3a] rounded px-2 py-0.5 uppercase">
        RESET
      </button>

      <div className="flex gap-1">
        {([8, 16, 100] as const).map((r) => (
          <button
            key={r}
            onClick={() => onTempoRangeChange(r)}
            className="text-[9px] font-rajdhani rounded px-1.5 py-0.5 border"
            style={{
              borderColor: tempoRange === r ? accentColor : '#2a2a3a',
              color: tempoRange === r ? accentColor : '#555566',
              backgroundColor: tempoRange === r ? `${accentColor}22` : 'transparent',
            }}
          >
            ±{r}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        <button onClick={onNudgeBack} className="text-[10px] font-rajdhani text-muted hover:text-white border border-[#2a2a3a] rounded px-2 py-0.5">◄</button>
        <button onClick={onNudgeForward} className="text-[10px] font-rajdhani text-muted hover:text-white border border-[#2a2a3a] rounded px-2 py-0.5">►</button>
      </div>
    </div>
  );
}
