'use client';

import { Knob } from '@/src/components/ui/Knob';
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

export function DeckEQ({ deckId, eqHigh, eqMid, eqLow, onChangeHigh, onChangeMid, onChangeLow, knobSize = 44 }: DeckEQProps) {
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';

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
