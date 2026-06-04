'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import { useDAWEngine } from '@/src/hooks/daw/useDAWEngine';
import TrackLane from './TrackLane';
import TimeRuler from './TimeRuler';
import { PlayCursor } from './PlayCursor';
import GhostClip from './GhostClip';
import { ArmedSampleBanner } from './ArmedSampleBanner';
import {
  Plus, MousePointer, Pencil, Eraser, Scissors, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { DAWTool, DAWTrack } from '@/src/store/dawTypes';
import { useSampleStore } from '@/src/store/useSampleStore';
import { storeAudioBuffer } from '@/src/lib/daw/DAWEngine';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import { CATEGORY_COLORS } from '@/src/components/library/SampleRow';

const HEADER_WIDTH = 220;
const DRAG_THRESHOLD_SQ = 16; // 4px² before drag activates

const TRACK_H = { compact: 32, normal: 80, tall: 160, extra: 240 } as const;
const trackHeightPx = (t: DAWTrack): number => TRACK_H[t.height] ?? 80;

function getTrackTopY(tracks: DAWTrack[], targetId: string): number {
  let y = 0;
  for (const t of tracks) {
    if (t.id === targetId) return y;
    y += trackHeightPx(t);
  }
  return y;
}

function getTrackAtY(tracks: DAWTrack[], relY: number): DAWTrack | null {
  let y = 0;
  for (const t of tracks) {
    const h = trackHeightPx(t);
    if (relY < y + h) return t;
    y += h;
  }
  return tracks[tracks.length - 1] ?? null;
}

function checkCollision(
  tracks: DAWTrack[],
  trackId: string,
  startBeat: number,
  durationBeats: number,
  excludeId: string,
): boolean {
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return false;
  return track.clips.some(
    (c) =>
      c.id !== excludeId &&
      startBeat < c.startBeat + c.durationBeats - 0.001 &&
      startBeat + durationBeats > c.startBeat + 0.001,
  );
}

// ─── Insert cursor SVG ────────────────────────────────────────────────────────

function makeInsertCursor(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><line x1="12" y1="2" x2="12" y2="22" stroke="${color}" stroke-width="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="${color}" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ─── Audio feedback ───────────────────────────────────────────────────────────

function playInsertTick(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
    osc.onended = () => void ctx.close();
  } catch { /* ignore */ }
}

function playInsertError(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 220;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start();
    osc.stop(ctx.currentTime + 0.085);
    osc.onended = () => void ctx.close();
  } catch { /* ignore */ }
}

// ─── Drag state types ─────────────────────────────────────────────────────────

interface DragRef {
  clipId: string;
  fromTrackId: string;
  fromStartBeat: number;
  durationBeats: number;
  clipType: 'audio' | 'midi';
  clipColor: string;
  clipName: string;
  offsetBeats: number;       // beats into clip where user clicked
  initialClientX: number;
  initialClientY: number;
  started: boolean;          // true once drag threshold exceeded
  isResize: boolean;
  resizeSide: 'left' | 'right';
  initialDuration: number;
  initialStartBeat: number;
  altCopy: boolean;
  shiftLock: boolean;
  ctrlFreeSnap: boolean;
  selectedOffsets: Record<string, number>; // clipId → beatOffset from primary
  lockedTrackId: string;
}

interface GhostInfo {
  beat: number;
  trackId: string;
  durationBeats: number;
  color: string;
  name: string;
  hasCollision: boolean;
  typeMismatch: boolean;
  altCopy: boolean;
}

