'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { DeckId } from '@/src/store/types';

interface DeckWaveformProps {
  deckId: DeckId;
  waveformData: Float32Array | null;
  waveformColors: Uint8Array | null;
  currentTime: number;
  duration: number;
  hotCues: Array<{ id: number; position: number; color: string }>;
  loopStart: number | null;
  loopEnd: number | null;
  loopActive: boolean;
  onSeek: (time: number) => void;
}

export function DeckWaveform({
  deckId,
  waveformData,
  waveformColors,
  currentTime,
  duration,
  hotCues,
  loopStart,
  loopEnd,
  loopActive,
  onSeek,
}: DeckWaveformProps) {
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const detailCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';

  // Draw overview waveform
  const drawOverview = useCallback(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    if (!waveformData || waveformData.length === 0 || duration === 0) {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, height / 2 - 0.5, width, 1);
      return;
    }

    const numPoints = waveformData.length;

    // Loop region
    if (loopActive && loopStart !== null && loopEnd !== null) {
      const lx = (loopStart / duration) * width;
      const lw = ((loopEnd - loopStart) / duration) * width;
      ctx.fillStyle = `${accentColor}22`;
      ctx.fillRect(lx, 0, lw, height);
    }

    // Draw waveform bars
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * width;
      const barWidth = width / numPoints + 0.5;
      const amplitude = waveformData[i];
      const barHeight = Math.max(1, amplitude * height * 0.9);

      if (waveformColors && waveformColors.length >= (i + 1) * 3) {
        const r = waveformColors[i * 3];
        const g = waveformColors[i * 3 + 1];
        const b = waveformColors[i * 3 + 2];
        ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      } else {
        ctx.fillStyle = accentColor;
      }

      ctx.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
    }

    // Playhead position
    const playX = (currentTime / duration) * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Hot cues
    for (const cue of hotCues) {
      const cx = (cue.position / duration) * width;
      ctx.strokeStyle = cue.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = cue.color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Triangle marker
      ctx.fillStyle = cue.color;
      ctx.beginPath();
      ctx.moveTo(cx - 4, 0);
      ctx.lineTo(cx + 4, 0);
      ctx.lineTo(cx, 6);
      ctx.fill();
    }
  }, [waveformData, waveformColors, currentTime, duration, hotCues, loopStart, loopEnd, loopActive, accentColor]);

  // Draw detail waveform (zoom x16)
  const drawDetail = useCallback(() => {
    const canvas = detailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, width, height);

    if (!waveformData || waveformData.length === 0 || duration === 0) {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, height / 2 - 0.5, width, 1);
      return;
    }

    // Zoom window: show 5 seconds centered on playhead
    const windowDuration = 5;
    const startTime = currentTime - windowDuration / 2;
    const endTime = currentTime + windowDuration / 2;
    const startFrac = startTime / duration;
    const endFrac = endTime / duration;

    const numPoints = waveformData.length;
    const startIdx = Math.max(0, Math.floor(startFrac * numPoints));
    const endIdx = Math.min(numPoints, Math.ceil(endFrac * numPoints));
    const visiblePoints = endIdx - startIdx;

    if (visiblePoints <= 0) return;

    // Loop region
    if (loopActive && loopStart !== null && loopEnd !== null) {
      const lx = ((loopStart - startTime) / windowDuration) * width;
      const lw = ((loopEnd - loopStart) / windowDuration) * width;
      ctx.fillStyle = `${accentColor}33`;
      ctx.fillRect(lx, 0, lw, height);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, 0, lw, height);
    }

    const barWidth = width / visiblePoints;
    for (let i = 0; i < visiblePoints; i++) {
      const idx = startIdx + i;
      const amplitude = waveformData[idx] ?? 0;
      const barHeight = Math.max(2, amplitude * height * 0.95);
      const x = i * barWidth;

      if (waveformColors && waveformColors.length >= (idx + 1) * 3) {
        const r = waveformColors[idx * 3];
        const g = waveformColors[idx * 3 + 1];
        const b = waveformColors[idx * 3 + 2];
        ctx.fillStyle = `rgba(${r},${g},${b},1)`;
      } else {
        ctx.fillStyle = accentColor;
      }

      ctx.fillRect(x, (height - barHeight) / 2, barWidth - 0.5, barHeight);
    }

    // Playhead (center)
    const playX = width / 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Hot cues in view
    for (const cue of hotCues) {
      const cueX = ((cue.position - startTime) / windowDuration) * width;
      if (cueX < 0 || cueX > width) continue;
      ctx.strokeStyle = cue.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = cue.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(cueX, 0);
      ctx.lineTo(cueX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Center line grid
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 0.5;
    for (let beat = -2; beat <= 2; beat++) {
      if (beat === 0) continue;
      const beatX = playX + (beat / windowDuration) * width;
      ctx.beginPath();
      ctx.moveTo(beatX, 0);
      ctx.lineTo(beatX, height);
      ctx.stroke();
    }
  }, [waveformData, waveformColors, currentTime, duration, hotCues, loopStart, loopEnd, loopActive, accentColor]);

  useEffect(() => {
    const animate = () => {
      drawOverview();
      drawDetail();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawOverview, drawDetail]);

  const handleOverviewClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / rect.width;
    onSeek(fraction * duration);
  }, [duration, onSeek]);

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Overview waveform */}
      <canvas
        ref={overviewCanvasRef}
        width={520}
        height={50}
        className="w-full h-12 rounded cursor-pointer"
        style={{ border: '1px solid #2a2a3a', imageRendering: 'pixelated' }}
        onClick={handleOverviewClick}
      />
      {/* Detail waveform */}
      <canvas
        ref={detailCanvasRef}
        width={520}
        height={80}
        className="w-full h-20 rounded"
        style={{ border: `1px solid ${accentColor}44` }}
      />
    </div>
  );
}
