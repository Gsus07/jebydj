'use client';

import { LEDButton } from '@/src/components/ui/LEDButton';
import type { DeckId, LoopState } from '@/src/store/types';
import { beatSizes, beatSizeLabel } from '@/src/lib/utils/bpmUtils';

interface DeckLoopProps {
  deckId: DeckId;
  loop: LoopState;
  onSetIn: () => void;
  onSetOut: () => void;
  onToggleActive: () => void;
  onSetSize: (size: number) => void;
  onHalve: () => void;
  onDouble: () => void;
}

export function DeckLoop({
  deckId,
  loop,
  onSetIn,
  onSetOut,
  onToggleActive,
  onSetSize,
  onHalve,
  onDouble,
}: DeckLoopProps) {
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';
  const sizes = beatSizes();

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded bg-card border border-[#2a2a3a]">
      {/* Loop in/out/active */}
      <div className="flex gap-1.5">
        <LEDButton
          active={loop.inPoint !== null}
          color={accentColor}
          onClick={onSetIn}
          size="sm"
          className="flex-1"
        >
          IN
        </LEDButton>
        <LEDButton
          active={loop.active}
          color={accentColor}
          onClick={onToggleActive}
          size="sm"
          className="flex-1"
        >
          LOOP
        </LEDButton>
        <LEDButton
          active={loop.outPoint !== null}
          color={accentColor}
          onClick={onSetOut}
          size="sm"
          className="flex-1"
        >
          OUT
        </LEDButton>
      </div>

      {/* Loop size quick buttons */}
      <div className="grid grid-cols-4 gap-1">
        {sizes.map((size) => (
          <button
            key={size}
            onClick={() => onSetSize(size)}
            className="text-[9px] font-rajdhani rounded px-1 py-0.5 border text-center"
            style={{
              borderColor: loop.size === size ? accentColor : '#2a2a3a',
              color: loop.size === size ? accentColor : '#555566',
              backgroundColor: loop.size === size ? `${accentColor}22` : 'transparent',
            }}
          >
            {beatSizeLabel(size)}
          </button>
        ))}
      </div>

      {/* Halve / Double */}
      <div className="flex gap-1">
        <button
          onClick={onHalve}
          className="flex-1 text-[9px] font-rajdhani border border-[#2a2a3a] rounded py-0.5 text-muted hover:text-white hover:border-current"
        >
          ÷2
        </button>
        <button
          onClick={onDouble}
          className="flex-1 text-[9px] font-rajdhani border border-[#2a2a3a] rounded py-0.5 text-muted hover:text-white hover:border-current"
        >
          ×2
        </button>
      </div>
    </div>
  );
}
