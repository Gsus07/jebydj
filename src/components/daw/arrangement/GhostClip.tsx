'use client';

import React from 'react';

interface GhostClipProps {
  x: number;           // px from left of tracks container (includes HEADER_WIDTH)
  y: number;           // px from top of tracks content div
  width: number;
  height: number;
  color: string;
  name: string;
  hasCollision: boolean;
  typeMismatch: boolean;
  altCopy: boolean;
  beat: number;        // destination beat for display
}

export default function GhostClip({
  x, y, width, height, color, name, hasCollision, typeMismatch, altCopy, beat,
}: GhostClipProps) {
  const invalid = hasCollision || typeMismatch;
  const borderColor = invalid ? '#ff4444' : altCopy ? '#ffbe0b' : color;
  const bgColor = invalid ? 'rgba(255,68,68,0.22)' : altCopy ? 'rgba(255,190,11,0.18)' : `${color}40`;

  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = Math.floor(beat % 4) + 1;
  const posLabel = `Bar ${bar}, Beat ${beatInBar}`;

  const statusText = hasCollision
    ? '⛔ Posición ocupada'
    : typeMismatch
    ? '⛔ Tipo incompatible'
    : altCopy
    ? `${name} (copia) — ${posLabel}`
    : posLabel;

  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.max(4, Math.round(width)),
        height,
        backgroundColor: bgColor,
        border: `2px dashed ${borderColor}`,
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 6,
        gap: 4,
        fontSize: 11,
        color: borderColor,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        userSelect: 'none',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
        {altCopy ? `${name} (copia)` : name}
      </span>
      <span style={{ marginLeft: 'auto', marginRight: 6, fontSize: 9, opacity: 0.8, flexShrink: 0 }}>
        {statusText}
      </span>
    </div>
  );
}
