'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import type { DAWClip, DAWTrack } from '@/src/store/dawTypes';

interface MIDIClipProps {
  clip: DAWClip;
  track: DAWTrack;
  x: number;
  width: number;
  height: number;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, side: 'left' | 'right') => void;
}

export default function MIDIClip({
  clip, track, x, width, height, isSelected, isDragging,
  onMouseDown, onDoubleClick, onContextMenu, onResizeStart,
}: MIDIClipProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(4, width);
    const h = height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = isSelected ? `${track.color}55` : `${track.color}22`;
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = isSelected ? track.color : `${track.color}88`;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Top bar (dashed for MIDI)
    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = track.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(w, 1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Mini piano roll preview
    if (clip.notes.length > 0) {
      const noteAreaTop = 6;
      const noteAreaH = h - 10;
      const allPitches = clip.notes.map((n) => n.pitch);
      const minPitch = Math.min(...allPitches);
      const maxPitch = Math.max(...allPitches);
      const pitchRange = Math.max(12, maxPitch - minPitch + 1);
      const totalBeats = clip.durationBeats;
      for (const note of clip.notes) {
        const nx = (note.startBeat / totalBeats) * w;
        const nw = Math.max(2, (note.durationBeats / totalBeats) * w - 1);
        const nh = Math.max(2, noteAreaH / pitchRange);
        const ny = noteAreaTop + ((maxPitch - note.pitch) / pitchRange) * noteAreaH;
        ctx.fillStyle = track.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(nx, ny, nw, nh);
        ctx.globalAlpha = 1;
      }
    }

    // Clip name
    if (w > 30) {
      ctx.font = `bold 10px var(--font-rajdhani, sans-serif)`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(clip.name, 6, 14);
    }
  }, [clip, track, width, height, isSelected]);

  useEffect(() => { draw(); }, [draw]);

  const handleResizeLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(e, 'left');
  };

  const handleResizeRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(e, 'right');
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        position: 'absolute',
        top: 0,
        left: x,
        width: Math.max(4, width),
        height,
        opacity: isDragging ? 0.35 : 1,
        cursor: 'grab',
        userSelect: 'none',
        borderRadius: 2,
        outline: isDragging ? `2px dashed ${track.color}` : 'none',
        outlineOffset: '-1px',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'none' }} />

      {/* Left resize handle */}
      <div
        data-handle="resize-left"
        onMouseDown={handleResizeLeft}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 6,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 10,
        }}
      />

      {/* Right resize handle */}
      <div
        data-handle="resize-right"
        onMouseDown={handleResizeRight}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 6,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 10,
        }}
      />
    </div>
  );
}
