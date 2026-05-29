'use client';

import { useEffect, useRef } from 'react';
import type { Track } from '@/src/store/types';

interface EnergyCurveProps {
  tracks: Track[];
  playingIndex: number;
  width?: number;
  height?: number;
}

/** Calculate a rough energy score 1-10 for a track */
function trackEnergy(track: Track): number {
  const bpm = track.bpm || 120;
  const normBpm = Math.max(0, Math.min(1, (bpm - 60) / 120));

  // RMS proxy: average absolute value of first 2000 waveform samples
  let rms = 0.5;
  if (track.waveformData && track.waveformData.length > 0) {
    const slice = track.waveformData.slice(0, Math.min(2000, track.waveformData.length));
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Math.abs(slice[i]);
    rms = Math.min(1, (sum / slice.length) * 3);
  }

  // Spectral centroid proxy: check average color value in waveformColors
  let centroid = 0.5;
  if (track.waveformColors && track.waveformColors.length >= 6) {
    const blueAvg = track.waveformColors.reduce((acc, v, i) => {
      return i % 3 === 2 ? acc + v : acc;
    }, 0) / (track.waveformColors.length / 3);
    centroid = Math.min(1, blueAvg / 200);
  }

  const energy = (normBpm * 0.4 + rms * 0.35 + centroid * 0.25) * 10;
  return Math.max(1, Math.min(10, Math.round(energy * 10) / 10));
}

export function EnergyCurve({ tracks, playingIndex, width = 320, height = 120 }: EnergyCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef<number>(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (tracks.length === 0) {
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#555566';
      ctx.font = '9px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No tracks in setlist', width / 2, height / 2);
      ctx.textAlign = 'left';
      return;
    }

    const energies = tracks.map(trackEnergy);

    // Background zones
    const zones = [
      { min: 0, max: 4, color: 'rgba(6,214,160,0.08)' },
      { min: 4, max: 7, color: 'rgba(255,190,11,0.08)' },
      { min: 7, max: 10, color: 'rgba(255,106,0,0.08)' },
    ];
    zones.forEach(({ min, max, color }) => {
      const y1 = height - (max / 10) * height;
      const y2 = height - (min / 10) * height;
      ctx.fillStyle = color;
      ctx.fillRect(0, y1, width, y2 - y1);
    });

    // Grid lines
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 0.5;
    for (let e = 2; e <= 8; e += 2) {
      const y = height - (e / 10) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (tracks.length < 2) return;

    const xStep = width / (tracks.length - 1);
    const points = energies.map((e, i) => ({
      x: i * xStep,
      y: height - (e / 10) * height,
    }));

    // Gradient fill under curve
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(255,106,0,0.3)');
    grad.addColorStop(0.5, 'rgba(255,190,11,0.2)');
    grad.addColorStop(1, 'rgba(6,214,160,0.1)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = cp1x;
      const cp2y = points[i].y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve line
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffbe0b66';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = cp1x;
      const cp2y = points[i].y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Points
    points.forEach((p, i) => {
      const isPlaying = i === playingIndex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isPlaying ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isPlaying ? '#00f5ff' : '#ffbe0b';
      if (isPlaying) {
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur = 12;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Energy label
      ctx.fillStyle = '#888899';
      ctx.font = '7px monospace';
      ctx.fillText(energies[i].toFixed(1), p.x + 3, p.y - 4);
    });
  }, [tracks, playingIndex, width, height]);

  // Expose energy calculator for external use
  (EnergyCurve as { computeEnergy?: (t: Track) => number }).computeEnergy = trackEnergy;

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block', borderRadius: 6 }}
    />
  );
}

export { trackEnergy };
