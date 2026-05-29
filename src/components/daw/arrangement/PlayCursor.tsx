'use client';

import React, { memo } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';

interface PlayCursorProps {
  scrollX: number;
  zoom: number;
  height: number;
}

export const PlayCursor = memo(function PlayCursor({ scrollX, zoom, height }: PlayCursorProps) {
  const positionBeats = useDAWStore((s) => s.positionBeats);
  const x = positionBeats * zoom - scrollX;

  if (x < 0 || x > 4000) return null;

  return (
    <div
      className="absolute top-0 pointer-events-none z-20"
      style={{
        left: x,
        width: 1,
        height,
        background: 'var(--accent-cyan)',
        boxShadow: '0 0 4px var(--accent-cyan)',
      }}
    >
      {/* Playhead arrow */}
      <div
        className="absolute -top-1 -left-[5px]"
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '8px solid var(--accent-cyan)',
        }}
      />
    </div>
  );
});