interface PaintRef {
  trackId: string;
  lastInsertedBeat: number;
  paintedClipIds: string[];
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArrangementView() {
  const store = useDAWStore();
  const { loadAudioFile } = useDAWEngine();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [emptyAreaDragOver, setEmptyAreaDragOver] = useState(false);

  // Clip drag system
  const dragRef = useRef<DragRef | null>(null);
  const ghostRefData = useRef<GhostInfo | null>(null);
  const [ghostForRender, setGhostForRender] = useState<GhostInfo | null>(null);
  const [draggingClipIds, setDraggingClipIds] = useState<ReadonlySet<string>>(new Set());

  // Armed-sample insert system
  const armedSample = useDAWStore((s) => s.armedSample);
  const [hoverInsert, setHoverInsert] = useState<{ beat: number; trackId: string; hasCollision: boolean } | null>(null);
  const [insertCount, setInsertCount] = useState(0);
  const paintRef = useRef<PaintRef | null>(null);

  // Touch pan — horizontal scroll for mobile (mirrors wheel-based scrollX update)
  const touchPanRef = useRef<{
    startX: number; startY: number; lastX: number; isHorizontal: boolean | null;
  } | null>(null);

  const { zoom, scrollX, activeTool, project } = store;
  const timelineWidth = containerWidth - HEADER_WIDTH;

  // Measure container
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset insert counter when armed sample changes
  useEffect(() => {
    setInsertCount(0);
    setHoverInsert(null);
  }, [armedSample?.id]);

  // ── Touch pan — horizontal scroll for mobile ───────────────────────────────
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchPanRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        lastX: e.touches[0].clientX,
        isHorizontal: null,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = touchPanRef.current;
      if (!t || e.touches.length !== 1) return;
      const dx = t.lastX - e.touches[0].clientX;
      const dy = Math.abs(e.touches[0].clientY - t.startY);

      // Lock scroll axis after first significant movement
      if (t.isHorizontal === null) {
        const adx = Math.abs(t.startX - e.touches[0].clientX);
        if (adx < 4 && dy < 4) return; // wait for clear intent
        t.isHorizontal = adx >= dy;
      }
      if (!t.isHorizontal) return; // vertical scroll — let browser handle it

      e.preventDefault();
      t.lastX = e.touches[0].clientX;
      const { scrollX: sx } = useDAWStore.getState();
      useDAWStore.getState().setScrollX(Math.max(0, sx + dx));
    };

