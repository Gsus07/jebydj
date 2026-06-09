'use client';

import React from 'react';

export interface PatcherNodeProps {
  id: string;
  name: string;
  type: 'generator' | 'effect' | 'output';
  x: number;
  y: number;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onConnectStart: (id: string, port: 'in'|'out', e: React.MouseEvent) => void;
}

export function PatcherNode({ id, name, type, x, y, onDragStart, onConnectStart }: PatcherNodeProps) {
  const color = type === 'generator' ? '#00f5ff' : type === 'effect' ? '#ffbe0b' : '#ff006e';
  
  return (
    <div 
      className="absolute flex flex-col items-center select-none"
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: 10 }}
    >
      {/* IN Port */}
      {type !== 'generator' && (
        <div 
          className="w-3 h-3 rounded-full bg-white/20 border-2 border-black cursor-crosshair hover:bg-white transition-colors mb-1"
          onMouseDown={e => { e.stopPropagation(); onConnectStart(id, 'in', e); }}
        />
      )}

      {/* Node Body */}
      <div 
        className="px-4 py-2 rounded-lg border shadow-xl cursor-grab active:cursor-grabbing font-rajdhani font-bold text-xs uppercase tracking-widest bg-black/80 backdrop-blur"
        style={{ borderColor: color, color: color, minWidth: '100px', textAlign: 'center' }}
        onMouseDown={e => onDragStart(id, e)}
      >
        {name}
      </div>

      {/* OUT Port */}
      {type !== 'output' && (
        <div 
          className="w-3 h-3 rounded-full bg-white/20 border-2 border-black cursor-crosshair hover:bg-white transition-colors mt-1"
          onMouseDown={e => { e.stopPropagation(); onConnectStart(id, 'out', e); }}
        />
      )}
    </div>
  );
}
