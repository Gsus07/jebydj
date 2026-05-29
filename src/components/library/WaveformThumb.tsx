'use client';

import React, { useEffect, useRef } from 'react';

interface Props {
  waveformData: number[]; // 200 normalized peaks
  progress?: number;      // 0–1 playback cursor
  color?: string;
  width?: number;
  height?: number;
}

export function WaveformThumb({ waveformData, progress = 0, color = '#00f5ff', width = 80, height = 24 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const mid = height / 2;
    const data = waveformData;
    if (!data || data.length === 0) {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, mid - 1, width, 2);
      return;
    }

    const step = width / data.length;
    const playedX = progress * width;

    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const amp = (data[i] ?? 0) * mid * 0.9;
      ctx.fillStyle = x < playedX ? color : 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, mid - amp, Math.max(1, step - 0.5), amp * 2);
    }
  }, [waveformData, progress, color, width, height]);

  return <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 2 }} />;
}
