'use client';

import React, { useRef, useCallback, useState } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import type { DAWClip, DAWTrack } from '@/src/store/dawTypes';
import TrackHeader from './TrackHeader';
import AudioClip from './AudioClip';
import MIDIClip from './MIDIClip';
import { useSampleStore } from '@/src/store/useSampleStore';
import { storeAudioBuffer } from '@/src/lib/daw/DAWEngine';
import { sampleManager } from '@/src/lib/samples/SampleManager';

const TRACK_HEIGHTS = { compact: 32, normal: 80, tall: 160, extra: 240 } as const;

interface TrackLaneProps {
  track: DAWTrack;
  zoom: number;
  scrollX: number;
  viewportWidth: number;
  onFileDrop: (trackId: string, beat: number, file: File) => void;
  /** IDs of clips currently being dragged (shown semi-transparent) */
  draggingClipIds: ReadonlySet<string>;
  /** Called when user starts dragging a clip */
  onClipDragStart: (
    clipId: string,
    trackId: string,
    offsetBeats: number,
    clientX: number,
    clientY: number,
  ) => void;
  /** Called when user starts resizing a clip */
  onClipResizeStart: (clipId: string, side: 'left' | 'right', clientX: number) => void;
}

export default function TrackLane({
  track, zoom, scrollX, viewportWidth, onFileDrop,
  draggingClipIds, onClipDragStart, onClipResizeStart,
}: TrackLaneProps) {
  const store = useDAWStore();
  const height = TRACK_HEIGHTS[track.height] ?? 80;

  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeTool = store.activeTool;
  const selectedClipIds = store.selectedClipIds;

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'pencil') return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = (x + scrollX) / zoom;
    const snapped = store.snapEnabled
      ? Math.round(beat / store.snapSubdivision) * store.snapSubdivision
      : beat;

    store.pushHistory('Add clip');
    store.addClip(track.id, Math.max(0, snapped), track.type === 'midi' ? 'midi' : 'audio');
  }, [activeTool, scrollX, zoom, store, track.id, track.type]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.max(0, (x + scrollX) / zoom);
    const snappedBeat = store.snapEnabled
      ? Math.round(beat / store.snapSubdivision) * store.snapSubdivision
      : beat;

    // Check for sample drop (from SampleBrowser)
    const sampleJson = e.dataTransfer.getData('application/x-sample');
    if (sampleJson) {
      try {
        const meta = JSON.parse(sampleJson) as { id: string; name: string; duration: number; bpm: number | null; category: string };
        const sample = useSampleStore.getState().samples.find((s) => s.id === meta.id);
        if (!sample) return;
        const bpm = store.project.bpm;
        const durationBeats = sample.duration * (bpm / 60);
        store.pushHistory('Drop sample clip');
        store.addAudioClip(track.id, snappedBeat, durationBeats, sample.name, sample.id, sample.waveformData);
        // Preload buffer asynchronously
        void sampleManager.getOrDecodeBuffer(sample.id).then((buf) => {
          if (buf) storeAudioBuffer(sample.id, buf);
        });
        useSampleStore.getState().incrementUsage(sample.id);
      } catch {
        // ignore malformed JSON
      }
      return;
    }

    // Check for DJ track drop (from TrackLibrary)
    const trackJson = e.dataTransfer.getData('application/x-dj-track');
    if (trackJson) {
      try {
        const td = JSON.parse(trackJson) as {
          id: string; title: string; fileName: string; artist: string;
          bpm: number; duration: number; waveformData: number[];
          arrayBuffer: number[] | null;
        };
        const bpm = store.project.bpm;
        const durationBeats = td.duration > 0 ? (td.duration / 60) * bpm : 8;
        const waveform = td.waveformData ?? [];
        store.pushHistory('Drop track clip');
        store.addAudioClip(
          track.id, snappedBeat, durationBeats,
          td.title || td.fileName, td.id, waveform,
        );
        // Decode and store the audio buffer asynchronously
        if (td.arrayBuffer) {
          void (async () => {
            try {
              const { audioEngine } = await import('@/src/lib/audio/AudioEngine');
              if (!audioEngine.isInitialized()) return;
              const raw = new Uint8Array(td.arrayBuffer!).buffer;
              const audioBuf = await audioEngine.decodeAudioData(raw);
              storeAudioBuffer(td.id, audioBuf);
            } catch (err) {
              console.error('Failed to decode dropped track audio:', err);
            }
          })();
        }
      } catch {
        // ignore malformed JSON
      }
      return;
    }

    // Regular file drop
    const file = e.dataTransfer.files[0];
    if (!file) return;
    onFileDrop(track.id, snappedBeat, file);
  }, [scrollX, zoom, track.id, onFileDrop, store]);

  const visibleClips = track.clips.filter((c) => {
    const clipEnd = c.startBeat + c.durationBeats;
    const cxEnd = clipEnd * zoom - scrollX;
    const cxStart = c.startBeat * zoom - scrollX;
    return cxEnd > 0 && cxStart < viewportWidth;
  });

  const getCursorStyle = () => {
    switch (activeTool) {
      case 'pencil': return 'crosshair';
      case 'eraser': return 'cell';
      case 'slice':  return 'col-resize';
      default:       return 'default';
    }
  };

  return (
    <div className="flex" style={{ height }}>
      <TrackHeader track={track} height={height} />

      {/* Timeline canvas area */}
      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden"
        style={{
          height,
          background: dragOver ? 'rgba(0,245,255,0.05)' : 'transparent',
          borderBottom: '1px solid var(--border)',
          cursor: getCursorStyle(),
        }}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Beat grid lines */}
        <BeatGrid zoom={zoom} scrollX={scrollX} width={viewportWidth} height={height} />

        {/* Clips */}
        {visibleClips.map((clip) => {
          const cx = clip.startBeat * zoom - scrollX;
          const cw = clip.durationBeats * zoom;
          const isSelected = selectedClipIds.includes(clip.id);
          const isDragging = draggingClipIds.has(clip.id);

          /**
           * All clip interactions go through onMouseDown so we can
           * distinguish a click from a drag before committing anything.
           */
          const handleClipMouseDown = (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            // Resize handles have data-handle attribute — skip drag/tool handling
            if ((e.target as HTMLElement).dataset.handle) return;

            if (activeTool === 'eraser') {
              e.stopPropagation();
              store.pushHistory('Remove clip');
              store.removeClip(clip.id);
              return;
            }

            if (activeTool === 'slice') {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const relX = e.clientX - rect.left;
              const beatInClip = relX / zoom;
              store.pushHistory('Split clip');
              store.splitClip(clip.id, clip.startBeat + beatInClip);
              return;
            }

            if (activeTool === 'select') {
              e.stopPropagation();
              e.preventDefault();
              // Compute offset (in beats) within the clip where user clicked
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const clickXInClip = e.clientX - rect.left;
              const offsetBeats = Math.max(0, Math.min(clip.durationBeats - 0.001, clickXInClip / zoom));
              onClipDragStart(clip.id, track.id, offsetBeats, e.clientX, e.clientY);
            }
          };

          const handleDblClick = () => {
            if (clip.type === 'midi') {
              store.setPianoRollOpen(true, clip.id);
            } else {
              store.setSampleEditorOpen(true, clip.id);
            }
          };

          const handleResizeStart = (e: React.MouseEvent, side: 'left' | 'right') => {
            onClipResizeStart(clip.id, side, e.clientX);
          };

          const ClipComponent = (clip.type === 'audio' ? AudioClip : MIDIClip) as React.ComponentType<{
            clip: DAWClip; track: DAWTrack; x: number; width: number; height: number;
            isSelected: boolean; isDragging: boolean;
            onMouseDown: (e: React.MouseEvent) => void;
            onDoubleClick: () => void;
            onContextMenu: (e: React.MouseEvent) => void;
            onResizeStart: (e: React.MouseEvent, side: 'left' | 'right') => void;
          }>;

          return (
            <ClipComponent
              key={clip.id}
              clip={clip}
              track={track}
              x={cx}
              width={cw}
              height={height - 1}
              isSelected={isSelected}
              isDragging={isDragging}
              onMouseDown={handleClipMouseDown}
              onDoubleClick={handleDblClick}
              onContextMenu={(e) => e.preventDefault()}
              onResizeStart={handleResizeStart}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Beat Grid ─────────────────────────────────────────────────────────────────

interface BeatGridProps {
  zoom: number;
  scrollX: number;
  width: number;
  height: number;
}

function BeatGrid({ zoom, scrollX, width, height }: BeatGridProps) {
  if (zoom < 6) return null;

  const firstBeat = Math.floor(scrollX / zoom);
  const lastBeat = Math.ceil((scrollX + width) / zoom);
  const lines: React.ReactNode[] = [];

  for (let b = firstBeat; b <= lastBeat; b++) {
    const x = b * zoom - scrollX;
    if (x < 0 || x > width) continue;
    lines.push(
      <div
        key={b}
        className="absolute top-0 bottom-0"
        style={{
          left: x,
          width: 1,
          background: b % 4 === 0
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(255,255,255,0.03)',
          pointerEvents: 'none',
        }}
      />,
    );
  }

  return <>{lines}</>;
}