    const onTouchEnd = () => { touchPanRef.current = null; };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []); // stable — uses refs + getState()

  // ── Global mouse handlers (stable refs — all dynamic data via refs/getState) ─

  // ── Paint mode handlers (armed sample) ────────────────────────────────────

  const handlePaintMouseMove = useCallback((e: MouseEvent) => {
    const paint = paintRef.current;
    if (!paint) return;

    const state = useDAWStore.getState();
    const armed = state.armedSample;
    if (!armed) return;

    if (!paint.moved) {
      const dx = e.clientX - paint.startClientX;
      const dy = e.clientY - paint.startClientY;
      if (dx * dx + dy * dy <= 25) return; // 5px threshold
      paint.moved = true;
      // One history entry for the whole paint session
      useDAWStore.getState().pushHistory('Paint sample clips');
    }

    const { zoom: z, scrollX: sx, snapEnabled, snapSubdivision, project: proj } = state;
    const scroller = tracksScrollRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const relX = e.clientX - rect.left - HEADER_WIDTH;
    let beat = (relX + sx) / z;
    if (snapEnabled) beat = Math.round(beat / snapSubdivision) * snapSubdivision;
    beat = Math.max(0, beat);

    const durationBeats = armed.duration * (proj.bpm / 60);
    let insertBeat = paint.lastInsertedBeat + durationBeats;

    while (insertBeat <= beat) {
      const collision = checkCollision(proj.tracks, paint.trackId, insertBeat, durationBeats, '');
      if (!collision) {
        const id = useDAWStore.getState().addAudioClip(
          paint.trackId, insertBeat, durationBeats, armed.name, armed.id, armed.waveformData,
        );
        paint.paintedClipIds.push(id);
        void sampleManager.getOrDecodeBuffer(armed.id).then((buf) => {
          if (buf) storeAudioBuffer(armed.id, buf);
        });
        setInsertCount((c) => c + 1);
      }
      paint.lastInsertedBeat = insertBeat;
      insertBeat += durationBeats;
    }
  }, []); // stable — all data from refs/getState

  const handlePaintMouseUp = useCallback((e: MouseEvent) => {
    const paint = paintRef.current;
    if (!paint) return;

    window.removeEventListener('mousemove', handlePaintMouseMove);
    window.removeEventListener('mouseup', handlePaintMouseUp);
    paintRef.current = null;

    const state = useDAWStore.getState();
    const armed = state.armedSample;

    if (!paint.moved && armed) {
      // Single click — insert at exact mouseup position
      const { zoom: z, scrollX: sx, snapEnabled, snapSubdivision, project: proj } = state;
      const scroller = tracksScrollRef.current;
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const relX = e.clientX - rect.left - HEADER_WIDTH;
      let beat = (relX + sx) / z;
      if (snapEnabled) beat = Math.round(beat / snapSubdivision) * snapSubdivision;
      beat = Math.max(0, beat);

      const track = proj.tracks.find((t) => t.id === paint.trackId);
      if (track?.type === 'audio') {
        const durationBeats = armed.duration * (proj.bpm / 60);
        const collision = checkCollision(proj.tracks, paint.trackId, beat, durationBeats, '');
        if (!collision) {
          const dawState = useDAWStore.getState();
          dawState.pushHistory('Insert sample clip');
          dawState.addAudioClip(paint.trackId, beat, durationBeats, armed.name, armed.id, armed.waveformData);
          void sampleManager.getOrDecodeBuffer(armed.id).then((buf) => {
            if (buf) storeAudioBuffer(armed.id, buf);
          });
          useSampleStore.getState().incrementUsage(armed.id);
          setInsertCount((c) => c + 1);
          playInsertTick();
        } else {
          playInsertError();
        }
      }
    }
    // Paint mode: history was already pushed in handlePaintMouseMove
  }, [handlePaintMouseMove]); // stable

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const state = useDAWStore.getState();
    if (!state.armedSample) return;

    const scroller = tracksScrollRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const relY = e.clientY - scrollerRect.top + scroller.scrollTop;
    const track = getTrackAtY(state.project.tracks, relY);
    if (!track || track.type !== 'audio') return;

    paintRef.current = {
      trackId: track.id,
      lastInsertedBeat: 0, // used for paint; single-click position is from mouseup
      paintedClipIds: [],
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };

    window.addEventListener('mousemove', handlePaintMouseMove);
    window.addEventListener('mouseup', handlePaintMouseUp);

    e.stopPropagation(); // prevent clip-drag system from starting
  }, [handlePaintMouseMove, handlePaintMouseUp]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    // Threshold check
    if (!drag.started) {
      const dx = e.clientX - drag.initialClientX;
      const dy = e.clientY - drag.initialClientY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
      drag.started = true;
    }

    drag.altCopy = e.altKey;
    drag.shiftLock = e.shiftKey;
    drag.ctrlFreeSnap = e.ctrlKey || e.metaKey;

    const state = useDAWStore.getState();
    const { zoom: z, scrollX: sx, snapEnabled, snapSubdivision, project: proj } = state;
    const tracks = proj.tracks;
    document.body.style.cursor = drag.isResize ? 'ew-resize' : 'grabbing';
    document.body.style.userSelect = 'none';

    if (drag.isResize) {
      const dx = e.clientX - drag.initialClientX;
      const deltaBeat = dx / z;
      const shouldSnap = snapEnabled && !drag.ctrlFreeSnap;

      let ghost: GhostInfo;
      if (drag.resizeSide === 'right') {
        let dur = Math.max(0.125, drag.initialDuration + deltaBeat);
        if (shouldSnap) dur = Math.max(snapSubdivision, Math.round(dur / snapSubdivision) * snapSubdivision);
        ghost = {
          beat: drag.fromStartBeat,
          trackId: drag.fromTrackId,
          durationBeats: dur,
          color: drag.clipColor,
          name: drag.clipName,
          hasCollision: checkCollision(tracks, drag.fromTrackId, drag.fromStartBeat, dur, drag.clipId),
          typeMismatch: false,
          altCopy: false,
        };
      } else {
        let newStart = drag.initialStartBeat + deltaBeat;
        let dur = drag.initialDuration - deltaBeat;
        if (shouldSnap) {
          newStart = Math.round(newStart / snapSubdivision) * snapSubdivision;
          dur = (drag.initialStartBeat + drag.initialDuration) - newStart;
        }
        newStart = Math.max(0, newStart);
        dur = Math.max(0.125, dur);
        ghost = {
          beat: newStart,
          trackId: drag.fromTrackId,
          durationBeats: dur,
          color: drag.clipColor,
          name: drag.clipName,
          hasCollision: checkCollision(tracks, drag.fromTrackId, newStart, dur, drag.clipId),
          typeMismatch: false,
          altCopy: false,
        };
      }
      ghostRefData.current = ghost;
      setGhostForRender({ ...ghost });
      setDraggingClipIds(new Set([drag.clipId]));
      return;
    }

    // Normal drag — compute target position
    const scroller = tracksScrollRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const scrollTop = scroller.scrollTop;

    const relX = e.clientX - scrollerRect.left - HEADER_WIDTH;
    let targetBeat = (relX - drag.offsetBeats * z + sx) / z;

    const shouldSnap = snapEnabled && !drag.ctrlFreeSnap;
    if (shouldSnap) targetBeat = Math.round(targetBeat / snapSubdivision) * snapSubdivision;
    targetBeat = Math.max(0, targetBeat);

    const relY = e.clientY - scrollerRect.top + scrollTop;
    let targetTrack = drag.shiftLock
      ? (tracks.find((t) => t.id === drag.lockedTrackId) ?? getTrackAtY(tracks, relY))
      : getTrackAtY(tracks, relY);
    if (!targetTrack) targetTrack = tracks[0];
    if (!targetTrack) return;

    const typeMismatch = drag.clipType !== targetTrack.type;
    const collision =
      !typeMismatch &&
      checkCollision(tracks, targetTrack.id, targetBeat, drag.durationBeats, drag.clipId);

    const ghost: GhostInfo = {
      beat: targetBeat,
      trackId: targetTrack.id,
      durationBeats: drag.durationBeats,
      color: drag.clipColor,
      name: drag.clipName,
      hasCollision: collision,
      typeMismatch,
      altCopy: drag.altCopy,
    };
    ghostRefData.current = ghost;
    setGhostForRender(ghost);
    setDraggingClipIds(new Set([drag.clipId, ...Object.keys(drag.selectedOffsets)]));
  }, []); // empty deps — all state accessed via refs/getState()

  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);

    if (!drag.started) {
      // Was a click, not a drag — handle selection
      const state = useDAWStore.getState();
      const isSelected = state.selectedClipIds.includes(drag.clipId);
      if (e.ctrlKey || e.metaKey) {
        state.selectClips(
          isSelected
            ? state.selectedClipIds.filter((id) => id !== drag.clipId)
            : [...state.selectedClipIds, drag.clipId],
        );
      } else {
        state.selectClips([drag.clipId]);
      }
      dragRef.current = null;
      ghostRefData.current = null;
      setGhostForRender(null);
      setDraggingClipIds(new Set());
      return;
    }

    const ghost = ghostRefData.current;
    dragRef.current = null;
    ghostRefData.current = null;
    setGhostForRender(null);
    setDraggingClipIds(new Set());

    if (!ghost) return;
    if (ghost.typeMismatch || ghost.hasCollision) return; // invalid drop — revert silently

    const dawStore = useDAWStore.getState();

    if (drag.isResize) {
      dawStore.pushHistory('Resize clip');
      if (drag.resizeSide === 'right') {
        dawStore.resizeClip(drag.clipId, drag.fromStartBeat, ghost.durationBeats);
      } else {
        dawStore.resizeClip(drag.clipId, ghost.beat, ghost.durationBeats);
      }
      return;
    }

    if (drag.altCopy) {
      // Duplicate at new position
      dawStore.pushHistory('Duplicate clip');
      const newId = dawStore.duplicateClip(drag.clipId);
      dawStore.moveClip(newId, ghost.trackId, ghost.beat);
      return;
    }

    // Build move list (primary + co-selected)
    const moves: Array<{ clipId: string; newTrackId: string; newStartBeat: number }> = [
      { clipId: drag.clipId, newTrackId: ghost.trackId, newStartBeat: ghost.beat },
    ];
    for (const [id, beatOffset] of Object.entries(drag.selectedOffsets)) {
      moves.push({
        clipId: id,
        newTrackId: ghost.trackId,
        newStartBeat: Math.max(0, ghost.beat + beatOffset),
      });
    }

    // No-op check
    const unchanged =
      moves.length === 1 &&
      moves[0].newTrackId === drag.fromTrackId &&
      Math.abs(moves[0].newStartBeat - drag.fromStartBeat) < 0.001;
    if (unchanged) return;

    dawStore.pushHistory(moves.length > 1 ? 'Move clips' : 'Move clip');
    dawStore.moveClips(moves);
  }, [handleGlobalMouseMove]); // handleGlobalMouseMove is stable

  // ── Escape during drag ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Cancel drag on Escape
      if (e.key === 'Escape' && dragRef.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        dragRef.current = null;
        ghostRefData.current = null;
        setGhostForRender(null);
        setDraggingClipIds(new Set());
        return;
      }

      // Disarm sample on Escape (when not dragging)
      if (e.key === 'Escape') {
        const dawState = useDAWStore.getState();
        if (dawState.armedSample) {
          dawState.disarmSample();
          setHoverInsert(null);
          setInsertCount(0);
          return;
        }
      }

      // Digit keys 1–9: arm/disarm sample shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9 && !dragRef.current?.started) {
          const dawState = useDAWStore.getState();
          const sampleId = dawState.sampleShortcuts[digit];
          if (sampleId) {
            e.preventDefault();
            if (dawState.armedSample?.id === sampleId) {
              dawState.disarmSample();
              setHoverInsert(null);
              setInsertCount(0);
            } else {
              const sample = useSampleStore.getState().samples.find((s) => s.id === sampleId);
              if (sample) {
                const color = CATEGORY_COLORS[sample.category] ?? '#888888';
                dawState.armSample({
                  id: sample.id,
                  name: sample.name,
                  duration: sample.duration,
                  color,
                  category: sample.category,
                  waveformData: sample.waveformData,
                });
                void sampleManager.getOrDecodeBuffer(sample.id).then((buf) => {
                  if (buf) storeAudioBuffer(sample.id, buf);
                });
              }
            }
            return;
          }
        }
      }

      // Tool shortcuts (only when not dragging)
      if (dragRef.current?.started) return;
      if (e.key === 'Escape') store.setActiveTool('select');
      else if (e.key === 'p') store.setActiveTool('pencil');
      else if (e.key === 'e') store.setActiveTool('eraser');
      else if (e.key === 's' && !e.ctrlKey) store.setActiveTool('slice');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, handleGlobalMouseMove, handleGlobalMouseUp]);

  // ── Clip drag start ────────────────────────────────────────────────────────

  const handleClipDragStart = useCallback((
    clipId: string,
    trackId: string,
    offsetBeats: number,
    clientX: number,
    clientY: number,
  ) => {
    const state = useDAWStore.getState();
    const clip = state.project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    const track = state.project.tracks.find((t) => t.id === trackId);
    if (!clip || !track) return;

    // Gather co-selected clip offsets
    const selectedOffsets: Record<string, number> = {};
    const selIds = state.selectedClipIds;
    if (selIds.includes(clipId) && selIds.length > 1) {
      const allClips = state.project.tracks.flatMap((t) => t.clips);
      for (const id of selIds) {
        if (id === clipId) continue;
        const c = allClips.find((x) => x.id === id);
        if (c) selectedOffsets[id] = c.startBeat - clip.startBeat;
      }
    }

    dragRef.current = {
      clipId,
      fromTrackId: trackId,
      fromStartBeat: clip.startBeat,
      durationBeats: clip.durationBeats,
      clipType: clip.type,
      clipColor: track.color,
      clipName: clip.name,
      offsetBeats,
      initialClientX: clientX,
      initialClientY: clientY,
      started: false,
      isResize: false,
      resizeSide: 'right',
      initialDuration: clip.durationBeats,
      initialStartBeat: clip.startBeat,
      altCopy: false,
      shiftLock: false,
      ctrlFreeSnap: false,
      selectedOffsets,
      lockedTrackId: trackId,
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  // ── Clip resize start ─────────────────────────────────────────────────────

  const handleClipResizeStart = useCallback((
    clipId: string,
    side: 'left' | 'right',
    clientX: number,
  ) => {
    const state = useDAWStore.getState();
    const track = state.project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!clip || !track) return;

    dragRef.current = {
      clipId,
      fromTrackId: track.id,
      fromStartBeat: clip.startBeat,
      durationBeats: clip.durationBeats,
      clipType: clip.type,
      clipColor: track.color,
      clipName: clip.name,
      offsetBeats: 0,
      initialClientX: clientX,
      initialClientY: 0,
      started: true, // resize starts immediately, no threshold
      isResize: true,
      resizeSide: side,
      initialDuration: clip.durationBeats,
      initialStartBeat: clip.startBeat,
      altCopy: false,
      shiftLock: false,
      ctrlFreeSnap: false,
      selectedOffsets: {},
      lockedTrackId: track.id,
    };

    const initGhost: GhostInfo = {
      beat: clip.startBeat,
      trackId: track.id,
      durationBeats: clip.durationBeats,
      color: track.color,
      name: clip.name,
      hasCollision: false,
      typeMismatch: false,
      altCopy: false,
    };
    ghostRefData.current = initGhost;
    setGhostForRender(initGhost);
    setDraggingClipIds(new Set([clipId]));
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  // ── Wheel handler ─────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + scroll → zoom
      e.preventDefault();
      const mouseX = e.clientX - (scrollContainerRef.current?.getBoundingClientRect().left ?? 0) - HEADER_WIDTH;
      const { zoom: z, scrollX: sx } = useDAWStore.getState();
      const beatAtMouse = (sx + mouseX) / z;
      const newZoom = Math.max(8, Math.min(400, z * (1 - e.deltaY * 0.002)));
      const newScrollX = beatAtMouse * newZoom - mouseX;
      store.setZoom(newZoom);
      store.setScrollX(Math.max(0, newScrollX));
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Shift+scroll or horizontal trackpad → horizontal timeline scroll
      e.preventDefault();
      const delta = e.shiftKey ? e.deltaY : e.deltaX;
      store.setScrollX(Math.max(0, scrollX + delta * 0.5));
    } else {
      // Plain vertical scroll → pan timeline horizontally (standard DAW behaviour)
      e.preventDefault();
      store.setScrollX(Math.max(0, scrollX + e.deltaY));
    }
  }, [scrollX, store]);

  // ── File drop for audio import ────────────────────────────────────────────

  const handleFileDrop = useCallback(async (trackId: string, beat: number, file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|flac|aiff|m4a)$/i)) return;
    try {
      const { id, waveformData, durationBeats } = await loadAudioFile(file);
      store.pushHistory('Import audio clip');
      store.addAudioClip(trackId, beat, durationBeats, file.name.replace(/\.[^.]+$/, ''), id, waveformData);
    } catch (err) {
      console.error('Failed to load audio:', err);
    }
  }, [loadAudioFile, store]);

  // ── Empty area drop (new track) ───────────────────────────────────────────

  const handleEmptyAreaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setEmptyAreaDragOver(false);
    const sampleJson = e.dataTransfer.getData('application/x-sample');
    if (!sampleJson) return;
    try {
      const meta = JSON.parse(sampleJson) as { id: string };
      const sample = useSampleStore.getState().samples.find((s) => s.id === meta.id);
      if (!sample) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left - HEADER_WIDTH;
      const { scrollX: sx, zoom: z, snapEnabled, snapSubdivision, project: proj } = useDAWStore.getState();
      const beat = Math.max(0, (x + sx) / z);
      const snapped = snapEnabled ? Math.round(beat / snapSubdivision) * snapSubdivision : beat;
      const durationBeats = sample.duration * (proj.bpm / 60);
      store.pushHistory('Drop sample → new track');
      const trackId = store.addTrack('audio');
      store.addAudioClip(trackId, snapped, durationBeats, sample.name, sample.id, sample.waveformData);
      void sampleManager.getOrDecodeBuffer(sample.id).then((buf) => {
        if (buf) storeAudioBuffer(sample.id, buf);
      });
      useSampleStore.getState().incrementUsage(sample.id);
    } catch {
      // ignore malformed data
    }
  }, [store]);

  // ── Derived values ────────────────────────────────────────────────────────

  const TRACK_HEIGHTS_MAP = { compact: 32, normal: 80, tall: 160, extra: 240 } as const;
  const totalHeight = project.tracks.reduce((sum, t) => sum + (TRACK_HEIGHTS_MAP[t.height] ?? 80), 0);

  // Ghost pixel coordinates (computed from current store state)
  const ghostTargetTrackId = ghostForRender?.trackId ?? null;
  let ghostPixels: { x: number; y: number; w: number; h: number } | null = null;
  if (ghostForRender) {
    const targetTrack = project.tracks.find((t) => t.id === ghostForRender.trackId);
    if (targetTrack) {
      ghostPixels = {
        x: HEADER_WIDTH + ghostForRender.beat * zoom - scrollX,
        y: getTrackTopY(project.tracks, ghostForRender.trackId),
        w: ghostForRender.durationBeats * zoom,
        h: trackHeightPx(targetTrack) - 1,
      };
    }
  }

  // Secondary ghosts for co-selected clips
  const secondaryGhosts: Array<{ x: number; y: number; w: number; h: number; color: string; name: string; beat: number }> = [];
  if (ghostForRender && dragRef.current && !dragRef.current.isResize) {
    const drag = dragRef.current;
    for (const [clipId, beatOffset] of Object.entries(drag.selectedOffsets)) {
      const ownerTrack = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      const clip = ownerTrack?.clips.find((c) => c.id === clipId);
      const targetTrack = project.tracks.find((t) => t.id === ghostForRender.trackId);
      if (!clip || !targetTrack) continue;
      const beat = Math.max(0, ghostForRender.beat + beatOffset);
      secondaryGhosts.push({
        x: HEADER_WIDTH + beat * zoom - scrollX,
        y: getTrackTopY(project.tracks, ghostForRender.trackId),
        w: clip.durationBeats * zoom,
        h: trackHeightPx(targetTrack) - 1,
        color: ownerTrack?.color ?? ghostForRender.color,
        name: clip.name,
        beat,
      });
    }
  }

  const tools: { id: DAWTool; icon: React.ReactNode; title: string }[] = [
    { id: 'select', icon: <MousePointer size={14} />, title: 'Select (Esc)' },
    { id: 'pencil', icon: <Pencil size={14} />,       title: 'Draw (P)' },
    { id: 'eraser', icon: <Eraser size={14} />,       title: 'Erase (E)' },
    { id: 'slice',  icon: <Scissors size={14} />,     title: 'Slice (S)' },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div
        className="daw-toolbar daw-hscroll flex items-center gap-2 px-3 shrink-0 border-b"
        style={{ height: 'var(--h-daw-toolbar, 36px)', background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex gap-1">
          {tools.map((t) => (
            <button
              key={t.id}
              className="flex items-center justify-center w-7 h-7 rounded transition-all"
              style={{
                background: activeTool === t.id ? 'var(--accent-cyan)' : 'var(--bg-card)',
                color: activeTool === t.id ? '#000' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
              onClick={() => store.setActiveTool(t.id)}
              title={t.title}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-5" style={{ background: 'var(--border)' }} />

        {/* Snap */}
        <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={store.snapEnabled}
            onChange={(e) => store.setSnapEnabled(e.target.checked)}
            className="w-3 h-3"
          />
          SNAP
        </label>
        <select
          value={store.snapSubdivision}
          onChange={(e) => store.setSnapSubdivision(parseFloat(e.target.value))}
          className="text-xs rounded px-1 outline-none cursor-pointer h-6"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <option value={4}>1/1</option>
          <option value={2}>1/2</option>
          <option value={1}>1/4</option>
          <option value={0.5}>1/8</option>
          <option value={0.25}>1/16</option>
          <option value={0.125}>1/32</option>
        </select>

        <div className="flex-1" />

        {/* Zoom */}
        <button
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => store.setZoom(zoom * 0.75)}
          title="Zoom out"
        ><ZoomOut size={12} /></button>
        <input
          type="range"
          min={8}
          max={400}
          value={zoom}
          onChange={(e) => store.setZoom(parseInt(e.target.value))}
          className="w-24 h-1 cursor-pointer"
          style={{ accentColor: 'var(--accent-cyan)' }}
        />
        <button
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => store.setZoom(zoom * 1.33)}
          title="Zoom in"
        ><ZoomIn size={12} /></button>

        <div className="w-px h-5" style={{ background: 'var(--border)' }} />

        {/* Add Track */}
        <button
          className="flex items-center gap-1 px-2 h-6 rounded text-xs"
          style={{ background: 'var(--bg-card)', color: 'var(--accent-cyan)', border: '1px solid var(--border)' }}
          onClick={() => { store.pushHistory('Add audio track'); store.addTrack('audio'); }}
        >
          <Plus size={12} /> Audio
        </button>
        <button
          className="flex items-center gap-1 px-2 h-6 rounded text-xs"
          style={{ background: 'var(--bg-card)', color: 'var(--accent-magenta)', border: '1px solid var(--border)' }}
          onClick={() => { store.pushHistory('Add MIDI track'); store.addTrack('midi'); }}
        >
          <Plus size={12} /> MIDI
        </button>
      </div>

      {/* Armed sample banner */}
      <ArmedSampleBanner insertCount={insertCount} />

      {/* Main timeline area */}
      <div
        ref={scrollContainerRef}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
        onWheel={handleWheel}
      >
        {/* Ruler row */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: HEADER_WIDTH, flexShrink: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }} />
          <div className="relative flex-1 overflow-hidden">
            <TimeRuler width={timelineWidth} height={28} />
            <PlayCursor scrollX={scrollX} zoom={zoom} height={28} />
          </div>
        </div>

        {/* Tracks */}
        <div ref={tracksScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div
            className="relative"
            style={{
              minHeight: totalHeight,
              cursor: armedSample && !dragRef.current
                ? `url(${makeInsertCursor(armedSample.color)}) 12 12, crosshair`
                : undefined,
            }}
            onMouseMove={(e) => {
              if (paintRef.current) return; // during paint, suppress hover ghost
              const state = useDAWStore.getState();
              if (!state.armedSample) {
                if (hoverInsert) setHoverInsert(null);
                return;
              }
              const scroller = tracksScrollRef.current;
              if (!scroller) return;
              const { zoom: z, scrollX: sx, snapEnabled, snapSubdivision, project: proj } = state;
              const rect = scroller.getBoundingClientRect();
              const relX = e.clientX - rect.left - HEADER_WIDTH;
              const relY = e.clientY - rect.top + scroller.scrollTop;
              let beat = (relX + sx) / z;
              if (snapEnabled) beat = Math.round(beat / snapSubdivision) * snapSubdivision;
              beat = Math.max(0, beat);
              const track = getTrackAtY(proj.tracks, relY);
              if (!track) { setHoverInsert(null); return; }
              const durationBeats = state.armedSample.duration * (proj.bpm / 60);
              const typeMismatch = track.type !== 'audio';
              const hasCollision = !typeMismatch && checkCollision(proj.tracks, track.id, beat, durationBeats, '');
              setHoverInsert({ beat, trackId: track.id, hasCollision: hasCollision || typeMismatch });
            }}
            onMouseLeave={() => setHoverInsert(null)}
            onContextMenu={(e) => {
              const state = useDAWStore.getState();
              if (state.armedSample) {
                e.preventDefault();
                state.disarmSample();
                setHoverInsert(null);
                setInsertCount(0);
              }
            }}
            onMouseDown={handleContainerMouseDown}
          >
            {project.tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                zoom={zoom}
                scrollX={scrollX}
                viewportWidth={timelineWidth}
                onFileDrop={handleFileDrop}
                draggingClipIds={draggingClipIds}
                onClipDragStart={handleClipDragStart}
                onClipResizeStart={handleClipResizeStart}
              />
            ))}

            {/* Ghost clip overlay — primary (drag) */}
            {ghostForRender && ghostPixels && (
              <GhostClip
                x={ghostPixels.x}
                y={ghostPixels.y}
                width={ghostPixels.w}
                height={ghostPixels.h}
                color={ghostForRender.color}
                name={ghostForRender.name}
                hasCollision={ghostForRender.hasCollision}
                typeMismatch={ghostForRender.typeMismatch}
                altCopy={ghostForRender.altCopy}
                beat={ghostForRender.beat}
              />
            )}

            {/* Hover insert ghost (armed sample) */}
            {armedSample && hoverInsert && !ghostForRender && (() => {
              const tgt = project.tracks.find((t) => t.id === hoverInsert.trackId);
              if (!tgt) return null;
              const dur = armedSample.duration * (project.bpm / 60);
              return (
                <GhostClip
                  x={HEADER_WIDTH + hoverInsert.beat * zoom - scrollX}
                  y={getTrackTopY(project.tracks, hoverInsert.trackId)}
                  width={dur * zoom}
                  height={trackHeightPx(tgt) - 1}
                  color={armedSample.color}
                  name={armedSample.name}
                  hasCollision={hoverInsert.hasCollision}
                  typeMismatch={false}
                  altCopy={false}
                  beat={hoverInsert.beat}
                />
              );
            })()}

            {/* Ghost clip overlays — co-selected clips */}
            {secondaryGhosts.map((g, i) => (
              <GhostClip
                key={i}
                x={g.x}
                y={g.y}
                width={g.w}
                height={g.h}
                color={g.color}
                name={g.name}
                hasCollision={false}
                typeMismatch={false}
                altCopy={false}
                beat={g.beat}
              />
            ))}

            {/* Drag target track highlight */}
            {ghostTargetTrackId && (() => {
              const t = project.tracks.find((x) => x.id === ghostTargetTrackId);
              if (!t) return null;
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: HEADER_WIDTH,
                    top: getTrackTopY(project.tracks, ghostTargetTrackId),
                    right: 0,
                    height: trackHeightPx(t),
                    background: 'rgba(255,255,255,0.03)',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              );
            })()}
          </div>

          {/* Empty drop zone */}
          <div
            className="min-h-16 flex items-center justify-center transition-colors"
            style={{
              background: emptyAreaDragOver ? 'rgba(0,245,255,0.05)' : 'transparent',
              border: emptyAreaDragOver ? '2px dashed rgba(0,245,255,0.4)' : '2px dashed transparent',
              marginTop: 4,
              borderRadius: 4,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.types.includes('application/x-sample')) setEmptyAreaDragOver(true);
            }}
            onDragLeave={() => setEmptyAreaDragOver(false)}
            onDrop={handleEmptyAreaDrop}
          >
            {emptyAreaDragOver && (
              <span className="text-[11px] pointer-events-none" style={{ color: 'var(--accent-cyan)' }}>
                Drop to create new track
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

