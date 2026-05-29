'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDJStore } from '@/src/store/useDJStore';
import type { DeckId } from '@/src/store/types';

interface DeckBeatgridProps {
  deckId: DeckId;
  waveformData: Float32Array | null;
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  /** Width and height of the overview canvas (must match DeckWaveform overview) */
  width?: number;
  height?: number;
}

export function DeckBeatgrid({
  deckId,
  waveformData,
  currentTime,
  duration,
  onSeek,
  width = 520,
  height = 50,
}: DeckBeatgridProps) {
  const beatgrid = useDJStore((s) => s.beatgrids[deckId]);
  const { setBeatgrid, setBeatgridEdited, setBeatgridEditing } = useDJStore.getState();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingBeatRef = useRef<{ idx: number; allFrom: boolean } | null>(null);
  const rafRef = useRef<number>(0);

  // ─── Generate beatgrid from BPM ──────────────────────────────────────────
  const generateBeats = useCallback((bpm: number, dur: number, firstBeat = 0): number[] => {
    if (bpm <= 0 || dur <= 0) return [];
    const interval = 60 / bpm;
    const beats: number[] = [];
    for (let t = firstBeat; t < dur; t += interval) {
      beats.push(Math.round(t * 1000) / 1000);
    }
    return beats;
  }, []);

  // Auto-generate when BPM available and no beats yet
  useEffect(() => {
    if (beatgrid.beats.length === 0 && !beatgrid.edited) {
      const deck = useDJStore.getState().decks[deckId];
      if (deck.bpm > 0 && deck.duration > 0) {
        setBeatgrid(deckId, generateBeats(deck.bpm, deck.duration));
      }
    }
  }, [deckId, beatgrid.beats.length, beatgrid.edited, generateBeats, setBeatgrid]);

  // ─── Rendering ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
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

    if (!beatgrid.editing || duration <= 0 || beatgrid.beats.length === 0) return;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, width, height);

    const timeToX = (t: number) => (t / duration) * width;

    // Draw beat lines
    beatgrid.beats.forEach((beat, i) => {
      const x = timeToX(beat);
      const isDownbeat = i % 4 === 0;

      ctx.strokeStyle = isDownbeat ? '#ffbe0b' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = isDownbeat ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Handle circle at top
      ctx.fillStyle = isDownbeat ? '#ffbe0b' : 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x, 6, isDownbeat ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Label
    ctx.fillStyle = '#ffbe0b';
    ctx.font = '9px Orbitron, monospace';
    ctx.fillText('GRID EDIT', 4, height - 4);
  }, [beatgrid.beats, beatgrid.editing, duration, width, height]);

  useEffect(() => {
    const animate = () => {
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ─── Mouse handlers ────────────────────────────────────────────────────────
  const getBeatAtX = useCallback((x: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return -1;
    const t = (x / canvas.clientWidth) * duration;
    const idx = beatgrid.beats.findIndex((b) => Math.abs(b - t) < 60 / (useDJStore.getState().decks[deckId].bpm || 120) * 0.3);
    return idx;
  }, [beatgrid.beats, duration, deckId]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!beatgrid.editing) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = getBeatAtX(x);

    if (e.button === 2) {
      // Right click: delete beat
      if (idx >= 0) {
        const newBeats = beatgrid.beats.filter((_, i) => i !== idx);
        setBeatgrid(deckId, newBeats);
        setBeatgridEdited(deckId, true);
      }
      return;
    }

    if (idx >= 0) {
      draggingBeatRef.current = { idx, allFrom: e.shiftKey };
    }
  }, [beatgrid.editing, beatgrid.beats, getBeatAtX, setBeatgrid, setBeatgridEdited, deckId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingBeatRef.current || !beatgrid.editing) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min(duration, (x / rect.width) * duration));
    const { idx, allFrom } = draggingBeatRef.current;

    const newBeats = [...beatgrid.beats];
    if (allFrom) {
      // Shift all beats from idx onwards by the delta
      const delta = t - newBeats[idx];
      for (let i = idx; i < newBeats.length; i++) {
        newBeats[i] = Math.max(0, newBeats[i] + delta);
      }
    } else {
      newBeats[idx] = t;
    }
    newBeats.sort((a, b) => a - b);
    setBeatgrid(deckId, newBeats);
    setBeatgridEdited(deckId, true);
  }, [beatgrid.editing, beatgrid.beats, duration, deckId, setBeatgrid, setBeatgridEdited]);

  const handleMouseUp = useCallback(() => {
    draggingBeatRef.current = null;
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!beatgrid.editing) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    const newBeats = [...beatgrid.beats, t].sort((a, b) => a - b);
    setBeatgrid(deckId, newBeats);
    setBeatgridEdited(deckId, true);
  }, [beatgrid.editing, beatgrid.beats, duration, deckId, setBeatgrid, setBeatgridEdited]);

  const handleReset = useCallback(() => {
    const deck = useDJStore.getState().decks[deckId];
    if (deck.bpm > 0) {
      setBeatgrid(deckId, generateBeats(deck.bpm, deck.duration));
      setBeatgridEdited(deckId, false);
    }
  }, [deckId, generateBeats, setBeatgrid, setBeatgridEdited]);

  if (!beatgrid.editing) {
    return null;
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          cursor: 'ew-resize',
          zIndex: 10,
          pointerEvents: 'all',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Toolbar */}
      <div
        className="absolute bottom-1 right-1 flex gap-1 z-20"
      >
        <button
          onClick={handleReset}
          className="text-[7px] font-orbitron px-1.5 py-0.5 rounded border border-[#ffbe0b44] text-[#ffbe0b] hover:bg-[#ffbe0b22]"
        >
          RESET
        </button>
        <button
          onClick={() => setBeatgridEditing(deckId, false)}
          className="text-[7px] font-orbitron px-1.5 py-0.5 rounded border border-[#00f5ff44] text-[#00f5ff] hover:bg-[#00f5ff22]"
        >
          LOCK ✓
        </button>
      </div>
    </div>
  );
}
