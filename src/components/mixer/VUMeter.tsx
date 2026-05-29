'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { DeckId } from '@/src/store/types';

interface VUMeterProps {
  deckId: DeckId;
  getLevel: () => number; // returns 0-1
  width?: number;
  height?: number;
  vertical?: boolean;
}

export function VUMeter({ deckId, getLevel, width = 16, height = 120, vertical = true }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const peakRef = useRef(0);
  const peakHoldRef = useRef(0);
  const levelRef = useRef(0);

  const NUM_SEGMENTS = 20;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rawLevel = getLevel();
    // Attack: fast, Release: slow
    if (rawLevel > levelRef.current) {
      levelRef.current = levelRef.current + (rawLevel - levelRef.current) * 0.3;
    } else {
      levelRef.current = levelRef.current + (rawLevel - levelRef.current) * 0.05;
    }

    // Peak hold
    if (levelRef.current > peakRef.current) {
      peakRef.current = levelRef.current;
      peakHoldRef.current = 180; // frames to hold (3s at 60fps)
    }
    if (peakHoldRef.current > 0) {
      peakHoldRef.current--;
    } else {
      peakRef.current = Math.max(0, peakRef.current - 0.005);
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    const activeSegments = Math.round(levelRef.current * NUM_SEGMENTS);
    const peakSegment = Math.round(peakRef.current * NUM_SEGMENTS);

    if (vertical) {
      const segHeight = (h - NUM_SEGMENTS + 1) / NUM_SEGMENTS;
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const segIndex = NUM_SEGMENTS - 1 - i; // bottom to top
        const y = i * (segHeight + 1);
        const isActive = segIndex < activeSegments;
        const isPeak = segIndex === peakSegment && peakHoldRef.current > 0;

        let color: string;
        if (segIndex >= 18) color = isActive || isPeak ? '#ff1111' : '#330000';
        else if (segIndex >= 13) color = isActive || isPeak ? '#ffcc00' : '#333300';
        else color = isActive || isPeak ? '#00cc44' : '#003311';

        ctx.fillStyle = color;
        ctx.fillRect(2, y, w - 4, segHeight);

        // Glow on active segments
        if (isActive || isPeak) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 3;
          ctx.fillRect(2, y, w - 4, segHeight);
          ctx.shadowBlur = 0;
        }
      }
    } else {
      const segWidth = (w - NUM_SEGMENTS + 1) / NUM_SEGMENTS;
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const x = i * (segWidth + 1);
        const isActive = i < activeSegments;
        const isPeak = i === peakSegment && peakHoldRef.current > 0;

        let color: string;
        if (i >= 18) color = isActive || isPeak ? '#ff1111' : '#330000';
        else if (i >= 13) color = isActive || isPeak ? '#ffcc00' : '#333300';
        else color = isActive || isPeak ? '#00cc44' : '#003311';

        ctx.fillStyle = color;
        ctx.fillRect(x, 2, segWidth, height - 4);
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [getLevel, vertical, height]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
