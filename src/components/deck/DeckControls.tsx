'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { LEDButton } from '@/src/components/ui/LEDButton';
import { useIsNarrow } from '@/src/hooks/useIsNarrow';
import type { DeckId } from '@/src/store/types';

interface DeckControlsProps {
  deckId: DeckId;
  isPlaying: boolean;
  isReverse: boolean;
  isKeylock: boolean;
  isMaster: boolean;
  hasTrack: boolean;
  onPlay: () => void;
  onCue: () => void;
  onSync: () => void;
  onReverse: () => void;
  onKeylock: () => void;
}

export function DeckControls({
  deckId,
  isPlaying,
  isReverse,
  isKeylock,
  isMaster,
  hasTrack,
  onPlay,
  onCue,
  onSync,
  onReverse,
  onKeylock,
}: DeckControlsProps) {
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';
  const narrow = useIsNarrow();

  const playSize = narrow ? 48 : 52;

  return (
    <div className={narrow
      ? 'grid grid-cols-3 gap-1.5 items-center justify-items-center w-full'
      : 'flex items-center gap-2 justify-center flex-wrap'
    }>
      {/* CUE */}
      <LEDButton
        active={false}
        color={accentColor}
        onClick={onCue}
        disabled={!hasTrack}
        className="w-full"
      >
        CUE
      </LEDButton>

      {/* PLAY/PAUSE */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onPlay}
        disabled={!hasTrack}
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: playSize,
          height: playSize,
          minHeight: playSize,
          minWidth: playSize,
          backgroundColor: isPlaying ? `${accentColor}33` : '#1a1a24',
          border: `2px solid ${isPlaying ? accentColor : '#2a2a3a'}`,
          boxShadow: isPlaying ? `0 0 16px ${accentColor}66` : 'none',
          cursor: hasTrack ? 'pointer' : 'not-allowed',
          opacity: hasTrack ? 1 : 0.4,
        }}
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              <Pause size={22} color={accentColor} />
            </motion.div>
          ) : (
            <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              <Play size={22} color={accentColor} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* SYNC */}
      <LEDButton
        active={isMaster}
        color="#ffbe0b"
        onClick={onSync}
        disabled={!hasTrack}
        className="w-full"
      >
        {isMaster ? 'MST' : 'SYN'}
      </LEDButton>

      {/* REVERSE */}
      <LEDButton
        active={isReverse}
        color="#ff006e"
        onClick={onReverse}
        disabled={!hasTrack}
        size="sm"
        className="w-full"
      >
        REV
      </LEDButton>

      {/* KEYLOCK */}
      <LEDButton
        active={isKeylock}
        color="#8338ec"
        onClick={onKeylock}
        disabled={!hasTrack}
        size="sm"
        className="w-full"
      >
        KEY
      </LEDButton>
    </div>
  );
}
