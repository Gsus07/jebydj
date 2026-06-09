'use client';

import React from 'react';

export interface PatcherCableProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  active?: boolean;
}

export function PatcherCable({ startX, startY, endX, endY, active = false }: PatcherCableProps) {
  // Cubic bezier for a nice hanging cable effect
  const dx = Math.abs(endX - startX);
  const controlPointOffset = Math.max(50, dx * 0.5);

  const path = `M ${startX} ${startY} C ${startX} ${startY + controlPointOffset}, ${endX} ${endY - controlPointOffset}, ${endX} ${endY}`;

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', zIndex: 1 }}>
      {/* Shadow/Glow */}
      <path 
        d={path} 
        fill="none" 
        stroke={active ? '#00f5ff' : 'rgba(0,0,0,0.5)'} 
        strokeWidth={active ? 6 : 8} 
        strokeLinecap="round" 
        style={{ filter: active ? 'blur(4px)' : 'none', transition: 'stroke 0.2s' }}
      />
      {/* Core */}
      <path 
        d={path} 
        fill="none" 
        stroke={active ? '#ffffff' : '#555'} 
        strokeWidth={3} 
        strokeLinecap="round" 
      />
    </svg>
  );
}
