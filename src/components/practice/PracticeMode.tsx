'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useDJStore } from '@/src/store/useDJStore';

/** Circular gauge canvas */
function GaugeCanvas({ value, label, color, size = 80 }: {
  value: number;
  label: string;
  color: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;

    ctx.clearRect(0, 0, size, size);

    // BG arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Value arc
    const progress = endAngle - startAngle;
    const valueAngle = startAngle + progress * Math.max(0, Math.min(1, value / 100));
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valueAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Value text
    ctx.fillStyle = '#e8e8f0';
    ctx.font = `bold ${size * 0.22}px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(value).toString(), cx, cy - 2);

    // Label
    ctx.fillStyle = '#555566';
    ctx.font = `${size * 0.1}px Rajdhani, sans-serif`;
    ctx.fillText(label.toUpperCase(), cx, cy + size * 0.25);
  }, [value, color, size, label]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

/** Mini line chart for sync score history */
function SyncChart({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 240, H = 40;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,245,255,0.25)');
    grad.addColorStop(1, 'transparent');

    const slice = data.slice(-60);
    const xStep = W / (slice.length - 1);

    ctx.beginPath();
    ctx.moveTo(0, H);
    slice.forEach((v, i) => {
      ctx.lineTo(i * xStep, H - (v / 100) * H);
    });
    ctx.lineTo((slice.length - 1) * xStep, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    slice.forEach((v, i) => {
      const y = H - (v / 100) * H;
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * xStep, y);
    });
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} style={{ width: 240, height: 40, display: 'block' }} />;
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

const GRADE_COLORS: Record<string, string> = {
  A: '#06d6a0',
  B: '#00f5ff',
  C: '#ffbe0b',
  D: '#ff6a00',
  F: '#ff006e',
};

export function PracticeMode() {
  const practiceMode = useDJStore((s) => s.practiceMode);
  const deckA = useDJStore((s) => s.decks.A);
  const deckB = useDJStore((s) => s.decks.B);
  const beatgridA = useDJStore((s) => s.beatgrids.A);
  const beatgridB = useDJStore((s) => s.beatgrids.B);
  const { setPracticeActive, updatePracticeScores, addSyncHistoryPoint } = useDJStore.getState();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute practice metrics every 500ms when active
  useEffect(() => {
    if (!practiceMode.active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const bothPlaying = deckA.isPlaying && deckB.isPlaying;

      // Sync score: phase difference between nearest beats
      let syncScore = 100;
      if (bothPlaying && beatgridA.beats.length > 0 && beatgridB.beats.length > 0) {
        const tA = deckA.currentTime;
        const tB = deckB.currentTime;

        const nearestA = beatgridA.beats.reduce((prev, b) => Math.abs(b - tA) < Math.abs(prev - tA) ? b : prev, beatgridA.beats[0]);
        const nearestB = beatgridB.beats.reduce((prev, b) => Math.abs(b - tB) < Math.abs(prev - tB) ? b : prev, beatgridB.beats[0]);

        const phaseDiffMs = Math.abs((nearestA - tA) - (nearestB - tB)) * 1000;
        syncScore = Math.max(0, 100 - phaseDiffMs * 2); // -2 pts per ms of phase error
      }

      // Mix timing: how well tempos match
      const bpmA = deckA.bpm > 0 ? deckA.bpm * deckA.tempo : 0;
      const bpmB = deckB.bpm > 0 ? deckB.bpm * deckB.tempo : 0;
      let mixTimingScore = 100;
      if (bpmA > 0 && bpmB > 0) {
        const bpmDiff = Math.abs(bpmA - bpmB) / Math.max(bpmA, bpmB);
        mixTimingScore = Math.max(0, 100 - bpmDiff * 1000);
      }

      // Clash detection: both decks playing
      const clashDetected = bothPlaying;
      const keyClash = bothPlaying && deckA.key !== '' && deckB.key !== '' && deckA.key !== deckB.key;

      updatePracticeScores({ syncScore, mixTimingScore, clashDetected, keyClash });
      addSyncHistoryPoint(syncScore);
    }, 500);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [practiceMode.active, deckA, deckB, beatgridA, beatgridB, updatePracticeScores, addSyncHistoryPoint]);

  if (!practiceMode.active) return null;

  const grade = scoreToGrade(practiceMode.sessionScore);
  const gradeColor = GRADE_COLORS[grade];

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      style={{ backgroundColor: '#111118', borderTop: '1px solid #2a2a3a' }}
      className="w-full px-4 py-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Target size={13} style={{ color: '#ffbe0b' }} />
        <span className="text-[10px] font-orbitron font-bold text-white">PRACTICE MODE</span>

        {/* Session grade */}
        <div className="ml-2 flex items-center gap-1.5">
          <span className="text-[8px] font-rajdhani text-muted">SESSION SCORE</span>
          <span
            className="text-[22px] font-orbitron font-bold leading-none"
            style={{ color: gradeColor, textShadow: `0 0 12px ${gradeColor}` }}
          >{grade}</span>
          <span className="text-[14px] font-orbitron" style={{ color: gradeColor }}>
            {Math.round(practiceMode.sessionScore)}
          </span>
        </div>

        {/* Status badges */}
        {practiceMode.clashDetected && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="text-[8px] font-orbitron px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#ff006e22', color: '#ff006e', border: '1px solid #ff006e44' }}
          >CLASH</motion.span>
        )}
        {practiceMode.keyClash && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-[8px] font-orbitron px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#ff6a0022', color: '#ff6a00', border: '1px solid #ff6a0044' }}
          >KEY CLASH</motion.span>
        )}

        <button
          onClick={() => setPracticeActive(false)}
          className="ml-auto text-muted hover:text-white"
        ><X size={13} /></button>
      </div>

      {/* Gauges */}
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <GaugeCanvas value={practiceMode.syncScore} label="SYNC" color="#00f5ff" />
          <GaugeCanvas value={practiceMode.mixTimingScore} label="TIMING" color="#ff006e" />
          <GaugeCanvas
            value={practiceMode.clashDetected ? (practiceMode.keyClash ? 20 : 60) : 100}
            label="HARMONY"
            color={practiceMode.keyClash ? '#ff006e' : practiceMode.clashDetected ? '#ffbe0b' : '#06d6a0'}
          />
        </div>

        {/* Sync history chart */}
        <div>
          <div className="text-[8px] font-rajdhani text-muted mb-1">SYNC HISTORY (last 60s)</div>
          <div className="rounded overflow-hidden" style={{ border: '1px solid #2a2a3a' }}>
            <SyncChart data={practiceMode.syncHistory} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
