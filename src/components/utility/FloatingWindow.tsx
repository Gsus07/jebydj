'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface FloatingWindowProps {
  title: string;
  icon?: React.ReactNode;
  initialX?: number;
  initialY?: number;
  initialW?: number;
  initialH?: number;
  minW?: number;
  minH?: number;
  onClose: () => void;
  children: React.ReactNode;
  active?: boolean;
  onFocus?: () => void;
}

export function FloatingWindow({
  title, icon,
  initialX = 100, initialY = 100,
  initialW = 400, initialH = 300,
  minW = 200, minH = 150,
  onClose, children,
  active = true, onFocus
}: FloatingWindowProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ w: initialW, h: initialH });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const maxW = window.innerWidth - 20;
      const maxH = window.innerHeight - 20;
      const finalW = Math.min(initialW, maxW);
      const finalH = Math.min(initialH, maxH);
      const finalX = Math.max(10, Math.min(initialX, window.innerWidth - finalW - 10));
      const finalY = Math.max(10, Math.min(initialY, window.innerHeight - finalH - 10));
      setSize({ w: Math.max(minW, finalW), h: Math.max(minH, finalH) });
      setPos({ x: finalX, y: finalY });
    }
  }, [initialW, initialH, initialX, initialY, minW, minH]);
  
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0, startW: 0, startH: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: dragStartRef.current.startX + (e.clientX - dragStartRef.current.x),
          y: Math.max(0, dragStartRef.current.startY + (e.clientY - dragStartRef.current.y))
        });
      } else if (isResizing) {
        setSize({
          w: Math.max(minW, dragStartRef.current.startW + (e.clientX - dragStartRef.current.x)),
          h: Math.max(minH, dragStartRef.current.startH + (e.clientY - dragStartRef.current.y))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, minW, minH]);

  const startDrag = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, startX: pos.x, startY: pos.y, startW: size.w, startH: size.h };
    setIsDragging(true);
    if (onFocus) onFocus();
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragStartRef.current = { x: e.clientX, y: e.clientY, startX: pos.x, startY: pos.y, startW: size.w, startH: size.h };
    setIsResizing(true);
    if (onFocus) onFocus();
  };

  return (
    <div
      className="absolute flex flex-col rounded-lg shadow-2xl overflow-hidden backdrop-blur-md font-rajdhani"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: active ? 100 : 90,
        backgroundColor: 'rgba(26,26,36,0.95)',
        border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border)'}`,
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
      }}
      onMouseDown={onFocus}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-between px-3 h-8 shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: active ? 'rgba(0,245,255,0.1)' : 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border)' }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase" style={{ color: active ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
          {icon} {title}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={startResize}
      >
        {/* Subtle triangles for resize handle */}
        <div className="absolute bottom-1 right-1 w-0 h-0 border-solid border-transparent border-b-white/20 border-r-white/20 border-b-[6px] border-r-[6px]" />
      </div>
    </div>
  );
}
