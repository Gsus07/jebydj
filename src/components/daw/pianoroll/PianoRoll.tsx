'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import PianoKeys from './PianoKeys';
import type { MIDINote } from '@/src/store/dawTypes';
import { X, ZoomIn, ZoomOut, AlignLeft, Layers, AlignJustify, Activity, Logs } from 'lucide-react';
import { StampTool } from '../../piano-roll/StampTool';
import { ArpTool } from '../../piano-roll/ArpTool';
import { LFOTool } from '../../piano-roll/LFOTool';
import { StrumTool } from '../../piano-roll/StrumTool';

const NOTE_HEIGHT = 14; // px per pitch step
const VELOCITY_LANE_H = 60;
const PIANO_WIDTH = 52;

const BLACK_NOTES = new Set([1, 3, 6, 8, 10]);

export default function PianoRoll() {
  const store = useDAWStore();
  const { pianoRollClipId, pianoRollOpen, pianoRollZoom, pianoRollScrollX, pianoRollScrollY, selectedNoteIds } = store;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(600);
  const [containerH, setContainerH] = useState(300);
  const [activeTool, setActiveTool] = useState<'stamp'|'arp'|'lfo'|'strum'|null>(null);

  // Find clip
  let clip = null as (typeof store.project.tracks[0]['clips'][0]) | null;
  let track = null as (typeof store.project.tracks[0]) | null;
  for (const t of store.project.tracks) {
    const c = t.clips.find((x) => x.id === pianoRollClipId);
    if (c) { clip = c; track = t; break; }
  }

  const zoom = pianoRollZoom;
  const scrollX = pianoRollScrollX;
  const scrollY = pianoRollScrollY;
  const noteHeight = NOTE_HEIGHT;
  const gridHeight = 128 * noteHeight;
  const timelineH = containerH - VELOCITY_LANE_H - 28; // minus ruler and velocity


  const handleStamp = useCallback((notes: { pitch: number, offsetTicks: number, durationTicks: number }[]) => {
    if (!clip) return;
    store.pushHistory('Stamp chord');
    const currentClip = clip;
    const startBeat = Math.round((scrollX / zoom) / store.pianoRollSnapSubdivision) * store.pianoRollSnapSubdivision;
    const addedIds: string[] = [];
    notes.forEach(n => {
       const id = store.addNote(currentClip.id, {
          pitch: 60 + n.pitch,
          startBeat: startBeat + (n.offsetTicks / 480),
          durationBeats: n.durationTicks / 480,
          velocity: 100,
          probability: 100,
          muted: false
       });
       addedIds.push(id);
    });
    store.selectNotes(addedIds);
    setActiveTool(null);
  }, [clip, scrollX, zoom, store]);

  const handleArp = useCallback((params: any) => {
    if (!clip || selectedNoteIds.length === 0) return;
    const currentClip = clip;
    store.pushHistory('Arpeggiate notes');
    const snap = params.time / 480;
    selectedNoteIds.forEach(id => {
       const note = currentClip.notes.find((n: any) => n.id === id);
       if (!note) return;
       store.removeNote(currentClip.id, id);
       for (let b = 0; b < note.durationBeats; b += snap) {
           store.addNote(currentClip.id, {
               ...note,
               startBeat: note.startBeat + b,
               durationBeats: snap * params.gate,
           });
       }
    });
  }, [clip, selectedNoteIds, store]);

  const handleLFO = useCallback((params: any) => {
    if (!clip || selectedNoteIds.length === 0) return;
    const currentClip = clip;
    store.pushHistory('LFO tool');
    selectedNoteIds.forEach(id => {
       const note = currentClip.notes.find((n: any) => n.id === id);
       if (!note) return;
       const newVel = Math.min(127, Math.max(1, note.velocity + params.depth * 64 * Math.sin(note.startBeat * params.speed * Math.PI * 2 + params.phase * Math.PI * 2)));
       store.updateNote(currentClip.id, id, { velocity: newVel });
    });
  }, [clip, selectedNoteIds, store]);

  const handleStrum = useCallback((params: any) => {
    if (!clip || selectedNoteIds.length === 0) return;
    const currentClip = clip;
    store.pushHistory('Strum notes');
    const notes = currentClip.notes.filter((n: any) => selectedNoteIds.includes(n.id)).sort((a: any, b: any) => a.pitch - b.pitch);
    if (params.altDirection) notes.reverse();
    notes.forEach((note: any, i: number) => {
       const offset = (i * params.time * 0.5) * Math.pow(params.tension, i);
       const vel = Math.max(10, note.velocity * Math.pow(params.velocity, i));
       store.updateNote(currentClip.id, note.id, { startBeat: note.startBeat + offset, velocity: vel });
    });
  }, [clip, selectedNoteIds, store]);




  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      if (e[0]) { setContainerW(e[0].contentRect.width); setContainerH(e[0].contentRect.height); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clip) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const gridW = containerW - PIANO_WIDTH;
    const h = timelineH;

    canvas.width = gridW * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${gridW}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, gridW, h);

    // Draw pitch rows
    const firstPitch = Math.max(0, 127 - Math.ceil((scrollY + h) / noteHeight));
    const lastPitch = Math.min(127, 127 - Math.floor(scrollY / noteHeight));

    for (let p = firstPitch; p <= lastPitch; p++) {
      const y = (127 - p) * noteHeight - scrollY;
      const isBlack = BLACK_NOTES.has(p % 12);
      ctx.fillStyle = isBlack ? '#0d0d16' : '#111118';
      ctx.fillRect(0, y, gridW, noteHeight);
    }

    // Beat grid
    const snap = store.pianoRollSnapSubdivision;
    const firstBeat = Math.floor(scrollX / zoom);
    const lastBeat = Math.ceil((scrollX + gridW) / zoom);

    for (let b = firstBeat * (1 / snap); b <= lastBeat * (1 / snap); b++) {
      const beat = b * snap;
      const x = beat * zoom - scrollX;
      if (x < 0 || x > gridW) continue;
      const isBar = beat % clip.durationBeats === 0 || beat % 4 < 0.001;
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Notes
    for (const note of clip.notes) {
      const nx = note.startBeat * zoom - scrollX;
      const nw = Math.max(2, note.durationBeats * zoom - 1);
      const ny = (127 - note.pitch) * noteHeight - scrollY;

      if (nx + nw < 0 || nx > gridW) continue;
      if (ny + noteHeight < 0 || ny > h) continue;

      const isSelected = selectedNoteIds.includes(note.id);
      const color = track?.color ?? '#00f5ff';
      ctx.fillStyle = isSelected ? '#ffffff' : color;
      ctx.fillRect(nx, ny + 1, nw, noteHeight - 2);

      if (isSelected) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(nx, ny + 1, nw, noteHeight - 2);
      }
    }
  }, [clip, track, containerW, timelineH, scrollX, scrollY, zoom, noteHeight, selectedNoteIds, store.pianoRollSnapSubdivision]);

  useEffect(() => { drawGrid(); }, [drawGrid]);

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!clip) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top + scrollY;
    const beat = x / zoom;
    const pitch = 127 - Math.floor(y / noteHeight);

    if (pitch < 0 || pitch > 127) return;

    const snap = store.pianoRollSnapSubdivision;
    const snappedBeat = Math.round(beat / snap) * snap;
    const duration = snap * 2;

    const existingNote = clip.notes.find(
      (n) => snappedBeat >= n.startBeat && snappedBeat < n.startBeat + n.durationBeats
        && n.pitch === pitch,
    );

    if (existingNote) {
      // Click on existing note — select it
      if (e.ctrlKey || e.metaKey) {
        const isSelected = selectedNoteIds.includes(existingNote.id);
        store.selectNotes(isSelected
          ? selectedNoteIds.filter((id) => id !== existingNote.id)
          : [...selectedNoteIds, existingNote.id]);
      } else {
        store.selectNotes([existingNote.id]);
      }
    } else {
      // Add new note
      store.pushHistory('Add note');
      const id = store.addNote(clip.id, {
        pitch,
        startBeat: snappedBeat,
        durationBeats: duration,
        velocity: 100,
        probability: 100,
        muted: false,
      });
      store.selectNotes([id]);
    }
  }, [clip, scrollX, scrollY, zoom, noteHeight, store, selectedNoteIds]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!clip) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top + scrollY;
    const beat = x / zoom;
    const pitch = 127 - Math.floor(y / noteHeight);

    const note = clip.notes.find(
      (n) => beat >= n.startBeat && beat < n.startBeat + n.durationBeats && n.pitch === pitch,
    );
    if (note) {
      store.pushHistory('Remove note');
      store.removeNote(clip.id, note.id);
    }
  }, [clip, scrollX, scrollY, zoom, noteHeight, store]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      store.setPianoRollZoom(Math.max(20, Math.min(200, zoom * (1 - e.deltaY * 0.002))));
    } else if (e.shiftKey) {
      store.setPianoRollScroll(Math.max(0, scrollX + e.deltaY), scrollY);
    } else {
      store.setPianoRollScroll(scrollX, Math.max(0, Math.min(gridHeight - timelineH, scrollY + e.deltaY)));
    }
  }, [zoom, scrollX, scrollY, gridHeight, timelineH, store]);

  const quantize = () => {
    if (!clip || selectedNoteIds.length === 0) return;
    store.pushHistory('Quantize notes');
    store.quantizeNotes(clip.id, selectedNoteIds, store.pianoRollSnapSubdivision);
  };

  if (!pianoRollOpen || !clip) return null;

  const gridW = containerW - PIANO_WIDTH;

  return (
    <div
      className="flex flex-col border-t"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border)',
        height: 300,
        fontFamily: 'var(--font-rajdhani)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 h-8 shrink-0 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--accent-magenta)' }}>
          Piano Roll
        </span>
        {clip && <span className="text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>{clip.name}</span>}
        <div className="flex-1" />

        {/* Snap */}
        <select
          value={store.pianoRollSnapSubdivision}
          onChange={(e) => store.setPianoRollSnap(parseFloat(e.target.value))}
          className="text-xs rounded px-1 h-5 outline-none cursor-pointer"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <option value={1}>1/4</option>
          <option value={0.5}>1/8</option>
          <option value={0.25}>1/16</option>
          <option value={0.125}>1/32</option>
          <option value={0.0625}>1/64</option>
        </select>

        {/* Tools */}
        <div className="flex gap-1 relative ml-2">
          <button onClick={() => setActiveTool(activeTool === 'stamp' ? null : 'stamp')} className="p-1 rounded hover:bg-white/10" style={{ color: activeTool === 'stamp' ? '#00f5ff' : 'var(--text-muted)' }} title="Stamp Tool"><Layers size={12} /></button>
          <button onClick={() => setActiveTool(activeTool === 'arp' ? null : 'arp')} className="p-1 rounded hover:bg-white/10" style={{ color: activeTool === 'arp' ? '#ff006e' : 'var(--text-muted)' }} title="Arpeggiator"><AlignJustify size={12} /></button>
          <button onClick={() => setActiveTool(activeTool === 'lfo' ? null : 'lfo')} className="p-1 rounded hover:bg-white/10" style={{ color: activeTool === 'lfo' ? '#06d6a0' : 'var(--text-muted)' }} title="LFO Tool"><Activity size={12} /></button>
          <button onClick={() => setActiveTool(activeTool === 'strum' ? null : 'strum')} className="p-1 rounded hover:bg-white/10" style={{ color: activeTool === 'strum' ? '#ffbe0b' : 'var(--text-muted)' }} title="Strumizer"><Logs size={12} /></button>
          
          {/* Tool Popups */}
          {activeTool && (
            <div className="absolute top-8 left-0 z-50">
              {activeTool === 'stamp' && <StampTool onStampSelect={handleStamp} />}
              {activeTool === 'arp' && <ArpTool onApply={handleArp} onClose={() => setActiveTool(null)} />}
              {activeTool === 'lfo' && <LFOTool onApply={handleLFO} onClose={() => setActiveTool(null)} />}
              {activeTool === 'strum' && <StrumTool onApply={handleStrum} onClose={() => setActiveTool(null)} />}
            </div>
          )}
        </div>

        {/* Quantize */}
        <button
          className="flex items-center gap-1 px-2 h-5 rounded text-[10px]"
          style={{ background: 'var(--bg-card)', color: 'var(--accent-cyan)', border: '1px solid var(--border)' }}
          onClick={quantize}
          disabled={selectedNoteIds.length === 0}
          title="Quantize selected notes"
        >
          <AlignLeft size={10} /> Q
        </button>

        {/* Zoom */}
        <button onClick={() => store.setPianoRollZoom(Math.max(20, zoom * 0.8))} style={{ color: 'var(--text-muted)' }} title="Zoom out"><ZoomOut size={12} /></button>
        <button onClick={() => store.setPianoRollZoom(Math.min(200, zoom * 1.2))} style={{ color: 'var(--text-muted)' }} title="Zoom in"><ZoomIn size={12} /></button>

        {/* Close */}
        <button
          onClick={() => store.setPianoRollOpen(false)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Piano keys */}
        <PianoKeys noteHeight={noteHeight} scrollY={scrollY} height={timelineH} />

        {/* Note grid */}
        <div className="flex flex-col flex-1 overflow-hidden" onWheel={handleWheel}>
          {/* Ruler */}
          <div
            className="shrink-0 flex"
            style={{ height: 20, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}
          >
            {clip && Array.from({ length: Math.ceil(clip.durationBeats / store.pianoRollSnapSubdivision) + 1 }).map((_, i) => {
              const beat = i * store.pianoRollSnapSubdivision;
              const x = beat * zoom - scrollX;
              if (x < -20 || x > gridW + 20) return null;
              const isBar = beat % 4 < 0.001;
              return (
                <div key={i} className="absolute text-[9px]" style={{ left: PIANO_WIDTH + x, top: 4, color: isBar ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {isBar ? Math.floor(beat / 4) + 1 : ''}
                </div>
              );
            })}
          </div>

          {/* Grid canvas */}
          <canvas
            ref={canvasRef}
            className="cursor-crosshair block"
            onClick={handleGridClick}
            onContextMenu={handleContextMenu}
          />

          {/* Velocity lane */}
          <div
            className="shrink-0 border-t"
            style={{ height: VELOCITY_LANE_H, background: 'var(--bg-card)', borderColor: 'var(--border)', overflow: 'hidden', position: 'relative' }}
          >
            <div className="text-[9px] px-2 pt-1" style={{ color: 'var(--text-muted)' }}>VELOCITY</div>
            {clip?.notes.map((note) => {
              const nx = note.startBeat * zoom - scrollX + PIANO_WIDTH;
              const barH = Math.max(2, (note.velocity / 127) * (VELOCITY_LANE_H - 16));
              return (
                <div
                  key={note.id}
                  className="absolute bottom-1 w-1.5 rounded-t"
                  style={{
                    left: nx,
                    height: barH,
                    background: selectedNoteIds.includes(note.id) ? '#fff' : (track?.color ?? 'var(--accent-cyan)'),
                    opacity: 0.8,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
