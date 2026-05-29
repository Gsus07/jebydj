'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import { formatPosition, beatsToSeconds } from '@/src/lib/daw/TimeSignature';

interface TimeRulerProps {
  width: number;
  height?: number;
}

export default function TimeRuler({ width, height = 32 }: TimeRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useDAWStore((s) => s.zoom);
  const scrollX = useDAWStore((s) => s.scrollX);
  const project = useDAWStore((s) => s.project);
  const positionBeats = useDAWStore((s) => s.positionBeats);
  const setPositionBeats = useDAWStore((s) => s.setPositionBeats);
  const setLoopRegion = useDAWStore((s) => s.setLoopRegion);

  const { bpm, timeSignatureNum, loopStart, loopEnd, loopEnabled } = project;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = width;
    const h = height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#111118';
    ctx.fillRect(0, 0, w, h);

    // Loop region highlight
    if (loopEnabled) {
      const lx1 = loopStart * zoom - scrollX;
      const lx2 = loopEnd * zoom - scrollX;
      ctx.fillStyle = 'rgba(0,245,255,0.08)';
      ctx.fillRect(Math.max(0, lx1), 0, Math.min(w, lx2) - Math.max(0, lx1), h);
      ctx.fillStyle = 'rgba(0,245,255,0.5)';
      if (lx1 >= 0 && lx1 < w) ctx.fillRect(lx1, 0, 1, h);
      if (lx2 >= 0 && lx2 < w) ctx.fillRect(lx2, 0, 1, h);
    }

    // Choose subdivision based on zoom
    let labelEvery: number; // beats
    let tickEvery: number;
    if (zoom >= 120) {
      labelEvery = 1;
      tickEvery = 0.25;
    } else if (zoom >= 40) {
      labelEvery = timeSignatureNum;
      tickEvery = 1;
    } else if (zoom >= 15) {
      labelEvery = timeSignatureNum * 2;
      tickEvery = timeSignatureNum;
    } else {
      labelEvery = timeSignatureNum * 4;
      tickEvery = timeSignatureNum * 2;
    }

    const firstBeat = Math.floor(scrollX / zoom);
    const lastBeat = Math.ceil((scrollX + w) / zoom);

    ctx.font = '10px var(--font-rajdhani, sans-serif)';
    ctx.textBaseline = 'top';

    for (let beat = firstBeat; beat <= lastBeat; beat += tickEvery) {
      const x = beat * zoom - scrollX;
      if (x < -10 || x > w + 10) continue;

      const isLabel = beat % labelEvery < 0.001;
      const isBeat = beat % 1 < 0.001;

      // Tick mark
      const tickH = isLabel ? h * 0.7 : isBeat ? h * 0.4 : h * 0.2;
      ctx.strokeStyle = isLabel ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = isLabel ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, h - tickH);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Label
      if (isLabel) {
        const pos = formatPosition(beat, timeSignatureNum);
        const barLabel = pos.split(' : ')[0].replace(/^0+/, '') || '1';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(barLabel, x + 2, 2);
      }
    }

    // Bottom border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();
  }, [width, height, zoom, scrollX, bpm, timeSignatureNum, loopStart, loopEnd, loopEnabled]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = (x + scrollX) / zoom;
    setPositionBeats(Math.max(0, beat));
  }, [scrollX, zoom, setPositionBeats]);

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: 'pointer', display: 'block', flexShrink: 0 }}
      onClick={handleClick}
      title="Click to seek"
    />
  );
}
