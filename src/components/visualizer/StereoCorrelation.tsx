'use client';

import { useRef, useEffect, useCallback } from 'react';
import { audioEngine } from '@/src/lib/audio/AudioEngine';

interface StereoCorrelationProps {
  size?: number;
}

export function StereoCorrelation({ size = 100 }: StereoCorrelationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const historyRef = useRef<Array<[number, number]>>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1a1a24';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    // Diagonal lines
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.moveTo(0, 0); ctx.lineTo(w, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#333344';
    ctx.font = '7px monospace';
    ctx.fillText('L', 2, cy - 2);
    ctx.fillText('R', w - 8, cy - 2);
    ctx.fillText('+', cx + 2, 8);
    ctx.fillText('-', cx + 2, h - 2);

    if (!audioEngine.isInitialized()) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const masterData = new Uint8Array(audioEngine.masterAnalyser.fftSize);
    audioEngine.masterAnalyser.getByteTimeDomainData(masterData);

    // Lissajous: use odd samples as L, even as R
    const N = Math.min(256, masterData.length);
    historyRef.current = [];

    for (let i = 0; i < N - 1; i += 2) {
      const l = (masterData[i] / 128.0) - 1;
      const r = (masterData[i + 1] / 128.0) - 1;
      historyRef.current.push([l, r]);
    }

    // Draw Lissajous pattern
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 2;
    ctx.beginPath();

    let first = true;
    for (const [l, r] of historyRef.current) {
      // Rotate 45 degrees for stereo scope visualization
      const x = cx + (l - r) * cx * 0.8;
      const y = cy - (l + r) * cy * 0.8;

      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] font-rajdhani text-muted uppercase">LISSAJOUS</span>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded"
        style={{ border: '1px solid #2a2a3a' }}
      />
    </div>
  );
}
