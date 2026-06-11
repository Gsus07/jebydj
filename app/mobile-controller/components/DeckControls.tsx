import React, { useCallback, useRef, useEffect } from 'react';
import styles from '../controller.module.css';
import { DeckState } from './types';

interface DeckControlsProps {
  deckId: 'A' | 'B';
  state: DeckState;
  sendMsg: (msg: any) => void;
}

export function DeckControls({ deckId, state, sendMsg }: DeckControlsProps) {
  const color = deckId === 'A' ? 'var(--cyan)' : 'var(--magenta)';
  
  const handleTouch = useCallback((action: string, extra?: any) => (e: React.TouchEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(10);
    sendMsg({ action, deck: deckId, ...extra });
  }, [deckId, sendMsg]);

  // CUE button special logic (hold)
  const handleCueStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(10);
    sendMsg({ action: 'cue', deck: deckId, hold: true });
  }, [deckId, sendMsg]);

  const handleCueEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    sendMsg({ action: 'cue', deck: deckId, hold: false });
  }, [deckId, sendMsg]);

  // Canvas Waveform rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw a simple progress bar as a fallback, waveform will overwrite if available via websocket events later.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const progress = state.duration > 0 ? state.currentTime / state.duration : 0;
    
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = deckId === 'A' ? '#00f5ff' : '#ff006e';
    ctx.fillRect(0, 0, canvas.width * progress, canvas.height);
    
  }, [state.currentTime, state.duration, deckId]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.touches[0].clientX - rect.left;
    const position = Math.max(0, Math.min(1, x / rect.width));
    sendMsg({ action: 'seek', deck: deckId, position });
  };

  return (
    <div className={styles.deckInfo} style={{ borderTop: `2px solid ${color}` }}>
      <div className={styles.waveformContainer}>
        <canvas 
          ref={canvasRef} 
          width={300} 
          height={48} 
          style={{ width: '100%', height: '100%', touchAction: 'none' }}
          onTouchStart={handleSeek}
          onTouchMove={handleSeek}
        />
      </div>
      
      <div className={styles.deckMeta}>
        <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {state.trackName}
        </div>
        <div className={styles.orbitron} style={{ color }}>
          {formatTime(state.currentTime)} / {formatTime(state.duration)}
        </div>
      </div>
      
      <div className={styles.deckMeta} style={{ color: 'var(--muted)', fontSize: '11px' }}>
        <div className={styles.orbitron}>BPM: {state.bpm.toFixed(1)}</div>
        <div className={styles.orbitron}>KEY: {state.key || '--'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
        <button 
          className={styles.touchBtn}
          style={{
            backgroundColor: state.isPlaying ? `${color}33` : 'var(--surface)',
            borderColor: state.isPlaying ? color : 'var(--border)',
            color: state.isPlaying ? color : 'var(--text)',
            boxShadow: state.isPlaying ? `0 0 10px ${color}66` : 'none'
          }}
          onTouchStart={handleTouch(state.isPlaying ? 'pause' : 'play')}
        >
          {state.isPlaying ? '⏸' : '▶'} PLAY
        </button>
        
        <button 
          className={styles.touchBtn}
          style={{ color: 'var(--magenta)', borderColor: 'var(--magenta)' }}
          onTouchStart={handleCueStart}
          onTouchEnd={handleCueEnd}
        >
          ■ CUE
        </button>

        <button 
          className={styles.touchBtn}
          onTouchStart={handleTouch('sync')}
        >
          ↺ SYNC
        </button>
      </div>

      {/* Grid for Hot Cues */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => {
          const hc = state.hotCues.find(h => h.index === i);
          const hcColor = hc && !hc.empty ? hc.color : 'var(--muted)';
          return (
            <button
              key={i}
              className={styles.touchBtn}
              style={{ minHeight: 36, minWidth: 36, fontSize: 10, borderColor: hc && !hc.empty ? hcColor : 'var(--border)', color: hcColor }}
              onTouchStart={handleTouch('hotcue', { index: i })}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
