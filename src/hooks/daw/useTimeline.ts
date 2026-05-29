'use client';

import { useCallback, useRef } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';

const MIN_ZOOM = 8;
const MAX_ZOOM = 400;

export function useTimeline() {
  const zoom = useDAWStore((s) => s.zoom);
  const scrollX = useDAWStore((s) => s.scrollX);
  const setZoom = useDAWStore((s) => s.setZoom);
  const setScrollX = useDAWStore((s) => s.setScrollX);
  const setLoopRegion = useDAWStore((s) => s.setLoopRegion);
  const project = useDAWStore((s) => s.project);

  const handleWheel = useCallback((e: WheelEvent, viewportWidth: number) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom around mouse position
      const mouseX = e.offsetX;
      const beatAtMouse = (scrollX + mouseX) / zoom;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (1 - e.deltaY * 0.001)));
      const newScrollX = beatAtMouse * newZoom - mouseX;
      setZoom(newZoom);
      setScrollX(newScrollX);
    } else if (e.shiftKey) {
      // Horizontal scroll
      setScrollX(scrollX + e.deltaY * 0.5);
    } else {
      // Normal horizontal scroll
      setScrollX(scrollX + e.deltaX || scrollX + e.deltaY * 0.3);
    }
  }, [zoom, scrollX, setZoom, setScrollX]);

  const beatToPixel = useCallback((beat: number): number => {
    return beat * zoom - scrollX;
  }, [zoom, scrollX]);

  const pixelToBeat = useCallback((px: number): number => {
    return (px + scrollX) / zoom;
  }, [zoom, scrollX]);

  const snapBeat = useCallback((beat: number): number => {
    const state = useDAWStore.getState();
    if (!state.snapEnabled) return beat;
    const sub = state.snapSubdivision;
    return Math.round(beat / sub) * sub;
  }, []);

  const totalBeats = project.totalBeats;

  return {
    zoom,
    scrollX,
    beatToPixel,
    pixelToBeat,
    snapBeat,
    handleWheel,
    totalBeats,
    bpm: project.bpm,
    timeSignatureNum: project.timeSignatureNum,
  };
}
