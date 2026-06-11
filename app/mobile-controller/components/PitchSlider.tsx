import React, { useCallback, useRef, useState } from 'react';
import styles from '../controller.module.css';

interface PitchSliderProps {
  deckId: 'A' | 'B';
  bpm: number;
  sendMsg: (msg: any) => void;
  onClose: () => void;
}

export function PitchSlider({ deckId, bpm, sendMsg, onClose }: PitchSliderProps) {
  const [pitch, setPitch] = useState(0); // -1 to 1 representing -16% to +16%
  const ref = useRef<HTMLDivElement>(null);

  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const y = e.touches[0].clientY - rect.top;
    let val = 1 - Math.max(0, Math.min(1, y / rect.height)); // 0 to 1
    val = (val - 0.5) * 2; // -1 to 1
    setPitch(val);
    sendMsg({ action: 'pitch', deck: deckId, value: val });
  }, [deckId, sendMsg]);

  const handleDoubleTap = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPitch(0);
    sendMsg({ action: 'pitch', deck: deckId, value: 0 });
  }, [deckId, sendMsg]);

  const nudge = (direction: number) => (e: React.TouchEvent) => {
    e.preventDefault();
    sendMsg({ action: 'nudge', deck: deckId, direction });
  };

  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, right: 0, width: 80,
      backgroundColor: 'var(--card)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0',
      zIndex: 100, boxShadow: '-5px 0 15px rgba(0,0,0,0.5)'
    }}>
      <div style={{ position: 'absolute', left: -24, top: '50%', width: 24, height: 60, marginTop: -30, backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onTouchStart={onClose}>
        <span style={{ transform: 'rotate(90deg)', color: 'var(--muted)' }}>▼</span>
      </div>

      <div className={styles.orbitron} style={{ fontSize: 12, color: deckId === 'A' ? 'var(--cyan)' : 'var(--magenta)' }}>{bpm.toFixed(1)}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 16 }}>{(pitch * 16).toFixed(2)}%</div>

      <button className={styles.touchBtn} style={{ minHeight: 32, minWidth: 48, marginBottom: 8 }} onTouchStart={nudge(-1)}>◀◀ -</button>

      <div 
        ref={ref}
        className={styles.vSliderContainer}
        style={{ flex: 1, minHeight: 120, width: '100%' }}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onDoubleClick={handleDoubleTap}
      >
        <div className={styles.vSliderTrack}>
          <div className={styles.vSliderZero} />
          <div 
            className={styles.vSliderThumb} 
            style={{ bottom: `calc(${((pitch + 1) / 2) * 100}% - 12px)`, borderColor: deckId === 'A' ? 'var(--cyan)' : 'var(--magenta)' }} 
          />
        </div>
      </div>

      <button className={styles.touchBtn} style={{ minHeight: 32, minWidth: 48, marginTop: 8 }} onTouchStart={nudge(1)}>+ ▶▶</button>
    </div>
  );
}
