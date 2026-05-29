'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { midiToFreq, midiToNoteName, previewNote } from '@/src/lib/daw/MIDIEngine';
import { useDAWStore } from '@/src/store/useDAWStore';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_NOTES = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#

interface PianoKeysProps {
  noteHeight: number;
  scrollY: number;
  height: number;
}

export default function PianoKeys({ noteHeight, scrollY, height }: PianoKeysProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useDAWStore();
  const clipId = store.pianoRollClipId;

  const getInstrument = () => {
    if (!clipId) return 'basicSynth' as const;
    for (const track of store.project.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return track.instrument;
    }
    return 'basicSynth' as const;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 52;

    canvas.width = w * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, w, height);

    const firstNote = Math.floor(scrollY / noteHeight);
    const lastNote = Math.ceil((scrollY + height) / noteHeight);

    for (let midi = Math.max(0, 127 - lastNote); midi <= Math.min(127, 127 - firstNote); midi++) {
      const noteIndex = midi % 12;
      const y = (127 - midi) * noteHeight - scrollY;
      const isBlack = BLACK_NOTES.has(noteIndex);

      // White key background
      if (!isBlack) {
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(0, y, w, noteHeight);
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y, w, noteHeight);

        // Note name at C octaves
        if (noteIndex === 0) {
          ctx.fillStyle = '#333';
          ctx.font = `bold ${Math.min(10, noteHeight * 0.7)}px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(midiToNoteName(midi), 2, y + noteHeight / 2);
        }
      } else {
        // Black key
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(0, y, w * 0.65, noteHeight);
      }
    }

    // Border
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(w - 0.5, 0, 0, height);
  }, [height, noteHeight, scrollY]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const y = e.clientY - rect.top + scrollY;
    const midi = 127 - Math.floor(y / noteHeight);
    if (midi >= 0 && midi <= 127) {
      previewNote(midi, getInstrument());
    }
  }, [scrollY, noteHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="shrink-0 cursor-pointer"
      onClick={handleClick}
      title="Click to preview note"
    />
  );
}
