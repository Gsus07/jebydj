import React, { useCallback, useRef } from 'react';
import styles from '../controller.module.css';

interface CrossfaderProps {
  value: number;
  sendMsg: (msg: any) => void;
  vertical?: boolean;
}

export function Crossfader({ value, sendMsg, vertical = false }: CrossfaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    let val = 0.5;
    if (vertical) {
      const y = e.touches[0].clientY - rect.top;
      val = Math.max(0, Math.min(1, y / rect.height)); // 0 top (A), 1 bottom (B)
    } else {
      const x = e.touches[0].clientX - rect.left;
      val = Math.max(0, Math.min(1, x / rect.width));
    }
    
    // Haptic feedback at center
    if (Math.abs(val - 0.5) < 0.02) {
      if (navigator.vibrate) navigator.vibrate(20);
      val = 0.5; // Snap to center slightly
    }
    
    sendMsg({ action: 'crossfader', value: val });
  }, [sendMsg, vertical]);

  const handleDoubleTap = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sendMsg({ action: 'crossfader', value: 0.5 });
  }, [sendMsg]);

  const pos = value * 100;
  const thumbColor = value < 0.5 ? 'var(--cyan)' : (value > 0.5 ? 'var(--magenta)' : 'var(--text)');

  if (vertical) {
    return (
      <div 
        ref={containerRef}
        onTouchStart={handleMove}
        onTouchMove={handleMove}
        onDoubleClick={handleDoubleTap}
        style={{
          width: 64, height: '100%', position: 'relative',
          background: 'linear-gradient(180deg, rgba(0,245,255,0.1) 0%, rgba(10,10,15,1) 50%, rgba(255,0,110,0.1) 100%)',
          display: 'flex', justifyContent: 'center'
        }}
      >
        <div style={{ position: 'absolute', top: 16, color: 'var(--cyan)', fontSize: 24, fontWeight: 'bold', opacity: 0.5 }}>A</div>
        <div style={{ position: 'absolute', bottom: 16, color: 'var(--magenta)', fontSize: 24, fontWeight: 'bold', opacity: 0.5 }}>B</div>
        
        {/* Track */}
        <div style={{ position: 'absolute', top: 32, bottom: 32, width: 4, background: 'var(--border)', borderRadius: 2 }} />
        
        {/* Thumb */}
        <div style={{
          position: 'absolute',
          top: `calc(${pos}% - 12px)`,
          width: 48,
          height: 24,
          backgroundColor: thumbColor,
          borderRadius: 4,
          boxShadow: `0 0 10px ${thumbColor}`,
          transition: 'background-color 0.1s'
        }} />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={styles.crossfaderContainer}
      onTouchStart={handleMove}
      onTouchMove={handleMove}
      onDoubleClick={handleDoubleTap}
      style={{
        background: 'linear-gradient(90deg, rgba(0,245,255,0.1) 0%, rgba(10,10,15,1) 50%, rgba(255,0,110,0.1) 100%)'
      }}
    >
      <div style={{ position: 'absolute', left: 16, color: 'var(--cyan)', fontSize: 24, fontWeight: 'bold', opacity: 0.5 }}>A</div>
      <div style={{ position: 'absolute', right: 16, color: 'var(--magenta)', fontSize: 24, fontWeight: 'bold', opacity: 0.5 }}>B</div>
      
      {/* Track */}
      <div style={{ position: 'absolute', left: 32, right: 32, height: 4, background: 'var(--border)', borderRadius: 2, top: '50%', marginTop: -2 }} />
      
      {/* Thumb */}
      <div style={{
        position: 'absolute',
        left: `calc(${pos}% - 12px)`,
        width: 24,
        height: 48,
        backgroundColor: thumbColor,
        borderRadius: 4,
        boxShadow: `0 0 10px ${thumbColor}`,
        transition: 'background-color 0.1s'
      }} />
    </div>
  );
}
