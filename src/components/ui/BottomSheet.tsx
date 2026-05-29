'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** CSS max-height for the sheet; default '90vh' */
  maxHeight?: string;
}

/**
 * Mobile-first bottom sheet with drag-to-dismiss.
 * Renders an animated overlay + slide-up panel.
 */
export function BottomSheet({ open, onClose, children, title, maxHeight = '90vh' }: BottomSheetProps) {
  const startYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);

  const DISMISS_THRESHOLD = 100;

  const handleHandleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    draggingRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      setDragY(Math.max(0, ev.clientY - startYRef.current));
    };
    const onUp = (ev: MouseEvent) => {
      draggingRef.current = false;
      if (ev.clientY - startYRef.current > DISMISS_THRESHOLD) {
        onClose();
      }
      setDragY(0);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleHandleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleHandleTouchMove = (e: React.TouchEvent) => {
    setDragY(Math.max(0, e.touches[0].clientY - startYRef.current));
  };

  const handleHandleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - startYRef.current;
    if (delta > DISMISS_THRESHOLD) onClose();
    setDragY(0);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bs-overlay"
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="bs-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
              maxHeight,
              y: dragY,
            }}
            initial={{ y: '100%' }}
            animate={{ y: dragY }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center items-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleHandleMouseDown}
              onTouchStart={handleHandleTouchStart}
              onTouchMove={handleHandleTouchMove}
              onTouchEnd={handleHandleTouchEnd}
            >
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: 'var(--border)' }}
              />
            </div>

            {title && (
              <div
                className="px-4 pb-2 shrink-0 text-sm font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-rajdhani)' }}
              >
                {title}
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
