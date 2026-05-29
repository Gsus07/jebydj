'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import type { EQ8Band } from '@/src/store/dawTypes';

const FREQ_RANGE = [20, 22050];
const GAIN_RANGE = [-18, 18];

function freqToX(freq: number, w: number): number {
  const logMin = Math.log10(FREQ_RANGE[0]);
  const logMax = Math.log10(FREQ_RANGE[1]);
  return ((Math.log10(freq) - logMin) / (logMax - logMin)) * w;
}

function gainToY(gain: number, h: number): number {
  return h / 2 - (gain / GAIN_RANGE[1]) * (h / 2);
}

function yToGain(y: number, h: number): number {
  return ((h / 2 - y) / (h / 2)) * GAIN_RANGE[1];
}

interface EQPluginProps {
  trackId: string;
  pluginId: string;
}

export default function EQPlugin({ trackId, pluginId }: EQPluginProps) {
  const store = useDAWStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const track = store.project.tracks.find((t) => t.id === trackId);
  const plugin = track?.plugins.find((p) => p.id === pluginId);
  const bands = (plugin?.params as { bands?: EQ8Band[] })?.bands ?? [];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0d0d16';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (const db of [-12, -6, 0, 6, 12]) {
      const y = gainToY(db, h);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (const freq of [100, 200, 500, 1000, 2000, 5000, 10000]) {
      const x = freqToX(freq, w);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // 0dB line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    const midY = gainToY(0, h);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    // EQ curve (simplified: sum of gains at each band frequency)
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = w;
    for (let i = 0; i <= steps; i++) {
      const freq = Math.pow(10, Math.log10(FREQ_RANGE[0]) + (i / steps) * (Math.log10(FREQ_RANGE[1]) - Math.log10(FREQ_RANGE[0])));
      let totalGain = 0;
      for (const band of bands) {
        if (!band.enabled) continue;
        const dist = Math.abs(Math.log2(freq / band.frequency));
        totalGain += band.gain * Math.exp(-dist * dist * 2 * band.q);
      }
      const x = i;
      const y = gainToY(Math.max(-18, Math.min(18, totalGain)), h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Band points
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const x = freqToX(band.frequency, w);
      const y = gainToY(band.gain, h);
      ctx.fillStyle = band.enabled ? '#ff006e' : '#444';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, x - 3, y);
    }
  }, [bands]);

  useEffect(() => { draw(); }, [draw]);

  if (!plugin) return null;

  return (
    <div className="flex flex-col gap-2 p-2" style={{ fontFamily: 'var(--font-rajdhani)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent-cyan)' }}>
        EQ8
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: 120, cursor: 'crosshair' }}
      />
      {/* Band frequency labels */}
      <div className="flex gap-1 flex-wrap">
        {bands.map((band, i) => (
          <div
            key={i}
            className="flex flex-col items-center text-[9px] p-1 rounded cursor-pointer"
            style={{
              background: band.enabled ? 'rgba(255,0,110,0.1)' : 'var(--bg-card)',
              border: `1px solid ${band.enabled ? '#ff006e55' : 'var(--border)'}`,
              minWidth: 44,
            }}
            onClick={() => {
              const newBands = bands.map((b, j) => j === i ? { ...b, enabled: !b.enabled } : b);
              store.updatePluginParams(trackId, pluginId, { bands: newBands });
            }}
          >
            <span style={{ color: band.enabled ? '#ff006e' : 'var(--text-muted)' }}>
              {band.frequency >= 1000 ? `${band.frequency / 1000}k` : `${band.frequency}`}
            </span>
            <span style={{ color: 'var(--text-primary)' }}>{band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}dB</span>
          </div>
        ))}
      </div>
    </div>
  );
}
