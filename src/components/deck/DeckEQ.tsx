'use client';

import { Knob } from '@/src/components/ui/Knob';
import { useIsNarrow } from '@/src/hooks/useIsNarrow';
import type { DeckId } from '@/src/store/types';

interface DeckEQProps {
  deckId: DeckId;
  eqHigh: number; // -1 to +1
  eqMid: number;
  eqLow: number;
  onChangeHigh: (v: number) => void;
  onChangeMid: (v: number) => void;
  onChangeLow: (v: number) => void;
  /** Knob diameter; defaults to 44 */
  knobSize?: number;
}

// Map -1..+1 → 0..1 for Knob component
const toKnob = (v: number) => (v + 1) / 2;
const fromKnob = (v: number) => v * 2 - 1;

interface EQSliderBandProps {
  label: string;
  value: number; // -1..+1
  onChange: (v: number) => void;
  color: string;
}

function EQSliderBand({ label, value, onChange, color }: EQSliderBandProps) {
  const knobVal = toKnob(value);
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
      <span className="text-[8px] font-rajdhani uppercase" style={{ color }}>{label}</span>
      <input
        type="range"
        min="0"
        max="1000"
        value={Math.round(knobVal * 1000)}
        onChange={(e) => onChange(fromKnob(Number(e.target.value) / 1000))}
        className="w-full"
        style={{ accentColor: color, minHeight: 36 }}
      />
      <span className="text-[8px] font-orbitron" style={{ color: '#555566' }}>
        {value >= 0 ? '+' : ''}{(value * 12).toFixed(1)}
      </span>
    </div>
  );
}

export function DeckEQ({ deckId, eqHigh, eqMid, eqLow, onChangeHigh, onChangeMid, onChangeLow, knobSize = 44 }: DeckEQProps) {
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';
  const narrow = useIsNarrow();

  if (narrow) {
    return (
      <div className="flex flex-col gap-1 p-2 rounded bg-card border border-[#2a2a3a] flex-1 min-w-0">
        <EQSliderBand label="HIGH" value={eqHigh} onChange={onChangeHigh} color={accentColor} />
        <EQSliderBand label="MID" value={eqMid} onChange={onChangeMid} color="#8338ec" />
        <EQSliderBand label="LOW" value={eqLow} onChange={onChangeLow} color="#ff8800" />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 justify-center p-2 rounded bg-card border border-[#2a2a3a] flex-1 min-w-0">
      <Knob
        value={toKnob(eqHigh)}
        onChange={(v) => onChangeHigh(fromKnob(v))}
        size={knobSize}
        label="HIGH"
        color={accentColor}
      />
      <Knob
        value={toKnob(eqMid)}
        onChange={(v) => onChangeMid(fromKnob(v))}
        size={knobSize}
        label="MID"
        color="#8338ec"
      />
      <Knob
        value={toKnob(eqLow)}
        onChange={(v) => onChangeLow(fromKnob(v))}
        size={knobSize}
        label="LOW"
        color="#ff8800"
      />
    </div>
  );
}

