'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { HotCue, DeckId } from '@/src/store/types';

const HOT_CUE_COLORS = [
  '#ff006e', '#00f5ff', '#ffbe0b', '#8338ec',
  '#fb5607', '#3a86ff', '#06d6a0', '#ef476f',
];

interface DeckHotcuesProps {
  deckId: DeckId;
  hotCues: HotCue[];
  onActivateCue: (id: number) => void;
  onSetCue: (id: number) => void;
  onDeleteCue: (id: number) => void;
}

export function DeckHotcues({ deckId, hotCues, onActivateCue, onSetCue, onDeleteCue }: DeckHotcuesProps) {
  const getCue = (id: number) => hotCues.find((c) => c.id === id);

  return (
    <div className="grid grid-cols-4 gap-1.5 p-2 rounded bg-card border border-[#2a2a3a]">
      {Array.from({ length: 8 }, (_, i) => {
        const cue = getCue(i);
        const color = HOT_CUE_COLORS[i];

        return (
          <motion.button
            key={i}
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              if (cue) onActivateCue(i);
              else onSetCue(i);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (cue) onDeleteCue(i);
            }}
            className="relative flex flex-col items-center justify-center rounded"
            style={{
              minHeight: 40,
              backgroundColor: cue ? `${color}33` : '#111118',
              border: `1.5px solid ${cue ? color : '#2a2a3a'}`,
              boxShadow: cue ? `0 0 8px ${color}44` : 'none',
              cursor: 'pointer',
            }}
          >
            <span
              className="text-[10px] font-orbitron font-bold"
              style={{ color: cue ? color : '#555566' }}
            >
              {i + 1}
            </span>
            {cue && (
              <span className="text-[8px] font-rajdhani" style={{ color: `${color}99` }}>
                {formatCueTime(cue.position)}
              </span>
            )}

            {/* Active indicator */}
            {cue && (
              <div
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function formatCueTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
