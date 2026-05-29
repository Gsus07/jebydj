'use client';

import { useRef, useEffect, useCallback } from 'react';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import type { DeckId } from '@/src/store/types';

interface OscilloscopeProps {
  deckId: DeckId;
  width?: number;
  height?: number;
}

export function Oscilloscope({ deckId, width = 200, height = 80 }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1a1a24';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const player = getDeckPlayer(deckId);
    const data = player.getTimeDomainData();

    if (data.length === 0) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    // Draw waveform
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 3;
    ctx.beginPath();

    const sliceWidth = w / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = (data[i] / 128.0) - 1;
      const y = (v * h * 0.45) + h / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    animFrameRef.current = requestAnimationFrame(draw);
  }, [deckId, accentColor]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] font-rajdhani text-muted uppercase">SCOPE {deckId}</span>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded"
        style={{ border: `1px solid ${accentColor}33` }}
      />
    </div>
  );
}
