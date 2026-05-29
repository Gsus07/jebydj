'use client';

import { useRef, useCallback } from 'react';

export interface TouchDragHandlers {
  onStart: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
}

/**
 * Returns unified mouse + touch event props for draggable elements.
 * The handlers receive raw clientX/clientY coordinates.
 *
 * Usage:
 *   const drag = useTouchDrag({ onStart, onMove, onEnd });
 *   <div {...drag} />
 */
export function useTouchDrag(handlers: TouchDragHandlers) {
  const activeRef = useRef(false);
  // keep a stable reference so the window listeners don't stale-close
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    activeRef.current = true;
    handlersRef.current.onStart(e.clientX, e.clientY);

    const onMove = (ev: MouseEvent) => {
      if (!activeRef.current) return;
      handlersRef.current.onMove(ev.clientX, ev.clientY);
    };
    const onUp = (ev: MouseEvent) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      handlersRef.current.onEnd(ev.clientX, ev.clientY);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    activeRef.current = true;
    handlersRef.current.onStart(t.clientX, t.clientY);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!activeRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    handlersRef.current.onMove(t.clientX, t.clientY);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const t = e.changedTouches[0];
    handlersRef.current.onEnd(t.clientX, t.clientY);
  }, []);

  return { onMouseDown, onTouchStart, onTouchMove, onTouchEnd } as const;
}
